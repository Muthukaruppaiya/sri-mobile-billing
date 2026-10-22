import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { zodMessage } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const suppliersRouter = Router()
suppliersRouter.use(requireAuth)

suppliersRouter.get('/', async (_req, res) => {
  const list = await prisma.supplier.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  res.json(list)
})

suppliersRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
      gstin: z.string().optional(),
      address: z.string().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  const created = await prisma.supplier.create({ data: body.data })
  res.status(201).json(created)
})

suppliersRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      gstin: z.string().optional(),
      address: z.string().optional(),
      active: z.boolean().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  const updated = await prisma.supplier.update({
    where: { id: req.params.id },
    data: body.data,
  })
  res.json(updated)
})
