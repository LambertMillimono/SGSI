import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.service'

export function authRoutes(db: PrismaClient, jwtSecret: string): Router {
  const router = Router()
  const auth = new AuthService(db, jwtSecret)

  // Mobile login — parents use student matricule as username + their access code as password
  // Teachers use their normal username + password
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body as { username: string; password: string }
      if (!username || !password) {
        res.status(400).json({ error: 'username et password requis' })
        return
      }
      const result = await auth.login(username, password)
      res.json(result)
    } catch (e: any) {
      res.status(401).json({ error: e.message })
    }
  })

  return router
}
