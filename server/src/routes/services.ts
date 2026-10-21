import { Router } from 'express'
import { z } from 'zod'
import { ServiceType } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

export const servicesRouter = Router()
servicesRouter.use(requireAuth)

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function ticketNo() {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `SV-${stamp}-${rand}`
}

const jobInclude = {
  customer: true,
  createdBy: { select: { id: true, name: true } },
  spares: { include: { product: true } },
  phoneUnit: { include: { product: true } },
}

const spareSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
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
    estimateAmount: z.number().nonnegative().default(0),
    advanceAmount: z.number().nonnegative().default(0),
    paymentMode: z.string().optional(),
    promisedDate: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((d) => Boolean(d.customerId) || Boolean(d.createCustomer?.name), {
    message: 'customerId or createCustomer required',
  })

servicesRouter.get('/', async (req, res) => {
  const status = req.query.status as string | undefined
  const statuses = status
    ? status.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  const list = await prisma.serviceJob.findMany({
    where: statuses?.length ? { status: { in: statuses } } : undefined,
    include: jobInclude,
    orderBy: { createdAt: 'desc' },
    take: 150,
  })
  res.json(list)
})

servicesRouter.get('/:id', async (req, res) => {
  const job = await prisma.serviceJob.findUnique({
    where: { id: req.params.id },
    include: jobInclude,
  })
  if (!job) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }
  res.json(job)
})

/** Create booking ticket (status BOOKED) */
servicesRouter.post('/', async (req, res) => {
  const parsed = bookSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() })
    return
  }
  const data = parsed.data
  const userId = req.user!.id
  const advance = round2(data.advanceAmount)

  try {
    const result = await prisma.$transaction(async (tx) => {
      let customerId = data.customerId
      if (data.createCustomer) {
        const phone = data.createCustomer.phone?.trim()
        const existing = phone
          ? await tx.customer.findFirst({
              where: { active: true, OR: [{ phone }, { altPhone: phone }] },
            })
          : null
        if (existing) {
          customerId = existing.id
        } else {
          const c = await tx.customer.create({
            data: {
              name: data.createCustomer.name.trim(),
              phone: phone || undefined,
            },
          })
          customerId = c.id
        }
      } else if (customerId) {
        const c = await tx.customer.findUnique({ where: { id: customerId } })
        if (!c) throw new Error('Customer not found')
      }

      let ticket = ticketNo()
      for (let i = 0; i < 5; i++) {
        const exists = await tx.serviceJob.findUnique({ where: { ticketNo: ticket } })
        if (!exists) break
        ticket = ticketNo()
      }

      return tx.serviceJob.create({
        data: {
          type: ServiceType.SELF_LABOUR,
          ticketNo: ticket,
          customerId,
          deviceBrand: data.deviceBrand,
          deviceModel: data.deviceModel,
          imei: data.imei,
          issue: data.issue || data.notes,
          estimateAmount: round2(data.estimateAmount),
          advanceAmount: advance,
          paidAmount: advance,
          customerCharge: 0,
          status: 'BOOKED',
          promisedDate: data.promisedDate ? new Date(data.promisedDate) : undefined,
          createdById: userId,
        },
        include: jobInclude,
      })
    })

    res.status(201).json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to book service'
    res.status(400).json({ error: message })
  }
})

async function loadJob(id: string) {
  return prisma.serviceJob.findUnique({ where: { id }, include: jobInclude })
}

/** With spares → deduct stock → READY (delivery queue) */
servicesRouter.post('/:id/with-spares', async (req, res) => {
  const body = z
    .object({
      labourCharge: z.number().nonnegative().default(0),
      timeMinutes: z.number().int().nonnegative().optional(),
      spares: z.array(spareSchema).min(1),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.serviceJob.findUnique({ where: { id: req.params.id } })
      if (!existing) throw new Error('Service job not found')
      if (!['BOOKED', 'RECEIVED', 'IN_PROGRESS'].includes(existing.status)) {
        throw new Error('Ticket is not open for spare work')
      }

      let spareCost = 0
      const spareRows: Array<{ productId: string; qty: number; unitCost: number; lineTotal: number }> =
        []

      for (const s of body.data.spares) {
        const product = await tx.product.findUnique({ where: { id: s.productId } })
        if (!product) throw new Error('Spare product not found')
        if (product.stockQty < s.qty) throw new Error(`Insufficient stock for ${product.name}`)
        const lineTotal = round2(s.unitCost * s.qty)
        spareCost += lineTotal
        spareRows.push({
          productId: s.productId,
          qty: s.qty,
          unitCost: s.unitCost,
          lineTotal,
        })
      }
      spareCost = round2(spareCost)
      const labourCharge = round2(body.data.labourCharge)
      // Total from customer = labour + spares
      const customerCharge = round2(labourCharge + spareCost)
      const margin = round2(customerCharge - spareCost - labourCharge - Number(existing.subcontractCost))

      await tx.serviceSpare.deleteMany({ where: { serviceJobId: existing.id } })

      for (const s of spareRows) {
        await tx.serviceSpare.create({
          data: {
            serviceJobId: existing.id,
            productId: s.productId,
            qty: s.qty,
            unitCost: s.unitCost,
            lineTotal: s.lineTotal,
          },
        })
        await tx.product.update({
          where: { id: s.productId },
          data: { stockQty: { decrement: s.qty } },
        })
      }

      return tx.serviceJob.update({
        where: { id: existing.id },
        data: {
          type: ServiceType.SELF_WITH_SPARES,
          labourCharge,
          spareCost,
          customerCharge,
          margin,
          timeMinutes: body.data.timeMinutes,
          status: 'READY',
        },
        include: jobInclude,
      })
    })

    res.json(result)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Failed' })
  }
})

/** Without spares (labour only) → READY */
servicesRouter.post('/:id/without-spares', async (req, res) => {
  const body = z
    .object({
      labourCharge: z.number().nonnegative(),
      timeMinutes: z.number().int().nonnegative().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const existing = await prisma.serviceJob.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }
  if (!['BOOKED', 'RECEIVED', 'IN_PROGRESS'].includes(existing.status)) {
    res.status(400).json({ error: 'Ticket is not open for labour work' })
    return
  }

  const labourCharge = round2(body.data.labourCharge)
  // Without spare: collect = labour charge
  const customerCharge = labourCharge
  const margin = round2(
    customerCharge - Number(existing.spareCost) - labourCharge - Number(existing.subcontractCost),
  )

  const updated = await prisma.serviceJob.update({
    where: { id: existing.id },
    data: {
      type: ServiceType.SELF_LABOUR,
      labourCharge,
      customerCharge,
      margin,
      timeMinutes: body.data.timeMinutes,
      status: 'READY',
    },
    include: jobInclude,
  })
  res.json(updated)
})

/** Send to subcontractor — amt given now */
servicesRouter.post('/:id/subcontract', async (req, res) => {
  const body = z
    .object({
      subcontractorName: z.string().min(1),
      amountGiven: z.number().nonnegative(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const existing = await prisma.serviceJob.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }
  if (!['BOOKED', 'RECEIVED', 'IN_PROGRESS'].includes(existing.status)) {
    res.status(400).json({ error: 'Ticket is not open to send for subcontract' })
    return
  }

  const amountGiven = round2(body.data.amountGiven)
  const updated = await prisma.serviceJob.update({
    where: { id: existing.id },
    data: {
      type: ServiceType.SUBCONTRACT,
      subcontractorName: body.data.subcontractorName.trim(),
      subcontractCost: amountGiven,
      margin: round2(
        Number(existing.customerCharge) -
          Number(existing.spareCost) -
          Number(existing.labourCharge) -
          amountGiven,
      ),
      status: 'AT_SUBCONTRACT',
    },
    include: jobInclude,
  })
  res.json(updated)
})

/** Subcontract returned — final cost + charge customer → READY */
servicesRouter.post('/:id/subcontract-return', async (req, res) => {
  const body = z
    .object({
      subcontractCost: z.number().nonnegative(),
      labourCharge: z.number().nonnegative().default(0),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const existing = await prisma.serviceJob.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }
  if (existing.status !== 'AT_SUBCONTRACT') {
    res.status(400).json({ error: 'Ticket is not at subcontractor' })
    return
  }

  const subcontractCost = round2(body.data.subcontractCost)
  const labourCharge = round2(body.data.labourCharge)
  // Total from customer = our labour + final sub cost
  const customerCharge = round2(labourCharge + subcontractCost)
  const margin = round2(customerCharge - Number(existing.spareCost) - labourCharge - subcontractCost)

  const updated = await prisma.serviceJob.update({
    where: { id: existing.id },
    data: {
      subcontractCost,
      customerCharge,
      labourCharge,
      margin,
      status: 'READY',
    },
    include: jobInclude,
  })
  res.json(updated)
})

/** Delivery — collect balance, mark DELIVERED */
servicesRouter.post('/:id/deliver', async (req, res) => {
  const body = z
    .object({
      collectAmount: z.number().nonnegative().optional(),
      paymentMode: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const existing = await loadJob(req.params.id)
  if (!existing) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }
  if (existing.status !== 'READY') {
    res.status(400).json({ error: 'Only READY tickets can be delivered' })
    return
  }

  const charge = Number(existing.customerCharge)
  const alreadyPaid = Number(existing.paidAmount)
  const due = Math.max(round2(charge - alreadyPaid), 0)
  const collect =
    body.data.collectAmount !== undefined ? round2(body.data.collectAmount) : due
  const paidAmount = round2(alreadyPaid + collect)

  const updated = await prisma.serviceJob.update({
    where: { id: existing.id },
    data: {
      paidAmount,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
    include: jobInclude,
  })
  res.json(updated)
})

servicesRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      status: z.string().optional(),
      customerCharge: z.number().nonnegative().optional(),
      labourCharge: z.number().nonnegative().optional(),
      subcontractCost: z.number().nonnegative().optional(),
      issue: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const existing = await prisma.serviceJob.findUnique({ where: { id: req.params.id } })
  if (!existing) {
    res.status(404).json({ error: 'Service job not found' })
    return
  }

  const labourCharge = body.data.labourCharge ?? Number(existing.labourCharge)
  const subcontractCost = body.data.subcontractCost ?? Number(existing.subcontractCost)
  const customerCharge = body.data.customerCharge ?? Number(existing.customerCharge)
  const margin = round2(customerCharge - Number(existing.spareCost) - labourCharge - subcontractCost)

  const updated = await prisma.serviceJob.update({
    where: { id: req.params.id },
    data: {
      status: body.data.status,
      labourCharge,
      subcontractCost,
      customerCharge,
      margin,
      issue: body.data.issue,
      deliveredAt:
        body.data.status === 'DELIVERED' ? new Date() : undefined,
    },
    include: jobInclude,
  })
  res.json(updated)
})
