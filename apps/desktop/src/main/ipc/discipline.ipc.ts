import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

export const DISC_TYPES: Record<string, { label: string; color: string; severity: number }> = {
  AVERTISSEMENT:   { label: 'Avertissement',          color: '#F59E0B', severity: 1 },
  BLAME:           { label: 'Blâme',                  color: '#F97316', severity: 2 },
  CONVOCATION:     { label: 'Convocation parents',    color: '#6366F1', severity: 2 },
  EXCLUSION_TEMP:  { label: 'Exclusion temporaire',   color: '#DC2626', severity: 3 },
  EXCLUSION_DEF:   { label: 'Exclusion définitive',   color: '#7F1D1D', severity: 4 },
  AUTRE:           { label: 'Autre mesure',            color: '#6B7280', severity: 1 },
}

export function registerDisciplineIpc(db: PrismaClient): void {

  // List all records for a student
  ipcMain.handle('discipline:listByStudent', async (_, studentId: string) => {
    try {
      return ok(await db.disciplinaryRecord.findMany({
        where: { studentId },
        include: { student: { select: { firstName: true, lastName: true, matricule: true } } },
        orderBy: { date: 'desc' },
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // List all records (admin view, paginated)
  ipcMain.handle('discipline:listAll', async (_, filters?: { resolved?: boolean; type?: string; limit?: number }) => {
    try {
      return ok(await db.disciplinaryRecord.findMany({
        where: {
          ...(filters?.resolved !== undefined ? { resolved: filters.resolved } : {}),
          ...(filters?.type ? { type: filters.type } : {}),
        },
        include: {
          student: {
            select: { firstName: true, lastName: true, matricule: true },
            include: { enrollments: { where: { status: 'ACTIVE' }, include: { class: { select: { name: true } } }, take: 1 } },
          },
        },
        orderBy: { date: 'desc' },
        take: filters?.limit ?? 100,
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Create a new disciplinary record
  ipcMain.handle('discipline:create', async (_, data: {
    studentId:   string
    type:        string
    description: string
    sanction?:   string
    note?:       string
    date?:       string
  }, issuedBy: string) => {
    try {
      const rec = await db.disciplinaryRecord.create({
        data: {
          studentId:   data.studentId,
          type:        data.type,
          description: data.description,
          sanction:    data.sanction ?? null,
          note:        data.note ?? null,
          issuedBy,
          date:        data.date ? new Date(data.date) : new Date(),
        },
        include: { student: { select: { firstName: true, lastName: true } } },
      })
      // Audit log (non-fatal)
      try {
        await db.auditLog.create({
          data: { userId: issuedBy, action: 'CREATE', entity: 'discipline', entityId: rec.id, details: `type:${data.type}` },
        })
      } catch { /* non-fatal */ }
      return ok(rec)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Mark as resolved
  ipcMain.handle('discipline:resolve', async (_, id: string, note?: string) => {
    try {
      return ok(await db.disciplinaryRecord.update({
        where: { id },
        data: { resolved: true, resolvedAt: new Date(), note: note ?? null },
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Delete a record
  ipcMain.handle('discipline:delete', async (_, id: string) => {
    try {
      await db.disciplinaryRecord.delete({ where: { id } })
      return ok(null)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Stats: count by type for a student
  ipcMain.handle('discipline:stats', async (_, studentId: string) => {
    try {
      const records = await db.disciplinaryRecord.findMany({ where: { studentId } })
      const byType: Record<string, number> = {}
      records.forEach(r => { byType[r.type] = (byType[r.type] ?? 0) + 1 })
      return ok({ total: records.length, active: records.filter(r => !r.resolved).length, byType })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // Global stats for dashboard
  ipcMain.handle('discipline:globalStats', async () => {
    try {
      const [total, active, recent] = await Promise.all([
        db.disciplinaryRecord.count(),
        db.disciplinaryRecord.count({ where: { resolved: false } }),
        db.disciplinaryRecord.findMany({
          where: { resolved: false },
          include: {
            student: {
              select: { firstName: true, lastName: true, matricule: true },
              include: { enrollments: { where: { status: 'ACTIVE' }, include: { class: { select: { name: true } } }, take: 1 } },
            },
          },
          orderBy: { date: 'desc' },
          take: 5,
        }),
      ])
      return ok({ total, active, recent })
    } catch (e: any) { return fail('ERROR', e.message) }
  })
}
