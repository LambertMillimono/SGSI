import { Router } from 'express'
import type { Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'

export function paymentRoutes(db: PrismaClient): Router {
  const router = Router()

  // GET /api/payments/student/:enrollmentId
  router.get('/student/:enrollmentId', async (req: Request, res: Response) => {
    try {
      const payments = await db.payment.findMany({
        where: { enrollmentId: req.params.enrollmentId },
        include: { feeType: true },
        orderBy: { paidAt: 'desc' },
      })
      res.json({ payments })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
