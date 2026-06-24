import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { AuditLogService } from '../services/auditlog.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerAuditLogIpc(db: PrismaClient) {
  const svc = new AuditLogService(db)

  ipcMain.handle('auditlog:list', async (_, filters?: { userId?: string; entity?: string; limit?: number }) => {
    try { return ok(await svc.list(filters)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('auditlog:entities', async () => {
    try { return ok(await svc.listEntities()) }
    catch (e: any) { return fail(e.message) }
  })
}
