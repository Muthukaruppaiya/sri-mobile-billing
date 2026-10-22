import { Router } from 'express'
import { z } from 'zod'
import {
  PaymentMode,
  PaymentStatus,
  PhoneEventType,
  PhoneStatus,
  ProductCategory,
  SaleType,
} from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { round2, splitInclusive } from '../lib/money.js'
import { resolveCustomer } from '../lib/customers.js'
import { nextInvoiceNo } from '../lib/sequence.js'
import { intakePhoneUnit, takeStock, uniqueSku } from '../lib/stock.js'

export const salesRouter = Router()
salesRouter.use(requireAuth)

const saleInclude = {
  customer: true,
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: true, phoneUnit: { include: { product: true } } } },
  exchanges: true,
  financePlan: true,
  payments: { orderBy: { paidAt: 'desc' as const } },
}

const createSchema = z.object({
  type: z.nativeEnum(SaleType),
  customerId: z.string().min(1).optional(),
  createCustomer: z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
    })
    .optional(),
  discount: z.number().nonnegative().default(0),
  paidAmount: z.number().nonnegative().default(0),
  paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        phoneUnitId: z.string().optional(),
        productId: z.string().optional(),
        qty: z.number().int().positive().default(1),
        unitPrice: z.number().nonnegative(),
        discount: z.number().nonnegative().default(0),
        taxPercent: z.number().nonnegative().default(18),
      }),
    )
    .min(1),
  exchange: z
    .object({
      brand: z.string().min(1),
      model: z.string().min(1),
      imei: z.string().trim().min(5, 'Exchange IMEI looks too short'),
      agreedValue: z.number().nonnegative(),
      color: z.string().optional(),
      conditionNote: z.string().optional(),
      ram: z.string().optional(),
      rom: z.string().optional(),
      network: z.string().optional(),
    })
    .optional(),
  finance: z
    .object({
      financierName: z.string().min(1),
      advanceAmount: z.number().nonnegative(),
      financedAmount: z.number().nonnegative(),
      tenureMonths: z.number().int().positive().optional(),
      emiAmount: z.number().nonnegative().optional(),
      approvalRef: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
})

salesRouter.get('/', async (req, res) => {
  const type = req.query.type as SaleType | undefined
  const list = await prisma.sale.findMany({
    where: type ? { type } : undefined,
    include: saleInclude,
    orderBy: { saleDate: 'desc' },
    take: 300,
  })
  res.json(list)
})

salesRouter.get('/:id', async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: saleInclude,
  })
  if (!sale) {
    res.status(404).json({ error: 'Sale not found' })
    return
  }
  res.json(sale)
})

salesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid sale' })
    return
  }
  const data = parsed.data
  const userId = req.user!.id

  if (data.paymentMode === PaymentMode.CREDIT && data.paidAmount > 0) {
    res.status(400).json({
      error: 'Mode "Credit" means nothing is paid now — set in-hand to 0 or pick Cash / UPI',
    })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, data, { renameExisting: true })

      const lines: Array<{
        productId?: string
        phoneUnitId?: string
        qty: number
        unitPrice: number
        discount: number
        tax: number
        lineTotal: number
      }> = []

      const seenUnits = new Set<string>()
      for (const item of data.items) {
        if (item.phoneUnitId) {
          if (seenUnits.has(item.phoneUnitId)) throw new Error('Same phone added twice')
          seenUnits.add(item.phoneUnitId)
          const unit = await tx.phoneUnit.findUnique({
            where: { id: item.phoneUnitId },
            include: { product: true },
          })
          if (!unit) throw new Error('Phone unit not found')
          if (unit.status !== PhoneStatus.IN_STOCK) throw new Error(`IMEI ${unit.imei} is not in stock`)
          const charged = round2(Math.max(item.unitPrice * item.qty - item.discount, 0))
          const { tax, incl: lineTotal } = splitInclusive(charged, item.taxPercent)
          lines.push({
            productId: unit.productId,
            phoneUnitId: unit.id,
            qty: 1,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax,
            lineTotal,
          })
        } else if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } })
          if (!product) throw new Error('Product not found')
          if (product.stockQty < item.qty) throw new Error(`Insufficient stock for ${product.name}`)
          const charged = round2(Math.max(item.unitPrice * item.qty - item.discount, 0))
          const { tax, incl: lineTotal } = splitInclusive(charged, item.taxPercent)
          lines.push({
            productId: product.id,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount,
            tax,
            lineTotal,
          })
        } else {
          throw new Error('Each sale line needs phoneUnitId or productId')
        }
      }

      const itemsIncl = round2(lines.reduce((s, l) => s + l.lineTotal, 0))
      const itemsTax = round2(lines.reduce((s, l) => s + l.tax, 0))
      const exchangeValue = data.exchange ? round2(data.exchange.agreedValue) : 0
      if (exchangeValue > itemsIncl) {
        throw new Error('Exchange value cannot be more than the bill amount')
      }
      const billDiscount = round2(data.discount + exchangeValue)
      // Amount due after exchange (customer cash + optional finance log)
      const grandTotal = round2(Math.max(itemsIncl - billDiscount, 0))
      const tax = itemsIncl > 0 ? round2(itemsTax * (grandTotal / itemsIncl)) : 0
      const itemsSubtotal = round2(grandTotal - tax)
      const cashPaid = round2(Math.min(Math.max(data.paidAmount, 0), grandTotal))
      // Finance is a log only: company remits remaining to the shop — not shop EMI
      const financedCover = data.finance ? round2(Math.max(grandTotal - cashPaid, 0)) : 0
      const paidAmount = cashPaid
      const creditAmount = data.finance ? 0 : round2(Math.max(grandTotal - cashPaid, 0))
      if (creditAmount > 0 && !customerId) {
        throw new Error('Customer is required when part of the bill is on credit')
      }
      const paymentStatus: PaymentStatus = data.finance
        ? PaymentStatus.PAID
        : creditAmount <= 0
          ? PaymentStatus.PAID
          : paidAmount > 0
            ? PaymentStatus.PARTIAL
            : PaymentStatus.CREDIT

      const invoiceNo = await nextInvoiceNo(tx)

      const sale = await tx.sale.create({
        data: {
          type: data.type,
          customerId,
          invoiceNo,
          subtotal: itemsSubtotal,
          discount: billDiscount,
          tax,
          grandTotal,
          paidAmount,
          creditAmount,
          paymentStatus,
          hasExchange: Boolean(data.exchange),
          hasFinance: Boolean(data.finance),
          notes: data.notes,
          createdById: userId,
        },
      })

      for (const line of lines) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: line.productId,
            phoneUnitId: line.phoneUnitId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            discount: line.discount,
            tax: line.tax,
            lineTotal: line.lineTotal,
          },
        })

        if (line.phoneUnitId) {
          // Conditional update so two counters cannot sell the same IMEI at once
          const sold = await tx.phoneUnit.updateMany({
            where: { id: line.phoneUnitId, status: PhoneStatus.IN_STOCK },
            data: { status: PhoneStatus.SOLD },
          })
          if (sold.count === 0) throw new Error('Phone was just sold on another bill')
          await tx.phoneEvent.create({
            data: {
              phoneUnitId: line.phoneUnitId,
              type: PhoneEventType.SOLD,
              note: `Sale ${invoiceNo}`,
              customerId,
              refType: 'SALE',
              refId: sale.id,
              createdBy: userId,
            },
          })
          await tx.product.updateMany({
            where: { id: line.productId, stockQty: { gt: 0 } },
            data: { stockQty: { decrement: 1 } },
          })
        } else if (line.productId) {
          await takeStock(tx, line.productId, line.qty, 'item')
        }
      }

      if (data.exchange) {
        const ex = data.exchange
        const tip = ex.imei.replace(/\W/g, '').slice(-8)
        const product = await tx.product.create({
          data: {
            sku: await uniqueSku(tx, `UP-EX-${tip}`),
            name: ex.model,
            brand: ex.brand,
            model: ex.model,
            category: ProductCategory.USED_PHONE,
            sellPrice: ex.agreedValue,
            taxPercent: 0,
            reorderLevel: 0,
            stockQty: 1,
            ram: ex.ram,
            rom: ex.rom,
            color: ex.color,
            network: ex.network,
          },
        })
        const unit = await intakePhoneUnit(tx, {
          imei: ex.imei,
          productId: product.id,
          cost: ex.agreedValue,
          color: ex.color,
          conditionNote: ex.conditionNote,
        })
        await tx.phoneEvent.create({
          data: {
            phoneUnitId: unit.id,
            type: PhoneEventType.EXCHANGED_IN,
            note: `Exchange on sale ${invoiceNo}`,
            customerId,
            refType: 'SALE',
            refId: sale.id,
            createdBy: userId,
          },
        })
        await tx.exchange.create({
          data: {
            saleId: sale.id,
            incomingPhoneId: unit.id,
            brand: ex.brand,
            model: ex.model,
            imei: ex.imei.trim(),
            agreedValue: ex.agreedValue,
            conditionNote: ex.conditionNote,
          },
        })
      }

      if (data.finance) {
        await tx.financePlan.create({
          data: {
            saleId: sale.id,
            financierName: data.finance.financierName,
            advanceAmount: data.finance.advanceAmount,
            financedAmount: financedCover || data.finance.financedAmount,
            tenureMonths: data.finance.tenureMonths,
            emiAmount: data.finance.emiAmount,
            approvalRef: data.finance.approvalRef,
            notes: data.finance.notes || 'Finance company remits remaining amount to shop',
          },
        })
      }

      if (cashPaid > 0) {
        await tx.payment.create({
          data: {
            refType: 'SALE',
            saleId: sale.id,
            amount: cashPaid,
            mode: data.paymentMode,
            note: data.finance
              ? 'In-hand cash · finance company remits rest to shop'
              : 'Initial payment on sale',
          },
        })
      }

      if (creditAmount > 0 && customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: { creditBalance: { increment: creditAmount } },
        })
      }

      return tx.sale.findUnique({ where: { id: sale.id }, include: saleInclude })
    })

    res.status(201).json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create sale'
    res.status(400).json({ error: message })
  }
})

salesRouter.post('/:id/payments', async (req, res) => {
  const body = z
    .object({
      amount: z.number().positive('Enter an amount'),
      mode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
      note: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.issues[0]?.message || 'Invalid payment' })
    return
  }
  if (body.data.mode === PaymentMode.CREDIT) {
    res.status(400).json({ error: 'Choose how the money was received (cash, UPI…)' })
    return
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: req.params.id } })
      if (!sale) throw new Error('Sale not found')
      if (Number(sale.creditAmount) <= 0) throw new Error('No credit pending')

      const amount = round2(Math.min(body.data.amount, Number(sale.creditAmount)))
      await tx.payment.create({
        data: {
          refType: 'SALE',
          saleId: sale.id,
          amount,
          mode: body.data.mode,
          note: body.data.note || 'Credit settlement',
        },
      })

      const paidAmount = round2(Number(sale.paidAmount) + amount)
      const creditAmount = round2(Math.max(Number(sale.creditAmount) - amount, 0))
      const paymentStatus: PaymentStatus =
        creditAmount <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL

      if (sale.customerId) {
        await tx.customer.update({
          where: { id: sale.customerId },
          data: { creditBalance: { decrement: amount } },
        })
      }

      return tx.sale.update({
        where: { id: sale.id },
        data: { paidAmount, creditAmount, paymentStatus },
        include: saleInclude,
      })
    })
    res.json(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment failed'
    res.status(400).json({ error: message })
  }
})
