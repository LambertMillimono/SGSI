import type { PrismaClient } from '@prisma/client'
import { registerAuthIpc } from './auth.ipc'
import { registerStudentsIpc } from './students.ipc'
import { registerGradesIpc } from './grades.ipc'
import { registerPaymentsIpc } from './payments.ipc'
import { registerBackupIpc } from './backup.ipc'
import { registerSettingsIpc } from './settings.ipc'
import path from 'path'

export function registerIpcHandlers(db: PrismaClient): void {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const dbPath = process.env.NODE_ENV === 'development'
    ? path.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')
    : path.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db')

  registerAuthIpc(db, jwtSecret)
  registerStudentsIpc(db)
  registerGradesIpc(db)
  registerPaymentsIpc(db)
  registerBackupIpc(db, dbPath)
  registerSettingsIpc(db)
}
