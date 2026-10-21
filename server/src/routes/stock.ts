import { Router } from 'express'
import { PhoneStatus } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

export const stockRouter = Router()
stockRouter.use(requireAuth)

stockRouter.get('/', async (_req, res) => {
  const [products, phones] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.phoneUnit.findMany({
      where: { status: PhoneStatus.IN_STOCK },
      include: { product: true },
      orderBy: { purchasedAt: 'desc' },
      take: 200,
    }),
  ])
  res.json({ products, phones })
})
