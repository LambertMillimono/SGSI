import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

export function registerAbsencesIpc(db: PrismaClient): void {
  // Feuille de présence d'une classe pour une date donnée
  ipcMain.handle('absences:getSheet', async (_, classId: string, date: string) => {
    try {
      const day = new Date(date)
      const start = new Date(day); start.setHours(0, 0, 0, 0)
      const end = new Date(day); end.setHours(23, 59, 59, 999)

      const enrollments = await db.enrollment.findMany({
        where: { classId, status: 'ACTIVE' },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true, gender: true } },
          absences: { where: { date: { gte: start, lte: end } } },
        },
        orderBy: { student: { lastName: 'asc' } },
      })

      return ok(enrollments.map(e => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        gender: e.student.gender,
        absence: e.absences[0] ?? null,
      })))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Sauvegarde la feuille de présence d'une journée
  ipcMain.handle('absences:saveSheet', async (_, records: {
    enrollmentId: string; type: string; justified: boolean; reason?: string
  }[], date: string) => {
    try {
      const day = new Date(date)
      const start = new Date(day); start.setHours(0, 0, 0, 0)
      const end = new Date(day); end.setHours(23, 59, 59, 999)

      for (const r of records) {
        await db.absence.deleteMany({
          where: { enrollmentId: r.enrollmentId, date: { gte: start, lte: end } },
        })
        if (r.type !== 'PRESENT') {
          await db.absence.create({
            data: {
              enrollmentId: r.enrollmentId,
              date: new Date(date),
              type: r.type,
              justified: r.justified ?? false,
              reason: r.reason ?? null,
            },
          })
        }
      }
      return ok({ saved: records.length })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Historique des absences d'un élève
  ipcMain.handle('absences:listByEnrollment', async (_, enrollmentId: string) => {
    try {
      return ok(await db.absence.findMany({
        where: { enrollmentId },
        orderBy: { date: 'desc' },
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Statistiques d'absences d'une classe
  ipcMain.handle('absences:stats', async (_, classId: string) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: 'ACTIVE' },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
          absences: true,
        },
        orderBy: { student: { lastName: 'asc' } },
      })
      return ok(enrollments.map(e => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        total: e.absences.length,
        justified: e.absences.filter(a => a.justified).length,
        unjustified: e.absences.filter(a => !a.justified).length,
        late: e.absences.filter(a => a.type === 'LATE').length,
      })))
    } catch (e: any) { return fail('ERROR', e.message) }
  })
}
