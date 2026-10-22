import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { zodMessage } from '../lib/http.js'
import { findCustomerByPhone, normalizePhone } from '../lib/customers.js'
import { requireAuth } from '../middleware/auth.js'

export const customersRouter = Router()
customersRouter.use(requireAuth)

function digitsOnly(s: string | null | undefined) {
  return String(s || '').replace(/\D/g, '')
}

function last10(s: string | null | undefined) {
  return digitsOnly(s).slice(-10)
}

function phoneMatches(stored: string | null | undefined, needle: string) {
  const d = digitsOnly(stored)
  if (!d || !needle) return false
  if (needle.length >= 10) return last10(d) === last10(needle)
  return d.includes(needle) || last10(d).includes(needle)
}

customersRouter.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim()
  const phone = String(req.query.phone || '').trim()
  const needle = digitsOnly(phone || q)
  const lookingPhone = needle.length >= 3

  const list = await prisma.customer.findMany({
    where: { active: true },
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    take: 400,
  })

  if (!phone && !q) {
    res.json(list.slice(0, 300))
    return
  }

  const qLower = q.toLowerCase()
  const filtered = list.filter((c) => {
    if (lookingPhone && (phoneMatches(c.phone, needle) || phoneMatches(c.altPhone, needle))) {
      return true
    }
    if (!phone && q) {
      const blob = `${c.name} ${c.phone || ''} ${c.altPhone || ''} ${c.city || ''}`.toLowerCase()
      if (qLower.split(/\s+/).every((t) => blob.includes(t))) return true
    }
    return false
  })

  res.json(filtered.slice(0, 20))
})

customersRouter.get('/:id', async (req, res) => {
  const c = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!c) {
    res.status(404).json({ error: 'Customer not found' })
    return
  }
  res.json(c)
})

customersRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
      altPhone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      gstin: z.string().optional(),
      notes: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  const phone = normalizePhone(body.data.phone)
  if (phone) {
    const existing = await findCustomerByPhone(prisma, phone)
    if (existing) {
      res.status(409).json({
        error: `${existing.name} already uses this phone number`,
        customer: existing,
      })
      return
    }
  }

  const created = await prisma.customer.create({
    data: {
      name: body.data.name.trim(),
      phone: phone || undefined,
      altPhone: normalizePhone(body.data.altPhone) || undefined,
      address: body.data.address?.trim() || undefined,
      city: body.data.city?.trim() || undefined,
      gstin: body.data.gstin?.trim() || undefined,
      notes: body.data.notes?.trim() || undefined,
    },
  })
  res.status(201).json(created)
})

customersRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      phone: z.string().nullable().optional(),
      altPhone: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      gstin: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  const data = { ...body.data }
  if (data.phone !== undefined) data.phone = data.phone ? normalizePhone(data.phone) : null
  if (data.altPhone !== undefined) data.altPhone = data.altPhone ? normalizePhone(data.altPhone) : null
  if (data.name !== undefined) data.name = data.name.trim()

  if (data.phone) {
    const clash = await findCustomerByPhone(prisma, data.phone)
    if (clash && clash.id !== req.params.id) {
      res.status(409).json({ error: `${clash.name} already uses this phone number` })
      return
    }
  }

  try {
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data,
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: 'Customer not found' })
  }
})

/** Everything billed to one customer — sales, service tickets and buy-ins. */
customersRouter.get('/:id/history', async (req, res) => {
  const id = req.params.id
  const [customer, sales, services, purchases] = await Promise.all([
    prisma.customer.findUnique({ where: { id } }),
    prisma.sale.findMany({
      where: { customerId: id },
      orderBy: { saleDate: 'desc' },
      take: 50,
      include: { items: { include: { product: true, phoneUnit: true } } },
    }),
    prisma.serviceJob.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.purchase.findMany({
      where: { customerId: id },
      orderBy: { purchaseDate: 'desc' },
      take: 50,
      include: { items: { include: { product: true } } },
    }),
  ])
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' })
    return
  }
  res.json({ customer, sales, services, purchases })
})
