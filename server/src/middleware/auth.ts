import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { prisma } from '../prisma.js'

export type AuthUser = {
  id: string
  username: string
  role: Role
  name: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

const secret = () => process.env.JWT_SECRET || 'dev-secret'

export function signToken(user: AuthUser) {
  return jwt.sign(user, secret(), { expiresIn: '7d' })
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  let claims: AuthUser
  try {
    claims = jwt.verify(token, secret()) as AuthUser
  } catch {
    res.status(401).json({ error: 'Invalid token' })
    return
  }
  // Re-read the employee so deactivation / role changes apply immediately, not after token expiry.
  const employee = await prisma.employee.findUnique({
    where: { id: claims.id },
    select: { id: true, username: true, role: true, name: true, active: true },
  })
  if (!employee || !employee.active) {
    res.status(401).json({ error: 'Account disabled. Contact admin.' })
    return
  }
  req.user = { id: employee.id, username: employee.username, role: employee.role, name: employee.name }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin only' })
    return
  }
  next()
}
