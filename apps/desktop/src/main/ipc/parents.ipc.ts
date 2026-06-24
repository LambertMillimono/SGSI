import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { ParentService } from '../services/parent.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerParentsIpc(db: PrismaClient) {
  const svc = new ParentService(db)

  ipcMain.handle('parents:listByStudent', async (_, studentId: string) => {
    try { return ok(await svc.listByStudent(studentId)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('parents:create', async (_, data: any, studentId: string) => {
    try { return ok(await svc.create(data, studentId)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('parents:update', async (_, id: string, data: any) => {
    try { return ok(await svc.update(id, data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('parents:unlink', async (_, parentId: string, studentId: string) => {
    try { return ok(await svc.unlink(parentId, studentId)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('parents:generateCode', async (_, parentId: string) => {
    try { return ok(await svc.generateAccessCode(parentId)) }
    catch (e: any) { return fail(e.message) }
  })
}
