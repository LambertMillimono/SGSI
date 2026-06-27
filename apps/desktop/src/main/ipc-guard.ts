/**
 * ipc-guard.ts — IPC authentication middleware
 * Wraps IPC handlers to verify authentication before execution.
 */
import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { fail } from '@sgsi/shared'
import { getSession, getAuthenticatedUserId, getAuthenticatedRole } from './auth-state'

type Handler = (event: IpcMainInvokeEvent, ...args: any[]) => Promise<any>

const ROLE_HIERARCHY: Record<string, number> = {
  TEACHER:     1,
  SECRETARY:   2,
  ACCOUNTANT:  2,
  DIRECTOR:    3,
  SUPER_ADMIN: 4,
}

/** Wrap a handler with authentication check */
export function withAuth(handler: Handler): Handler {
  return async (event, ...args) => {
    const session = getSession()
    if (!session) {
      return fail('UNAUTHORIZED', 'Non authentifie. Veuillez vous connecter.')
    }
    const userId = getAuthenticatedUserId()
    if (!userId) {
      return fail('UNAUTHORIZED', 'Session invalide ou expiree.')
    }
    return handler(event, ...args)
  }
}

/** Wrap a handler requiring a minimum role */
export function withRole(minRole: string, handler: Handler): Handler {
  return async (event, ...args) => {
    const session = getSession()
    if (!session) {
      return fail('UNAUTHORIZED', 'Non authentifie.')
    }
    const role = getAuthenticatedRole()
    if (!role) {
      return fail('UNAUTHORIZED', 'Session invalide.')
    }
    const userLevel = ROLE_HIERARCHY[role] ?? 0
    const minLevel  = ROLE_HIERARCHY[minRole] ?? 99
    if (userLevel < minLevel) {
      return fail('FORBIDDEN', `Acces refuse. Role requis: ${minRole}`)
    }
    return handler(event, ...args)
  }
}

/** Register a protected IPC handler */
export function handleProtected(channel: string, handler: Handler): void {
  ipcMain.handle(channel, withAuth(handler))
}

/** Register a protected IPC handler requiring a minimum role */
export function handleWithRole(channel: string, minRole: string, handler: Handler): void {
  ipcMain.handle(channel, withRole(minRole, handler))
}
