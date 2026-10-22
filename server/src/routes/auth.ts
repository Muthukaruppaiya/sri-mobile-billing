import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../prisma.js'
import { requireAuth, signToken } from '../middleware/auth.js'
import { distanceMeters } from '../lib/geo.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const body = z
    .object({
      username: z.string().min(1),
      password: z.string().min(1),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: 'Invalid credentials payload' })
    return
  }

  const employee = await prisma.employee.findUnique({
    where: { username: body.data.username.trim().toLowerCase() },
  })

  if (!employee || !employee.active) {
    res.status(401).json({ error: 'Invalid username or password' })
    return
  }

  const ok = await bcrypt.compare(body.data.password, employee.passwordHash)
  if (!ok) {
    res.status(401).json({ error: 'Invalid username or password' })
    return
  }

  // Admin is never geo-restricted. Employees are when geo login is enabled.
  if (employee.role !== 'ADMIN') {
    const settings = await prisma.appSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default' },
      update: {},
    })

    if (settings.geoLoginEnabled) {
      if (settings.geoLatitude == null || settings.geoLongitude == null) {
        res.status(403).json({
          error: 'Location login is enabled but shop location is not configured. Contact admin.',
        })
        return
      }
      if (body.data.latitude == null || body.data.longitude == null) {
        res.status(403).json({
          error: 'Location required. Allow GPS and try again.',
          code: 'GEO_REQUIRED',
        })
        return
      }

      const dist = distanceMeters(
        body.data.latitude,
        body.data.longitude,
        settings.geoLatitude,
        settings.geoLongitude,
      )
      if (dist > settings.geoRadiusMeters) {
        res.status(403).json({
          error: `Outside shop area (${Math.round(dist)} m away). Login allowed within ${settings.geoRadiusMeters} m.`,
          code: 'GEO_OUTSIDE',
          distanceMeters: Math.round(dist),
        })
        return
      }
    }
  }

  const payload = {
    id: employee.id,
    username: employee.username,
    role: employee.role,
    name: employee.name,
  }
  await prisma.employee.update({ where: { id: employee.id }, data: { lastLoginAt: new Date() } })
  const token = signToken(payload)
  res.json({ token, user: payload })
})

authRouter.get('/me', requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, username: true, role: true, phone: true, active: true },
  })
  if (!employee || !employee.active) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  res.json({ user: employee })
})

authRouter.post('/logout', (_req, res) => {
  res.json({ ok: true })
})
