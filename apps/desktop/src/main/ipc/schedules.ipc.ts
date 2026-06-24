import { ipcMain } from 'electron'
import { ok, fail } from '@sgsi/shared'
import { ScheduleService } from '../services/schedule.service'
import type { PrismaClient } from '@prisma/client'

export function registerSchedulesIpc(db: PrismaClient): void {
  const svc = new ScheduleService(db)

  ipcMain.handle('schedules:listByClass', async (_, classId: string) => {
    try { return ok(await svc.listByClass(classId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('schedules:listByTeacher', async (_, teacherId: string) => {
    try { return ok(await svc.listByTeacher(teacherId)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('schedules:create', async (_, data: any) => {
    try { return ok(await svc.create(data)) }
    catch (e: any) { return fail('CONFLICT', e.message) }
  })

  ipcMain.handle('schedules:delete', async (_, id: string) => {
    try { await svc.delete(id); return ok(null) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('schedules:listRooms', async () => {
    try { return ok(await svc.listRooms()) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('schedules:createRoom', async (_, data: any) => {
    try { return ok(await svc.createRoom(data)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })
}
