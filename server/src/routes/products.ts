import { Router } from 'express'
import { z } from 'zod'
import { ProductCategory } from '@prisma/client'
import { prisma } from '../prisma.js'
import { zodMessage } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'

export const productsRouter = Router()
productsRouter.use(requireAuth)

productsRouter.get('/', async (req, res) => {
  const category = req.query.category as ProductCategory | undefined
  const q = String(req.query.q || '').trim()

  const list = await prisma.product.findMany({
    where: {
      active: true,
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } },
              { brand: { contains: q, mode: 'insensitive' } },
              { model: { contains: q, mode: 'insensitive' } },
              { ram: { contains: q, mode: 'insensitive' } },
              { rom: { contains: q, mode: 'insensitive' } },
              { color: { contains: q, mode: 'insensitive' } },
              { spareType: { contains: q, mode: 'insensitive' } },
              { spareGrade: { contains: q, mode: 'insensitive' } },
              { specNote: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { name: 'asc' },
  })
  res.json(list)
})

const specFields = {
  ram: z.string().optional(),
  rom: z.string().optional(),
  color: z.string().optional(),
  network: z.string().optional(),
  processor: z.string().optional(),
  spareType: z.string().optional(),
  spareGrade: z.string().optional(),
  specNote: z.string().optional(),
}

productsRouter.post('/', async (req, res) => {
  const body = z
    .object({
      sku: z.string().min(1),
      name: z.string().min(1),
      brand: z.string().min(1),
      model: z.string().optional(),
      category: z.nativeEnum(ProductCategory),
      taxPercent: z.number().nonnegative().default(18),
      mrp: z.number().nonnegative().optional(),
      sellPrice: z.number().nonnegative().optional(),
      reorderLevel: z.number().int().nonnegative().default(2),
      location: z.string().optional(),
      ...specFields,
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  try {
    const created = await prisma.product.create({ data: body.data })
    res.status(201).json(created)
  } catch {
    res.status(409).json({ error: 'SKU already exists' })
  }
})

productsRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      brand: z.string().min(1).optional(),
      model: z.string().optional(),
      taxPercent: z.number().nonnegative().optional(),
      mrp: z.number().nonnegative().nullable().optional(),
      sellPrice: z.number().nonnegative().nullable().optional(),
      reorderLevel: z.number().int().nonnegative().optional(),
      location: z.string().optional(),
      active: z.boolean().optional(),
      ram: z.string().nullable().optional(),
      rom: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
      network: z.string().nullable().optional(),
      processor: z.string().nullable().optional(),
      spareType: z.string().nullable().optional(),
      spareGrade: z.string().nullable().optional(),
      specNote: z.string().nullable().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: zodMessage(body.error) })
    return
  }

  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: body.data,
  })
  res.json(updated)
})
