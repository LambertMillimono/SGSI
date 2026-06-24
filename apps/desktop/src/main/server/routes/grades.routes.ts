import { Router } from 'express'
import type { Request, Response } from 'express'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../../services/grade.service'
import { AbsenceService } from '../../services/absence.service'

export function teacherRoutes(db: PrismaClient): Router {
  const router = Router()
  const gradeService = new GradeService(db)
  const absenceService = new AbsenceService(db)

  // GET /api/teacher/schedule — teacher's schedule for current week
  router.get('/schedule', async (req: Request, res: Response) => {
    try {
      const teacherId = req.user?.userId
      const teacher = await db.teacher.findFirst({ where: { userId: teacherId } })
      if (!teacher) { res.status(404).json({ error: 'Enseignant introuvable' }); return }

      const slots = await db.scheduleSlot.findMany({
        where: { teacherId: teacher.id },
        include: {
          class:   { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      })
      res.json({ slots })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // GET /api/teacher/classes — classes taught by this teacher
  router.get('/classes', async (req: Request, res: Response) => {
    try {
      const teacherId = req.user?.userId
      const teacher = await db.teacher.findFirst({ where: { userId: teacherId } })
      if (!teacher) { res.status(404).json({ error: 'Enseignant introuvable' }); return }

      const classes = await db.class.findMany({
        where: {
          subjects: { some: { teacherId: teacher.id } },
        },
        include: {
          _count: { select: { enrollments: true } },
          level:  { select: { name: true } },
        },
      })
      res.json({ classes })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // GET /api/teacher/classes/:classId/students
  router.get('/classes/:classId/students', async (req: Request, res: Response) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId: req.params.classId, status: 'ACTIVE' },
        include: { student: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
        orderBy: { student: { lastName: 'asc' } },
      })
      res.json({ students: enrollments.map(e => ({ ...e.student, enrollmentId: e.id })) })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/teacher/grades — save grades batch
  router.post('/grades', async (req: Request, res: Response) => {
    try {
      const { grades } = req.body as { grades: any[] }
      if (!Array.isArray(grades)) { res.status(400).json({ error: 'grades doit être un tableau' }); return }
      const actorId = req.user?.userId ?? 'mobile'
      const saved = await Promise.allSettled(grades.map(g => gradeService.save(g, actorId)))
      res.json({ saved: saved.filter(r => r.status === 'fulfilled').length })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/teacher/absences — save absences batch
  router.post('/absences', async (req: Request, res: Response) => {
    try {
      const { absences } = req.body as { absences: any[] }
      if (!Array.isArray(absences)) { res.status(400).json({ error: 'absences doit être un tableau' }); return }
      const actorId = req.user?.userId ?? 'mobile'
      const saved = await Promise.allSettled(absences.map(a => absenceService.record(a, actorId)))
      res.json({ saved: saved.filter(r => r.status === 'fulfilled').length })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // POST /api/teacher/:id/grades — offline sync (batch) [legacy]
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
