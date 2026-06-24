import express from 'express'
import type { PrismaClient } from '@prisma/client'
import http from 'http'
import { corsMiddleware } from './middleware/cors.middleware'
import { authMiddleware } from './middleware/auth.middleware'
import { authRoutes } from './routes/auth.routes'
import { studentRoutes } from './routes/students.routes'
import { teacherRoutes } from './routes/grades.routes'
import { paymentRoutes } from './routes/payments.routes'

let server: http.Server | null = null

export async function startExpressServer(db: PrismaClient): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const port = Number(process.env.EXPRESS_PORT ?? 3721)

  const app = express()

  app.use(corsMiddleware)
  app.use(express.json({ limit: '10mb' }))

  // Health check — no auth required
  app.get('/api/status', (_, res) => {
    res.json({
      status: 'ok',
      name: 'SGSI',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    })
  })

  // Auth routes — no auth middleware (this IS the login endpoint)
  app.use('/api/auth', authRoutes(db, jwtSecret))

  // Protected routes — require valid JWT
  const auth = authMiddleware(jwtSecret)
  app.use('/api/student', auth, studentRoutes(db))
  app.use('/api/teacher', auth, teacherRoutes(db))
  app.use('/api/payments', auth, paymentRoutes(db))

  // 404 handler
  app.use((_, res) => {
    res.status(404).json({ error: 'Route introuvable' })
  })

  server = http.createServer(app)

  return new Promise((resolve, reject) => {
    server!.listen(port, '0.0.0.0', () => {
      console.log(`[SGSI] Serveur mobile demarre sur le port ${port}`)
      resolve()
    })
    server!.on('error', reject)
  })
}

export function stopExpressServer(): void {
  if (server) {
    server.close()
    server = null
    console.log('[SGSI] Serveur mobile arrete')
  }
}
