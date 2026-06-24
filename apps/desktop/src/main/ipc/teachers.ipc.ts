import { ipcMain } from 'electron'
import { ok, fail } from '@sgsi/shared'
import { TeacherService } from '../services/teacher.service'
import type { PrismaClient } from '@prisma/client'

export function registerTeachersIpc(db: PrismaClient): void {
  const svc = new TeacherService(db)

  ipcMain.handle('teachers:list', async () => {
    try { return ok(await svc.list()) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:getById', async (_, id: string) => {
    try { return ok(await svc.getById(id)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:create', async (_, data: any, actorId: string) => {
    try { return ok(await svc.create(data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:update', async (_, id: string, data: any, actorId: string) => {
    try { return ok(await svc.update(id, data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:delete', async (_, id: string, actorId: string) => {
    try { await svc.delete(id, actorId); return ok(null) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:listSalaries', async (_, teacherId: string) => {
    try { return ok(await svc.listSalaries(teacherId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:createSalary', async (_, data: any, actorId: string) => {
    try { return ok(await svc.createSalary(data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:markSalaryPaid', async (_, salaryId: string, actorId: string) => {
    try { return ok(await svc.markSalaryPaid(salaryId, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })
}
