import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../services/grade.service'
import { BulletinService } from '../services/bulletin.service'
import { ok, fail } from '@sgsi/shared'

export function registerGradesIpc(db: PrismaClient): void {
  const grades = new GradeService(db)
  const bulletins = new BulletinService(db)

  ipcMain.handle('grades:list', async (_, enrollmentId: string, period: number) => {
    try { return ok(await grades.listByEnrollment(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:save', async (_, data, actorId: string) => {
    try { return ok(await grades.save(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:averages', async (_, enrollmentId: string, period: number) => {
    try { return ok(await grades.computeAverages(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:ranking', async (_, classId: string, period: number) => {
    try { return ok(await grades.computeClassRankings(classId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:lock', async (_, enrollmentId: string, period: number, actorId: string) => {
    try { await grades.lockGrades(enrollmentId, period, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:generate', async (_, enrollmentId: string, period: number, actorId: string) => {
    try { return ok(await bulletins.generate(enrollmentId, period, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:validate', async (_, bulletinId: string, directorId: string) => {
    try { return ok(await bulletins.validate(bulletinId, directorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:list', async (_, enrollmentId: string) => {
    try { return ok(await bulletins.findByEnrollment(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
