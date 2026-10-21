import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'

export const employeesRouter = Router()

employeesRouter.use(requireAuth, requireAdmin)

employeesRouter.get('/', async (_req, res) => {
  const list = await prisma.employee.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      phone: true,
      username: true,
      role: true,
      active: true,
      createdAt: true,
    },
  })
  res.json(list)
})

employeesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      phone: z.string().optional(),
      username: z.string().min(3),
      password: z.string().min(4),
      role: z.nativeEnum(Role).default(Role.EMPLOYEE),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const exists = await prisma.employee.findUnique({ where: { username: body.data.username } })
  if (exists) {
    res.status(409).json({ error: 'Username already exists' })
    return
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10)
  const created = await prisma.employee.create({
    data: {
      name: body.data.name,
      phone: body.data.phone,
      username: body.data.username,
      passwordHash,
      role: body.data.role,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      username: true,
      role: true,
      active: true,
    },
  })
  res.status(201).json(created)
})

employeesRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().min(1).optional(),
      phone: z.string().optional(),
      role: z.nativeEnum(Role).optional(),
      active: z.boolean().optional(),
      password: z.string().min(4).optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: body.error.flatten() })
    return
  }

  const data: Record<string, unknown> = { ...body.data }
  if (body.data.password) {
    data.passwordHash = await bcrypt.hash(body.data.password, 10)
    delete data.password
  }

  const updated = await prisma.employee.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      username: true,
      role: true,
      active: true,
    },
  })
  res.json(updated)
})
