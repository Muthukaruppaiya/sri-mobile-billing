import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { prisma } from '../prisma.js'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { normalizePhone } from '../lib/customers.js'

export const employeesRouter = Router()

employeesRouter.use(requireAuth, requireAdmin)

const employeeSelect = {
  id: true,
  name: true,
  phone: true,
  username: true,
  role: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { sales: true, purchases: true, serviceJobs: true } },
} as const

const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username needs at least 3 characters')
  .max(32)
  .regex(/^[a-z0-9._-]+$/, 'Username: letters, numbers, dot, dash or underscore only')

const passwordSchema = z.string().min(4, 'Password needs at least 4 characters').max(64)

function firstError(err: z.ZodError) {
  return err.issues[0]?.message || 'Invalid input'
}

employeesRouter.get('/', async (_req, res) => {
  const list = await prisma.employee.findMany({
    orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: employeeSelect,
  })
  res.json(list)
})

employeesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1, 'Enter name'),
      phone: z.string().optional(),
      username: usernameSchema,
      password: passwordSchema,
      role: z.nativeEnum(Role).default(Role.EMPLOYEE),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: firstError(body.error) })
    return
  }

  const exists = await prisma.employee.findUnique({ where: { username: body.data.username } })
  if (exists) {
    res.status(409).json({ error: `Username "${body.data.username}" is already taken` })
    return
  }

  const passwordHash = await bcrypt.hash(body.data.password, 10)
  const created = await prisma.employee.create({
    data: {
      name: body.data.name,
      phone: normalizePhone(body.data.phone) || undefined,
      username: body.data.username,
      passwordHash,
      role: body.data.role,
    },
    select: employeeSelect,
  })
  res.status(201).json(created)
})

employeesRouter.patch('/:id', async (req, res) => {
  const body = z
    .object({
      name: z.string().trim().min(1, 'Enter name').optional(),
      phone: z.string().nullable().optional(),
      role: z.nativeEnum(Role).optional(),
      active: z.boolean().optional(),
      password: passwordSchema.optional(),
    })
    .safeParse(req.body)

  if (!body.success) {
    res.status(400).json({ error: firstError(body.error) })
    return
  }

  const target = await prisma.employee.findUnique({ where: { id: req.params.id } })
  if (!target) {
    res.status(404).json({ error: 'Employee not found' })
    return
  }

  const isSelf = target.id === req.user!.id
  const losingAdmin =
    target.role === Role.ADMIN &&
    target.active &&
    (body.data.active === false || (body.data.role && body.data.role !== Role.ADMIN))

  if (isSelf && body.data.active === false) {
    res.status(400).json({ error: 'You cannot deactivate your own login' })
    return
  }
  if (isSelf && body.data.role && body.data.role !== Role.ADMIN) {
    res.status(400).json({ error: 'You cannot remove your own admin role' })
    return
  }
  if (losingAdmin) {
    const otherAdmins = await prisma.employee.count({
      where: { role: Role.ADMIN, active: true, id: { not: target.id } },
    })
    if (otherAdmins === 0) {
      res.status(400).json({ error: 'At least one active admin is required' })
      return
    }
  }

  const { password, phone, ...rest } = body.data
  const updated = await prisma.employee.update({
    where: { id: target.id },
    data: {
      ...rest,
      ...(phone !== undefined ? { phone: phone ? normalizePhone(phone) : null } : {}),
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
    },
    select: employeeSelect,
  })
  res.json(updated)
})
