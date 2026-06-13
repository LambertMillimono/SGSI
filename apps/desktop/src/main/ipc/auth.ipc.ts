import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { ok, fail } from '@sgsi/shared'

export function registerAuthIpc(db: PrismaClient, jwtSecret: string): void {
  const auth = new AuthService(db, jwtSecret)

  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try { return ok(await auth.login(username, password)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:verifyToken', async (_, token: string) => {
    try { return ok(auth.verifyToken(token)) }
    catch { return fail('INVALID_TOKEN', 'Token invalide') }
  })

  ipcMain.handle('auth:requestReset', async (_, userId: string, requestedBy: string) => {
    try { return ok({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) }) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:changePassword', async (_, userId: string, newPassword: string) => {
    try { await auth.changePassword(userId, newPassword); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:checkPermission', async (_, userId: string, module: string, action: string) => {
    try { return ok(await auth.checkPermission(userId, module, action)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // JWT is stateless — logout is handled client-side by discarding the token
  ipcMain.handle('auth:logout', async () => ok(null))
}
