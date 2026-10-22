import { Router } from 'express'
import { z } from 'zod'
import {
  PaymentMode,
  PaymentStatus,
  PhoneEventType,
  PhoneStatus,
  ProductCategory,
  PurchaseType,
} from '@prisma/client'
import { prisma } from '../prisma.js'
import { zodMessage } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { round2, splitInclusive } from '../lib/money.js'
import { resolveCustomer } from '../lib/customers.js'
import { intakePhoneUnit, uniqueSku } from '../lib/stock.js'

export const purchasesRouter = Router()
purchasesRouter.use(requireAuth)

const lineSchema = z
  .object({
    productId: z.string().min(1).optional(),
    qty: z.number().int().positive(),
    unitCost: z.number().nonnegative(),
    discount: z.number().nonnegative().default(0),
    taxPercent: z.number().nonnegative().default(18),
    suggestedSellPrice: z.number().nonnegative().optional(),
    imeis: z.array(z.string().min(5)).optional(),
    color: z.string().optional(),
    conditionNote: z.string().optional(),
    createProduct: z
      .object({
        sku: z.string().min(1),
        name: z.string().min(1),
        brand: z.string().min(1),
        model: z.string().optional(),
        category: z.nativeEnum(ProductCategory),
        sellPrice: z.number().nonnegative().optional(),
        ram: z.string().optional(),
        rom: z.string().optional(),
        color: z.string().optional(),
        network: z.string().optional(),
        processor: z.string().optional(),
        spareType: z.string().optional(),
        spareGrade: z.string().optional(),
        specNote: z.string().optional(),
      })
      .optional(),
  })
  .refine((d) => Boolean(d.productId) || Boolean(d.createProduct), {
    message: 'productId or createProduct required',
  })

const createSchema = z
  .object({
    type: z.nativeEnum(PurchaseType),
    supplierId: z.string().min(1).optional(),
    customerId: z.string().min(1).optional(),
    createCustomer: z
      .object({
        name: z.string().min(1),
        phone: z.string().optional(),
        notes: z.string().optional(),
      })
      .optional(),
    invoiceNo: z.string().optional(),
    purchaseDate: z.string().optional(),
    discount: z.number().nonnegative().default(0),
    paidAmount: z.number().nonnegative().default(0),
    paymentMode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
    notes: z.string().optional(),
    items: z.array(lineSchema).min(1),
  })
  .refine((d) => Boolean(d.supplierId) || Boolean(d.customerId) || Boolean(d.createCustomer), {
    message: 'supplier, customerId, or createCustomer required',
  })
  .refine((d) => !(d.supplierId && (d.customerId || d.createCustomer)), {
    message: 'Use supplier or customer, not both',
  })


const purchaseInclude = {
  supplier: true,
  customer: true,
  createdBy: { select: { id: true, name: true } },
  items: { include: { product: true, phoneUnits: true } },
  payments: { orderBy: { paidAt: 'desc' as const } },
}

purchasesRouter.get('/', async (req, res) => {
  const type = req.query.type as PurchaseType | undefined
  const pending = String(req.query.pending || '') === '1'
  const list = await prisma.purchase.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(pending ? { creditAmount: { gt: 0 } } : {}),
    },
    include: {
      supplier: true,
      customer: true,
      createdBy: { select: { id: true, name: true } },
      items: { include: { product: true, phoneUnits: true } },
      payments: { orderBy: { paidAt: 'desc' } },
    },
    orderBy: { purchaseDate: 'desc' },
    take: 200,
  })
  res.json(list)
})

purchasesRouter.get('/:id', async (req, res) => {
  const purchase = await prisma.purchase.findUnique({
    where: { id: req.params.id },
    include: {
      ...purchaseInclude,
      createdBy: { select: { id: true, name: true, username: true } },
    },
  })
  if (!purchase) {
    res.status(404).json({ error: 'Purchase not found' })
    return
  }
  res.json(purchase)
})

purchasesRouter.post('/', async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: zodMessage(parsed.error) })
    return
  }
  const data = parsed.data
  const userId = req.user!.id

  if (data.paymentMode === PaymentMode.CREDIT && data.paidAmount > 0) {
    res.status(400).json({
      error: 'Mode "Credit" means nothing is paid now — set paid amount to 0 or pick Cash / UPI',
    })
    return
  }

  const allImeis = data.items.flatMap((l) => (l.imeis || []).map((i) => i.trim()).filter(Boolean))
  const dupInBill = allImeis.filter((imei, i) => allImeis.indexOf(imei) !== i)
  if (dupInBill.length) {
    res.status(400).json({ error: `IMEI entered twice on this bill: ${[...new Set(dupInBill)].join(', ')}` })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (data.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } })
        if (!supplier) throw new Error('Supplier not found')
      }
      const customerId = await resolveCustomer(tx, data)

      const normalizedItems: Array<{
        productId: string
        qty: number
        unitCost: number
        discount: number
        tax: number
        lineTotal: number
        imeis: string[]
        isBulk: boolean
        color?: string
        conditionNote?: string
        category: ProductCategory
        suggestedSellPrice?: number
      }> = []

      for (const line of data.items) {
        let productId = line.productId || ''
        let category: ProductCategory

        if (line.createProduct) {
          const created = await tx.product.create({
            data: {
              sku: await uniqueSku(tx, line.createProduct.sku),
              name: line.createProduct.name,
              brand: line.createProduct.brand,
              model: line.createProduct.model,
              category: line.createProduct.category,
              sellPrice: line.suggestedSellPrice ?? line.createProduct.sellPrice ?? line.unitCost,
              taxPercent: line.taxPercent,
              reorderLevel: 0,
              ram: line.createProduct.ram,
              rom: line.createProduct.rom,
              color: line.createProduct.color,
              network: line.createProduct.network,
              processor: line.createProduct.processor,
              spareType: line.createProduct.spareType,
              spareGrade: line.createProduct.spareGrade,
              specNote: line.createProduct.specNote,
            },
          })
          productId = created.id
          category = created.category
        } else {
          const product = await tx.product.findUnique({ where: { id: productId } })
          if (!product) throw new Error(`Product not found: ${productId}`)
          category = product.category
        }

        const imeis = (line.imeis || []).map((i) => i.trim()).filter(Boolean)
        const isPhone =
          category === ProductCategory.NEW_PHONE || category === ProductCategory.USED_PHONE

        if (isPhone) {
          if (imeis.length === 0) {
            throw new Error('IMEI list required for phone purchases')
          }
          if (imeis.length !== line.qty) {
            throw new Error(`IMEI count (${imeis.length}) must match qty (${line.qty})`)
          }
          const inHand = await tx.phoneUnit.findMany({
            where: {
              imei: { in: imeis },
              status: { in: [PhoneStatus.IN_STOCK, PhoneStatus.IN_SERVICE] },
            },
            select: { imei: true },
          })
          if (inHand.length) {
            throw new Error(`IMEI already in stock: ${inHand.map((d) => d.imei).join(', ')}`)
          }
        }

        const charged = round2(Math.max(line.unitCost * line.qty - line.discount, 0))
        const { tax, incl: lineTotal } = splitInclusive(charged, line.taxPercent)

        normalizedItems.push({
          productId,
          qty: line.qty,
          unitCost: line.unitCost,
          discount: line.discount,
          tax,
          lineTotal,
          imeis,
          isBulk: imeis.length > 1,
          color: line.color,
          conditionNote: line.conditionNote,
          category,
          suggestedSellPrice: line.suggestedSellPrice,
        })
      }

      const itemsIncl = round2(normalizedItems.reduce((s, i) => s + i.lineTotal, 0))
      const itemsTax = round2(normalizedItems.reduce((s, i) => s + i.tax, 0))
      const billDiscount = round2(data.discount)
      const grandTotal = round2(Math.max(itemsIncl - billDiscount, 0))
      const tax = itemsIncl > 0 ? round2(itemsTax * (grandTotal / itemsIncl)) : 0
      const itemsSubtotal = round2(grandTotal - tax)
      const paidAmount = round2(Math.min(data.paidAmount, grandTotal))
      const creditAmount = round2(grandTotal - paidAmount)
      const paymentStatus: PaymentStatus =
        creditAmount <= 0 ? PaymentStatus.PAID : paidAmount > 0 ? PaymentStatus.PARTIAL : PaymentStatus.CREDIT

      const purchase = await tx.purchase.create({
        data: {
          type: data.type,
          supplierId: data.supplierId,
          customerId,
          invoiceNo: data.invoiceNo,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
          subtotal: itemsSubtotal,
          discount: billDiscount,
          tax,
          grandTotal,
          paidAmount,
          creditAmount,
          paymentStatus,
          notes: data.notes,
          createdById: userId,
        },
      })

      for (const line of normalizedItems) {
        const item = await tx.purchaseItem.create({
          data: {
            purchaseId: purchase.id,
            productId: line.productId,
            qty: line.qty,
            unitCost: line.unitCost,
            discount: line.discount,
            tax: line.tax,
            lineTotal: line.lineTotal,
            isBulk: line.isBulk,
            imeiList: line.imeis,
          },
        })

        const isPhone =
          line.category === ProductCategory.NEW_PHONE || line.category === ProductCategory.USED_PHONE

        if (isPhone) {
          for (const imei of line.imeis) {
            const unit = await intakePhoneUnit(tx, {
              imei,
              productId: line.productId,
              cost: line.unitCost,
              suggestedSellPrice: line.suggestedSellPrice ?? null,
              purchaseItemId: item.id,
              color: line.color,
              conditionNote: line.conditionNote,
            })
            await tx.phoneEvent.create({
              data: {
                phoneUnitId: unit.id,
                type: PhoneEventType.PURCHASED,
                note: `Purchase ${purchase.id}`,
                supplierId: data.supplierId,
                customerId,
                refType: 'PURCHASE',
                refId: purchase.id,
                createdBy: userId,
              },
            })
          }
        }

        await tx.product.update({
          where: { id: line.productId },
          data: { stockQty: { increment: line.qty } },
        })
      }

      if (paidAmount > 0) {
        await tx.payment.create({
          data: {
            refType: 'PURCHASE',
            purchaseId: purchase.id,
            amount: paidAmount,
            mode: data.paymentMode,
            note: customerId ? 'Paid to customer for used phone' : 'Initial payment on purchase',
          },
        })
      }

      if (creditAmount > 0) {
        if (data.supplierId) {
          await tx.supplier.update({
            where: { id: data.supplierId },
            data: { creditBalance: { increment: creditAmount } },
          })
        }
        if (customerId) {
          await tx.customer.update({
            where: { id: customerId },
            data: { payableBalance: { increment: creditAmount } },
          })
        }
      }

      return tx.purchase.findUnique({
        where: { id: purchase.id },
        include: purchaseInclude,
      })
    })

    res.status(201).json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create purchase'
    res.status(400).json({ error: message })
  }
})

purchasesRouter.post('/:id/payments', async (req, res) => {
  const body = z
    .object({
      amount: z.number().positive(),
      mode: z.nativeEnum(PaymentMode).default(PaymentMode.CASH),
      note: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({ where: { id: req.params.id } })
      if (!purchase) throw new Error('Purchase not found')
      if (Number(purchase.creditAmount) <= 0) throw new Error('No credit pending')

      const amount = round2(Math.min(body.data.amount, Number(purchase.creditAmount)))
      await tx.payment.create({
        data: {
          refType: 'PURCHASE',
          purchaseId: purchase.id,
          amount,
          mode: body.data.mode,
          note: body.data.note || 'Credit settlement',
        },
      })

      const paidAmount = round2(Number(purchase.paidAmount) + amount)
      const creditAmount = round2(Number(purchase.grandTotal) - paidAmount)
      const paymentStatus: PaymentStatus =
        creditAmount <= 0 ? PaymentStatus.PAID : PaymentStatus.PARTIAL

      if (purchase.supplierId) {
        await tx.supplier.update({
          where: { id: purchase.supplierId },
          data: { creditBalance: { decrement: amount } },
        })
      }
      if (purchase.customerId) {
        await tx.customer.update({
          where: { id: purchase.customerId },
          data: { payableBalance: { decrement: amount } },
        })
      }

      return tx.purchase.update({
        where: { id: purchase.id },
        data: { paidAmount, creditAmount, paymentStatus },
        include: purchaseInclude,
      })
    })
    res.json(updated)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Payment failed'
    res.status(400).json({ error: message })
  }
})
