import { Router } from 'express'
import type { Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../../services/grade.service'
import { AbsenceService } from '../../services/absence.service'
import { BulletinService } from '../../services/bulletin.service'

export function studentRoutes(db: PrismaClient): Router {
  const router = Router()
  const gradeService = new GradeService(db)
  const absenceService = new AbsenceService(db)
  const bulletinService = new BulletinService(db)

  // GET /api/student/:id/grades?period=1
  router.get('/:id/grades', async (req: Request, res: Response) => {
    try {
      const period = Number(req.query.period ?? 1)
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: 'ACTIVE' },
      })
      if (!enrollment) {
        res.status(404).json({ error: 'Inscription introuvable' })
        return
      }
      const { subjectAverages, generalAverage, isEliminated } =
        await gradeService.computeAverages(enrollment.id, period)
      res.json({ subjectAverages, generalAverage, isEliminated, period })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/student/:id/absences
  router.get('/:id/absences', async (req: Request, res: Response) => {
    try {
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: 'ACTIVE' },
      })
      if (!enrollment) {
        res.status(404).json({ error: 'Inscription introuvable' })
        return
      }
      const [absences, counts] = await Promise.all([
        absenceService.listByEnrollment(enrollment.id),
        absenceService.countByEnrollment(enrollment.id),
      ])
      res.json({ absences, counts })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/student/:id/bulletin/:period
  router.get('/:id/bulletin/:period', async (req: Request, res: Response) => {
    try {
      const period = Number(req.params.period)
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: 'ACTIVE' },
      })
      if (!enrollment) {
        res.status(404).json({ error: 'Inscription introuvable' })
        return
      }
      const actorId = req.user?.userId ?? 'mobile'
      const result = await bulletinService.generate(enrollment.id, period, actorId)
      res.json(result)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // GET /api/student/:id/payments
  router.get('/:id/payments', async (req: Request, res: Response) => {
    try {
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: 'ACTIVE' },
        include: { payments: { include: { feeType: true } } },
      })
      if (!enrollment) {
        res.status(404).json({ error: 'Inscription introuvable' })
        return
      }
      res.json({ payments: enrollment.payments })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
