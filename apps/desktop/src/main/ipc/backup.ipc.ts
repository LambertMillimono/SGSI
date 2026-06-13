import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { BackupService } from '../services/backup.service'
import { ok, fail } from '@sgsi/shared'
import path from 'path'

export function registerBackupIpc(db: PrismaClient, dbPath: string): void {
  const service = new BackupService(db, dbPath)

  ipcMain.handle('backup:create', async (_, format: 'db' | 'zip') => {
    try {
      const filePath = format === 'zip'
        ? await service.createZipBackup()
        : await service.createDbBackup()
      return ok({ filePath })
    } catch (e: any) { return fail('BACKUP_ERROR', e.message) }
  })

  ipcMain.handle('backup:restore', async (_, backupPath: string) => {
    try { await service.restore(backupPath); return ok(null) }
    catch (e: any) { return fail('RESTORE_ERROR', e.message) }
  })

  ipcMain.handle('backup:list', async () => {
    try { return ok(service.listBackups()) }
    catch (e: any) { return fail('BACKUP_LIST_ERROR', e.message) }
  })
}
