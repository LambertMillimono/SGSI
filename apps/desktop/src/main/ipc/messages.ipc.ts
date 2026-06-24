import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { MessageService } from '../services/message.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(code: string, message: string) { return { success: false, error: { code, message } } }

export function registerMessagesIpc(db: PrismaClient) {
  const svc = new MessageService(db)

  ipcMain.handle('messages:inbox', async (_, userId: string) => {
    try { return ok(await svc.listInbox(userId)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })

  ipcMain.handle('messages:sent', async (_, userId: string) => {
    try { return ok(await svc.listSent(userId)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })

  ipcMain.handle('messages:thread', async (_, messageId: string, userId: string) => {
    try { return ok(await svc.getThread(messageId, userId)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })

  ipcMain.handle('messages:send', async (_, data: { fromUserId: string; toUserId: string; subject: string; body: string; parentId?: string }) => {
    try { return ok(await svc.send(data)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })

  ipcMain.handle('messages:countUnread', async (_, userId: string) => {
    try { return ok(await svc.countUnread(userId)) }
    catch (e: any) { return ok(0) }
  })

  ipcMain.handle('messages:markRead', async (_, messageId: string) => {
    try { return ok(await svc.markRead(messageId)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })

  ipcMain.handle('messages:delete', async (_, messageId: string, userId: string) => {
    try { return ok(await svc.delete(messageId, userId)) }
    catch (e: any) { return fail('MSG_ERROR', e.message) }
  })
}
