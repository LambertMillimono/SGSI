import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { LicenseService } from '../services/license.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(code: string, message: string) { return { success: false, error: { code, message } } }

export function registerLicenseIpc(db: PrismaClient) {
  const svc = new LicenseService(db)

  ipcMain.handle('license:get', async () => {
    try { return ok(await svc.getLicense()) }
    catch (e: any) { return fail('LICENSE_ERROR', e.message) }
  })

  ipcMain.handle('license:activate', async (_, key: string) => {
    try { return ok(await svc.activate(key)) }
    catch (e: any) { return fail('ACTIVATION_ERROR', e.message) }
  })

  ipcMain.handle('license:deactivate', async () => {
    try { return ok(await svc.deactivate()) }
    catch (e: any) { return fail('LICENSE_ERROR', e.message) }
  })

  ipcMain.handle('license:isValid', async () => {
    try { return ok(await svc.isValid()) }
    catch (e: any) { return ok(false) }
  })
}
