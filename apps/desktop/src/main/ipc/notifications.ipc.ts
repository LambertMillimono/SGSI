import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { NotificationService } from '../services/notification.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerNotificationsIpc(db: PrismaClient) {
  const svc = new NotificationService(db)

  ipcMain.handle('notifications:list', async (_, limit?: number) => {
    try { return ok(await svc.list(limit)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('notifications:countUnread', async () => {
    try { return ok(await svc.countUnread()) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('notifications:markRead', async (_, id: string) => {
    try { return ok(await svc.markRead(id)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('notifications:markAllRead', async () => {
    try { return ok(await svc.markAllRead()) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('notifications:create', async (_, data: any) => {
    try { return ok(await svc.create(data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('notifications:delete', async (_, id: string) => {
    try { return ok(await svc.delete(id)) }
    catch (e: any) { return fail(e.message) }
  })
}
