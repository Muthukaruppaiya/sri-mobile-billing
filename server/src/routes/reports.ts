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

  const [
    purchases,
    products,
    phones,
    pendingPurchases,
    suppliers,
    customers,
    sales,
    customersPayable,
    pendingSales,
    servicesDelivered,
    servicesBooked,
    serviceOpen,
    serviceReady,
    payments,
  ] = await Promise.all([
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
    prisma.customer.findMany({
      where: { payableBalance: { gt: 0 } },
      orderBy: { payableBalance: 'desc' },
    }),
    prisma.sale.findMany({
      where: { creditAmount: { gt: 0 } },
      include: { customer: true },
      orderBy: { saleDate: 'desc' },
      take: 50,
    }),
    prisma.serviceJob.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: from, lte: to } },
      select: { customerCharge: true, margin: true, paidAmount: true },
    }),
    prisma.serviceJob.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.serviceJob.count({
      where: { status: { in: ['BOOKED', 'RECEIVED', 'IN_PROGRESS', 'AT_SUBCONTRACT'] } },
    }),
    prisma.serviceJob.count({ where: { status: 'READY' } }),
    prisma.payment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { refType: true, mode: true, amount: true },
    }),
  ])

  const cashIn: Record<string, number> = {}
  const cashOut: Record<string, number> = {}
  for (const p of payments) {
    const amt = Number(p.amount)
    const bucket = p.refType === 'PURCHASE' ? cashOut : cashIn
    // Refunds are stored as negative service payments
    if (amt < 0) cashOut[p.mode] = (cashOut[p.mode] || 0) - amt
    else bucket[p.mode] = (bucket[p.mode] || 0) + amt
  }
  const sum = (o: Record<string, number>) => Object.values(o).reduce((s, n) => s + n, 0)

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
      creditTotal: sales.reduce((s, p) => s + Number(p.creditAmount), 0),
    },
    service: {
      booked: servicesBooked,
      delivered: servicesDelivered.length,
      revenue: servicesDelivered.reduce((s, j) => s + Number(j.customerCharge), 0),
      margin: servicesDelivered.reduce((s, j) => s + Number(j.margin), 0),
      open: serviceOpen,
      ready: serviceReady,
    },
    cashbook: {
      in: cashIn,
      out: cashOut,
      totalIn: sum(cashIn),
      totalOut: sum(cashOut),
      net: sum(cashIn) - sum(cashOut),
    },
    credit: {
      pendingBills: pendingPurchases.length,
      pendingAmount: pendingPurchases.reduce((s, p) => s + Number(p.creditAmount), 0),
      bills: pendingPurchases,
      suppliers,
      /** Customers who owe the shop (sale / service credit) */
      customers,
      /** Customers the shop still owes (used phone buy-in) */
      customersPayable,
      saleBills: pendingSales,
      receivableAmount: customers.reduce((s, c) => s + Number(c.creditBalance), 0),
    },
  })
})
