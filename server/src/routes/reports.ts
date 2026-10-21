import { Router } from 'express'
import { prisma } from '../prisma.js'
import { requireAuth } from '../middleware/auth.js'

export const reportsRouter = Router()
reportsRouter.use(requireAuth)

reportsRouter.get('/stock-value', async (_req, res) => {
  const products = await prisma.product.findMany({ where: { active: true } })
  const phones = await prisma.phoneUnit.findMany({ where: { status: 'IN_STOCK' } })

  const productValue = products.reduce((s, p) => {
    const price = Number(p.sellPrice || p.mrp || 0)
    return s + price * p.stockQty
  }, 0)

  const phoneCostValue = phones.reduce((s, p) => s + Number(p.cost), 0)

  res.json({
    skuCount: products.length,
    unitsInStock: products.reduce((s, p) => s + p.stockQty, 0),
    phoneUnits: phones.length,
    stockSellValue: Math.round(productValue),
    phoneCostValue: Math.round(phoneCostValue),
  })
})

reportsRouter.get('/purchases-summary', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0))
  const to = req.query.to ? new Date(String(req.query.to)) : new Date()

  const purchases = await prisma.purchase.findMany({
    where: { purchaseDate: { gte: from, lte: to } },
    include: { supplier: true, customer: true },
  })

  const byType: Record<string, { count: number; total: number; credit: number }> = {}
  for (const p of purchases) {
    const key = p.type
    if (!byType[key]) byType[key] = { count: 0, total: 0, credit: 0 }
    byType[key].count += 1
    byType[key].total += Number(p.grandTotal)
    byType[key].credit += Number(p.creditAmount)
  }

  res.json({
    from,
    to,
    count: purchases.length,
    grandTotal: purchases.reduce((s, p) => s + Number(p.grandTotal), 0),
    paidTotal: purchases.reduce((s, p) => s + Number(p.paidAmount), 0),
    creditTotal: purchases.reduce((s, p) => s + Number(p.creditAmount), 0),
    byType,
  })
})

reportsRouter.get('/overview', async (req, res) => {
  const from = req.query.from ? new Date(String(req.query.from)) : new Date(new Date().setHours(0, 0, 0, 0))
  const to = req.query.to ? new Date(String(req.query.to)) : new Date()

  const [purchases, products, phones, pendingPurchases, suppliers, customers, sales] = await Promise.all([
    prisma.purchase.findMany({
      where: { purchaseDate: { gte: from, lte: to } },
      include: { supplier: true, customer: true },
      orderBy: { purchaseDate: 'desc' },
    }),
    prisma.product.findMany({ where: { active: true } }),
    prisma.phoneUnit.findMany({ where: { status: 'IN_STOCK' } }),
    prisma.purchase.findMany({
      where: { creditAmount: { gt: 0 } },
      include: { supplier: true, customer: true },
      orderBy: { purchaseDate: 'desc' },
      take: 50,
    }),
    prisma.supplier.findMany({ where: { creditBalance: { gt: 0 } }, orderBy: { creditBalance: 'desc' } }),
    prisma.customer.findMany({ where: { creditBalance: { gt: 0 } }, orderBy: { creditBalance: 'desc' } }),
    prisma.sale.findMany({
      where: { saleDate: { gte: from, lte: to } },
      include: { financePlan: true },
    }),
  ])

  const byType: Record<string, { count: number; total: number; credit: number }> = {}
  for (const p of purchases) {
    const key = p.type
    if (!byType[key]) byType[key] = { count: 0, total: 0, credit: 0 }
    byType[key].count += 1
    byType[key].total += Number(p.grandTotal)
    byType[key].credit += Number(p.creditAmount)
  }

  const stockSellValue = products.reduce((s, p) => s + Number(p.sellPrice || p.mrp || 0) * p.stockQty, 0)
  const phoneCostValue = phones.reduce((s, p) => s + Number(p.cost), 0)

  res.json({
    from,
    to,
    purchases: {
      count: purchases.length,
      grandTotal: purchases.reduce((s, p) => s + Number(p.grandTotal), 0),
      paidTotal: purchases.reduce((s, p) => s + Number(p.paidAmount), 0),
      creditTotal: purchases.reduce((s, p) => s + Number(p.creditAmount), 0),
      byType,
      recent: purchases.slice(0, 10),
    },
    stock: {
      skuCount: products.length,
      phoneUnits: phones.length,
      stockSellValue: Math.round(stockSellValue),
      phoneCostValue: Math.round(phoneCostValue),
      lowStock: products.filter((p) => p.stockQty <= p.reorderLevel).length,
    },
    sales: {
      count: sales.length,
      grandTotal: sales.reduce((s, p) => s + Number(p.grandTotal), 0),
      cashInHand: sales.reduce((s, p) => s + Number(p.paidAmount), 0),
      financeCount: sales.filter((p) => p.hasFinance).length,
      financeAmount: sales.reduce((s, p) => s + Number(p.financePlan?.financedAmount || 0), 0),
    },
    credit: {
      pendingBills: pendingPurchases.length,
      pendingAmount: pendingPurchases.reduce((s, p) => s + Number(p.creditAmount), 0),
      bills: pendingPurchases,
      suppliers,
      customers,
    },
  })
})
