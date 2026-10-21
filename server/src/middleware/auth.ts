import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'

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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  try {
    req.user = jwt.verify(token, secret()) as AuthUser
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Admin only' })
    return
  }
  next()
}
