import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { syncPhoneCatalog } from '../lib/syncCatalog.js'

export const catalogRouter = Router()
catalogRouter.use(requireAuth)

catalogRouter.get('/brands', async (_req, res) => {
  const list = await prisma.catalogBrand.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { _count: { select: { models: true } } },
  })
  res.json(
    list.map((b) => ({
      id: b.id,
      name: b.name,
      modelCount: b._count.models,
    })),
  )
})

catalogRouter.get('/models', async (req, res) => {
  const brand = String(req.query.brand || '').trim()
  if (!brand) {
    res.json([])
    return
  }
  const row = await prisma.catalogBrand.findFirst({
    where: { active: true, name: { equals: brand, mode: 'insensitive' } },
    include: { models: { where: { active: true }, orderBy: { name: 'asc' } } },
  })
  res.json((row?.models || []).map((m) => ({ id: m.id, name: m.name, brand: row!.name })))
})

catalogRouter.post('/brands', async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1) }).safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Brand name required' })
    return
  }
  const name = body.data.name
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const brand = await prisma.catalogBrand.upsert({
    where: { slug },
    update: { name, active: true },
    create: { name, slug, source: 'manual' },
  })
  res.status(201).json({ id: brand.id, name: brand.name, modelCount: 0 })
})

catalogRouter.post('/models', async (req, res) => {
  const body = z
    .object({ brand: z.string().trim().min(1), name: z.string().trim().min(1) })
    .safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ error: 'Brand and model required' })
    return
  }
  const brandName = body.data.brand
  const slug = brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const brand = await prisma.catalogBrand.upsert({
    where: { slug },
    update: { name: brandName, active: true },
    create: { name: brandName, slug, source: 'manual' },
  })
  const model = await prisma.catalogModel.upsert({
    where: { brandId_name: { brandId: brand.id, name: body.data.name } },
    update: { active: true },
    create: { brandId: brand.id, name: body.data.name, source: 'manual' },
  })
  res.status(201).json({ id: model.id, name: model.name, brand: brand.name })
})

catalogRouter.post('/sync', requireAdmin, async (_req, res) => {
  try {
    const result = await syncPhoneCatalog()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'Catalog sync failed' })
  }
})
