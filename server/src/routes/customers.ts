import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
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
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const phone = body.data.phone?.trim()
  if (phone) {
    const existing = await prisma.customer.findFirst({
      where: {
        active: true,
        OR: [{ phone }, { altPhone: phone }],
      },
    })
    if (existing) {
      res.status(409).json({
        error: 'Customer with this phone already exists',
        customer: existing,
      })
      return
    }
  }

  const created = await prisma.customer.create({
    data: {
      name: body.data.name.trim(),
      phone: phone || undefined,
      altPhone: body.data.altPhone?.trim() || undefined,
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
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  try {
    const updated = await prisma.customer.update({
      where: { id: req.params.id },
      data: body.data,
    })
    res.json(updated)
  } catch {
    res.status(404).json({ error: 'Customer not found' })
  }
})
