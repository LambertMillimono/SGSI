import { ipcMain } from 'electron'
import { ok, fail } from '@sgsi/shared'
import { TeacherService } from '../services/teacher.service'
import type { PrismaClient } from '@prisma/client'
import { withAuth, withRole } from '../ipc-guard'

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

  ipcMain.handle('teachers:create', withRole('DIRECTOR', async (_, data: any, actorId: string) => {
    try { return ok(await svc.create(data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))

  ipcMain.handle('teachers:update', withAuth(async (_, id: string, data: any, actorId: string) => {
    try { return ok(await svc.update(id, data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))

  ipcMain.handle('teachers:delete', withRole('DIRECTOR', async (_, id: string, actorId: string) => {
    try { await svc.delete(id, actorId); return ok(null) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))

  ipcMain.handle('teachers:listSalaries', async (_, teacherId: string) => {
    try { return ok(await svc.listSalaries(teacherId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('teachers:createSalary', withRole('ACCOUNTANT', async (_, data: any, actorId: string) => {
    try { return ok(await svc.createSalary(data, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))

  ipcMain.handle('teachers:markSalaryPaid', withRole('ACCOUNTANT', async (_, salaryId: string, actorId: string) => {
    try { return ok(await svc.markSalaryPaid(salaryId, actorId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))

  ipcMain.handle('teachers:getSalaryReceipt', withAuth(async (_, salaryId: string) => {
    try { return ok(await svc.getSalaryReceipt(salaryId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  }))
}
