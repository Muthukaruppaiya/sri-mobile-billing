import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, requireAdmin } from '../middleware/auth.js'

export const settingsRouter = Router()

const DEFAULT_ID = 'default'

async function getOrCreate() {
  return prisma.appSettings.upsert({
    where: { id: DEFAULT_ID },
    create: { id: DEFAULT_ID },
    update: {},
  })
}

/** Public — only whether geo is required (no coordinates leaked) */
settingsRouter.get('/public', async (_req, res) => {
  const s = await getOrCreate()
  res.json({
    shopName: s.shopName,
    geoLoginEnabled: s.geoLoginEnabled,
  })
})

settingsRouter.use(requireAuth)

settingsRouter.get('/', async (_req, res) => {
  const s = await getOrCreate()
  res.json(s)
})

settingsRouter.patch('/', requireAdmin, async (req, res) => {
  const body = z
    .object({
      shopName: z.string().min(1).optional(),
      shopPhone: z.string().nullable().optional(),
      shopAddress: z.string().nullable().optional(),
      shopCity: z.string().nullable().optional(),
      shopGstin: z.string().nullable().optional(),
      invoicePrefix: z.string().min(1).optional(),
      defaultTaxPercent: z.number().nonnegative().optional(),
      geoLoginEnabled: z.boolean().optional(),
      geoLatitude: z.number().min(-90).max(90).nullable().optional(),
      geoLongitude: z.number().min(-180).max(180).nullable().optional(),
      geoRadiusMeters: z.number().int().positive().max(50000).optional(),
      modulePurchase: z.boolean().optional(),
      moduleSale: z.boolean().optional(),
      moduleService: z.boolean().optional(),
      moduleStock: z.boolean().optional(),
      moduleReports: z.boolean().optional(),
      moduleCustomers: z.boolean().optional(),
      moduleSuppliers: z.boolean().optional(),
      moduleHistory: z.boolean().optional(),
      moduleEmployees: z.boolean().optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const data = body.data
  if (data.geoLoginEnabled === true) {
    const current = await getOrCreate()
    const lat = data.geoLatitude ?? current.geoLatitude
    const lng = data.geoLongitude ?? current.geoLongitude
    if (lat == null || lng == null) {
      res.status(400).json({
        error: 'Set shop latitude & longitude before enabling location login',
      })
      return
    }
  }

  const updated = await prisma.appSettings.update({
    where: { id: DEFAULT_ID },
    data,
  })
  res.json(updated)
})
