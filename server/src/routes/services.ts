import { Router } from 'express'
import { z } from 'zod'
import { PaymentMode, ServiceType, type Prisma } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'
import { round2 } from '../lib/money.js'
import { zodMessage } from '../lib/http.js'
import { resolveCustomer } from '../lib/customers.js'
import { nextTicketNo } from '../lib/sequence.js'
import { takeStock } from '../lib/stock.js'

export const servicesRouter = Router()
servicesRouter.use(requireAuth)

type Tx = Prisma.TransactionClient

/** Statuses where the device is still with us and work can be recorded */
const WORK_OPEN = ['BOOKED', 'RECEIVED', 'IN_PROGRESS']
const CANCELLABLE = [...WORK_OPEN, 'AT_SUBCONTRACT', 'READY']
const CLOSED = ['DELIVERED', 'CANCELLED']

const jobInclude = {
  customer: true,
  createdBy: { select: { id: true, name: true } },
  spares: { include: { product: true } },
  phoneUnit: { include: { product: true } },
  payments: { orderBy: { paidAt: 'asc' as const } },
}

const modeSchema = z.nativeEnum(PaymentMode).default(PaymentMode.CASH)

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function send(res: import('express').Response, e: unknown, fallback: string) {
  if (e instanceof HttpError) {
    res.status(e.status).json({ error: e.message })
    return
  }
  res.status(400).json({ error: e instanceof Error ? e.message : fallback })
}

async function getJob(tx: Tx, id: string) {
  const job = await tx.serviceJob.findUnique({ where: { id } })
  if (!job) throw new HttpError(404, 'Service ticket not found')
  return job
}

/** What the shop actually paid for the spares (latest purchase cost, else the price charged). */
async function spareBuyCost(tx: Tx, productId: string, fallbackUnit: number) {
  const last = await tx.purchaseItem.findFirst({
    where: { productId },
    orderBy: { purchase: { purchaseDate: 'desc' } },
    select: { unitCost: true },
  })
  return last ? Number(last.unitCost) : fallbackUnit
}

async function recordPayment(
  tx: Tx,
  serviceJobId: string,
  amount: number,
  mode: PaymentMode,
  note: string,
) {
  if (!amount) return
  await tx.payment.create({
    data: { refType: 'SERVICE', serviceJobId, amount: round2(amount), mode, note },
  })
}

function rejectCreditMode(mode: PaymentMode, amount: number) {
  if (mode === PaymentMode.CREDIT && amount > 0) {
    throw new Error('Pick how the money was received (Cash / UPI / Card / Bank)')
  }
}

servicesRouter.get('/', async (req, res) => {
  const status = req.query.status as string | undefined
  const statuses = status
    ? status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined

  const list = await prisma.serviceJob.findMany({
    where: statuses?.length ? { status: { in: statuses } } : undefined,
    include: jobInclude,
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
  res.json(list)
})

servicesRouter.get('/:id', async (req, res) => {
  const job = await prisma.serviceJob.findUnique({
    where: { id: req.params.id },
    include: jobInclude,
  })
  if (!job) {
    res.status(404).json({ error: 'Service ticket not found' })
    return
  }
  res.json(job)
})

/** Booking — first visit: customer + device + advance */
const bookSchema = z
  .object({
    customerId: z.string().optional(),
    createCustomer: z
      .object({
        name: z.string().min(1),
        phone: z.string().optional(),
      })
      .optional(),
    deviceBrand: z.string().optional(),
    deviceModel: z.string().optional(),
    imei: z.string().optional(),
    issue: z.string().optional(),
    accessories: z.string().optional(),
    conditionNote: z.string().optional(),
    estimateAmount: z.number().nonnegative().default(0),
    advanceAmount: z.number().nonnegative().default(0),
    paymentMode: modeSchema,
    promisedDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => Boolean(d.customerId) || Boolean(d.createCustomer?.name), {
    message: 'Customer is required',
  })

servicesRouter.post('/', async (req, res) => {
  const parsed = bookSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: zodMessage(parsed.error) })
    return
  }
  const data = parsed.data
  const advance = round2(data.advanceAmount)

  try {
    rejectCreditMode(data.paymentMode, advance)
    const result = await prisma.$transaction(async (tx) => {
      const customerId = await resolveCustomer(tx, data)
      const ticketNo = await nextTicketNo(tx)

      const job = await tx.serviceJob.create({
        data: {
          type: ServiceType.SELF_LABOUR,
          ticketNo,
          customerId,
          deviceBrand: data.deviceBrand?.trim() || undefined,
          deviceModel: data.deviceModel?.trim() || undefined,
          imei: data.imei?.trim() || undefined,
          issue: data.issue?.trim() || undefined,
          accessories: data.accessories?.trim() || undefined,
          conditionNote: data.conditionNote?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          estimateAmount: round2(data.estimateAmount),
          advanceAmount: advance,
          paidAmount: advance,
          customerCharge: 0,
          status: 'BOOKED',
          promisedDate: data.promisedDate ? new Date(data.promisedDate) : undefined,
          createdById: req.user!.id,
        },
      })
      await recordPayment(tx, job.id, advance, data.paymentMode, 'Advance at booking')
      return tx.serviceJob.findUnique({ where: { id: job.id }, include: jobInclude })
    })

    res.status(201).json(result)
  } catch (e) {
    send(res, e, 'Failed to book service')
  }
})

/** Edit intake details while the ticket is open */
servicesRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      deviceBrand: z.string().nullable().optional(),
      deviceModel: z.string().nullable().optional(),
      imei: z.string().nullable().optional(),
      issue: z.string().nullable().optional(),
      accessories: z.string().nullable().optional(),
      conditionNote: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      estimateAmount: z.number().nonnegative().optional(),
      promisedDate: z.string().nullable().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const existing = await getJob(prisma, req.params.id)
    if (CLOSED.includes(existing.status)) throw new Error('Closed tickets cannot be edited')

    const { promisedDate, ...rest } = body.data
    const updated = await prisma.serviceJob.update({
      where: { id: existing.id },
      data: {
        ...rest,
        ...(promisedDate !== undefined
          ? { promisedDate: promisedDate ? new Date(promisedDate) : null }
          : {}),
      },
      include: jobInclude,
    })
    res.json(updated)
  } catch (e) {
    send(res, e, 'Failed to update ticket')
  }
})

const spareSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  /** Price charged to the customer per unit */
  unitPrice: z.number().nonnegative(),
})

/** With spares → deduct stock → READY (delivery queue) */
servicesRouter.post('/:id/with-spares', async (req, res) => {
  const body = z
    .object({
      labourCharge: z.number().nonnegative().default(0),
      timeMinutes: z.number().int().nonnegative().optional(),
      spares: z.array(spareSchema).min(1, 'Add at least one spare'),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await getJob(tx, req.params.id)
      if (!WORK_OPEN.includes(existing.status)) {
        throw new Error('Ticket is not open for spare work')
      }

      let spareCharge = 0
      let spareBuy = 0
      for (const s of body.data.spares) {
        const product = await tx.product.findUnique({ where: { id: s.productId } })
        if (!product) throw new Error('Spare product not found')
        await takeStock(tx, product.id, s.qty, product.name)
        const lineTotal = round2(s.unitPrice * s.qty)
        spareCharge += lineTotal
        spareBuy += (await spareBuyCost(tx, product.id, s.unitPrice)) * s.qty
        await tx.serviceSpare.create({
          data: {
            serviceJobId: existing.id,
            productId: product.id,
            qty: s.qty,
            unitCost: s.unitPrice,
            lineTotal,
          },
        })
      }
      spareCharge = round2(spareCharge)
      const labourCharge = round2(body.data.labourCharge)
      const customerCharge = round2(labourCharge + spareCharge)
      if (customerCharge <= 0) throw new Error('Enter labour and/or spare amounts')

      await tx.serviceJob.update({
        where: { id: existing.id },
        data: {
          type: ServiceType.SELF_WITH_SPARES,
          labourCharge,
          spareCost: spareCharge,
          customerCharge,
          margin: round2(customerCharge - spareBuy - Number(existing.subcontractCost)),
          timeMinutes: body.data.timeMinutes,
          status: 'READY',
          readyAt: new Date(),
        },
      })
      return tx.serviceJob.findUnique({ where: { id: existing.id }, include: jobInclude })
    })

    res.json(result)
  } catch (e) {
    send(res, e, 'Failed to save spare work')
  }
})

/** Without spares (labour only) → READY */
servicesRouter.post('/:id/without-spares', async (req, res) => {
  const body = z
    .object({
      labourCharge: z.number().positive('Enter labour charge'),
      timeMinutes: z.number().int().nonnegative().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const existing = await getJob(prisma, req.params.id)
    if (!WORK_OPEN.includes(existing.status)) throw new Error('Ticket is not open for labour work')

    const labourCharge = round2(body.data.labourCharge)
    const updated = await prisma.serviceJob.update({
      where: { id: existing.id },
      data: {
        type: ServiceType.SELF_LABOUR,
        labourCharge,
        customerCharge: labourCharge,
        margin: labourCharge,
        timeMinutes: body.data.timeMinutes,
        status: 'READY',
        readyAt: new Date(),
      },
      include: jobInclude,
    })
    res.json(updated)
  } catch (e) {
    send(res, e, 'Failed to save labour')
  }
})

/** Send to subcontractor — amount given now */
servicesRouter.post('/:id/subcontract', async (req, res) => {
  const body = z
    .object({
      subcontractorName: z.string().trim().min(1, 'Enter subcontractor name'),
      amountGiven: z.number().nonnegative(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const existing = await getJob(prisma, req.params.id)
    if (!WORK_OPEN.includes(existing.status)) {
      throw new Error('Ticket is not open to send for subcontract')
    }

    const updated = await prisma.serviceJob.update({
      where: { id: existing.id },
      data: {
        type: ServiceType.SUBCONTRACT,
        subcontractorName: body.data.subcontractorName,
        subcontractCost: round2(body.data.amountGiven),
        status: 'AT_SUBCONTRACT',
      },
      include: jobInclude,
    })
    res.json(updated)
  } catch (e) {
    send(res, e, 'Failed to send to subcontractor')
  }
})

/** Subcontract returned — final cost + our labour → READY */
servicesRouter.post('/:id/subcontract-return', async (req, res) => {
  const body = z
    .object({
      subcontractCost: z.number().nonnegative(),
      labourCharge: z.number().nonnegative().default(0),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const existing = await getJob(prisma, req.params.id)
    if (existing.status !== 'AT_SUBCONTRACT') throw new Error('Ticket is not at subcontractor')

    const subcontractCost = round2(body.data.subcontractCost)
    const labourCharge = round2(body.data.labourCharge)
    const customerCharge = round2(labourCharge + subcontractCost)
    if (customerCharge <= 0) throw new Error('Enter labour and/or subcontract amount')

    const updated = await prisma.serviceJob.update({
      where: { id: existing.id },
      data: {
        subcontractCost,
        customerCharge,
        labourCharge,
        margin: labourCharge,
        status: 'READY',
        readyAt: new Date(),
      },
      include: jobInclude,
    })
    res.json(updated)
  } catch (e) {
    send(res, e, 'Failed to save subcontract return')
  }
})

/** Delivery — collect balance (or keep it on customer credit), refund extra advance, close */
servicesRouter.post('/:id/deliver', async (req, res) => {
  const body = z
    .object({
      collectAmount: z.number().nonnegative().optional(),
      paymentMode: modeSchema,
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await getJob(tx, req.params.id)
      if (existing.status !== 'READY') throw new Error('Only READY tickets can be delivered')

      const charge = Number(existing.customerCharge)
      const alreadyPaid = Number(existing.paidAmount)
      const due = round2(Math.max(charge - alreadyPaid, 0))
      const refund = round2(Math.max(alreadyPaid - charge, 0))
      const collect = round2(Math.min(body.data.collectAmount ?? due, due))
      rejectCreditMode(body.data.paymentMode, collect)
      const stillDue = round2(due - collect)

      if (stillDue > 0 && !existing.customerId) {
        throw new Error('Collect the full balance — no customer on this ticket for credit')
      }

      await recordPayment(tx, existing.id, collect, body.data.paymentMode, 'Collected at delivery')
      if (refund > 0) {
        await recordPayment(tx, existing.id, -refund, body.data.paymentMode, 'Advance refunded')
      }
      if (stillDue > 0 && existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { creditBalance: { increment: stillDue } },
        })
      }

      await tx.serviceJob.update({
        where: { id: existing.id },
        data: {
          paidAmount: round2(alreadyPaid + collect - refund),
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      })
      return tx.serviceJob.findUnique({ where: { id: existing.id }, include: jobInclude })
    })
    res.json(result)
  } catch (e) {
    send(res, e, 'Delivery failed')
  }
})

/** Collect a balance left on credit at delivery */
servicesRouter.post('/:id/payments', async (req, res) => {
  const body = z
    .object({
      amount: z.number().positive('Enter an amount'),
      mode: modeSchema,
      note: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    rejectCreditMode(body.data.mode, body.data.amount)
    const result = await prisma.$transaction(async (tx) => {
      const existing = await getJob(tx, req.params.id)
      if (existing.status !== 'DELIVERED') {
        throw new Error('Balance is collected at delivery for open tickets')
      }
      const due = round2(Number(existing.customerCharge) - Number(existing.paidAmount))
      if (due <= 0) throw new Error('Nothing pending on this ticket')
      const amount = round2(Math.min(body.data.amount, due))

      await recordPayment(tx, existing.id, amount, body.data.mode, body.data.note || 'Balance collected')
      if (existing.customerId) {
        await tx.customer.update({
          where: { id: existing.customerId },
          data: { creditBalance: { decrement: amount } },
        })
      }
      await tx.serviceJob.update({
        where: { id: existing.id },
        data: { paidAmount: { increment: amount } },
      })
      return tx.serviceJob.findUnique({ where: { id: existing.id }, include: jobInclude })
    })
    res.json(result)
  } catch (e) {
    send(res, e, 'Payment failed')
  }
})

/** Cancel — return any spares to stock and optionally refund the advance */
servicesRouter.post('/:id/cancel', async (req, res) => {
  const body = z
    .object({
      reason: z.string().trim().min(1, 'Enter a reason'),
      refundAdvance: z.boolean().default(true),
      paymentMode: modeSchema,
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await getJob(tx, req.params.id)
      if (!CANCELLABLE.includes(existing.status)) throw new Error('This ticket is already closed')

      const spares = await tx.serviceSpare.findMany({ where: { serviceJobId: existing.id } })
      for (const s of spares) {
        await tx.product.update({
          where: { id: s.productId },
          data: { stockQty: { increment: s.qty } },
        })
      }
      await tx.serviceSpare.deleteMany({ where: { serviceJobId: existing.id } })

      const paid = Number(existing.paidAmount)
      const refundMode =
        body.data.paymentMode === PaymentMode.CREDIT ? PaymentMode.CASH : body.data.paymentMode
      if (body.data.refundAdvance && paid > 0) {
        await recordPayment(tx, existing.id, -paid, refundMode, 'Advance refunded on cancel')
      }
      const kept = body.data.refundAdvance ? 0 : paid

      await tx.serviceJob.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: body.data.reason,
          spareCost: 0,
          customerCharge: kept,
          paidAmount: kept,
          margin: round2(kept - Number(existing.subcontractCost)),
        },
      })
      return tx.serviceJob.findUnique({ where: { id: existing.id }, include: jobInclude })
    })
    res.json(result)
  } catch (e) {
    send(res, e, 'Cancel failed')
  }
})
