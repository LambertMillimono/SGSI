import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

interface MobileTokenPayload {
  userId: string
  username: string
  role: string
  iat: number
  exp: number
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: MobileTokenPayload
    }
  }
}

export function authMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token manquant' })
      return
    }

    try {
      req.user = jwt.verify(header.slice(7), jwtSecret) as MobileTokenPayload
      next()
    } catch {
      res.status(401).json({ error: 'Token invalide ou expiré' })
    }
  }
}
