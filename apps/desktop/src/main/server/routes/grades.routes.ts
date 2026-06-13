import { Router } from 'express'
import type { Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../../services/grade.service'
import { AbsenceService } from '../../services/absence.service'

export function teacherRoutes(db: PrismaClient): Router {
  const router = Router()
  const gradeService = new GradeService(db)
  const absenceService = new AbsenceService(db)

  // POST /api/teacher/:id/grades — offline sync (batch)
  router.post('/:id/grades', async (req: Request, res: Response) => {
    try {
      const { grades } = req.body as { grades: any[] }
      if (!Array.isArray(grades)) {
        res.status(400).json({ error: 'grades doit être un tableau' })
        return
      }
      const actorId = req.user?.userId ?? req.params.id
      const saved = await Promise.allSettled(
        grades.map((g) => gradeService.save(g, actorId))
      )
      const succeeded = saved.filter((r) => r.status === 'fulfilled').length
      const failed = saved
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message)

      res.json({ saved: succeeded, failed })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  // POST /api/teacher/:id/absences — offline sync (batch)
  router.post('/:id/absences', async (req: Request, res: Response) => {
    try {
      const { absences } = req.body as { absences: any[] }
      if (!Array.isArray(absences)) {
        res.status(400).json({ error: 'absences doit être un tableau' })
        return
      }
      const actorId = req.user?.userId ?? req.params.id
      const saved = await Promise.allSettled(
        absences.map((a) => absenceService.record(a, actorId))
      )
      const succeeded = saved.filter((r) => r.status === 'fulfilled').length
      const failed = saved
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => r.reason?.message)

      res.json({ saved: succeeded, failed })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return router
}
