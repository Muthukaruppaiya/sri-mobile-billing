import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import cors from 'cors'
import express from 'express'
import { authRouter } from './routes/auth.js'
import { employeesRouter } from './routes/employees.js'
import { suppliersRouter } from './routes/suppliers.js'
import { productsRouter } from './routes/products.js'
import { purchasesRouter } from './routes/purchases.js'
import { stockRouter } from './routes/stock.js'
import { reportsRouter } from './routes/reports.js'
import { customersRouter } from './routes/customers.js'
import { salesRouter } from './routes/sales.js'
import { servicesRouter } from './routes/services.js'
import { settingsRouter } from './routes/settings.js'
import { catalogRouter } from './routes/catalog.js'
import { prisma } from './prisma.js'
import { syncPhoneCatalog } from './lib/syncCatalog.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const isProd = process.env.NODE_ENV === 'production'

const jwtSecret = process.env.JWT_SECRET || ''
if (isProd && (jwtSecret.length < 16 || jwtSecret.includes('change-me'))) {
  console.error('JWT_SECRET in server/.env must be a long random value in production. Refusing to start.')
  process.exit(1)
}

app.use(
  cors({
    origin: [
      ...(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  }),
)
app.use(express.json({ limit: '2mb' }))

app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }
  next(err)
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sri-mobiles-api' })
})

app.use('/api/auth', authRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/suppliers', suppliersRouter)
app.use('/api/customers', customersRouter)
app.use('/api/products', productsRouter)
app.use('/api/purchases', purchasesRouter)
app.use('/api/sales', salesRouter)
app.use('/api/services', servicesRouter)
app.use('/api/stock', stockRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/catalog', catalogRouter)

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Production: the built React app (../dist) is served from this same port.
const clientDist = path.resolve(process.env.CLIENT_DIST || path.join(process.cwd(), '..', 'dist'))
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '7d' }))
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log(`Serving web app from ${clientDist}`)
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(port, '0.0.0.0', () => {
  console.log(`SRI MOBILES API on http://localhost:${port}`)
  void prisma.catalogBrand.count().then((n) => {
    if (n > 0) return
    console.log('Phone catalog empty — downloading brands/models…')
    return syncPhoneCatalog().then(
      (r) => console.log(`Catalog ready: ${r.brands} brands, ${r.models} models`),
      (e) => console.error('Catalog sync failed:', e instanceof Error ? e.message : e),
    )
  })
})
