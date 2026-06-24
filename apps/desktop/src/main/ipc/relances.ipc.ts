import { ipcMain, BrowserWindow } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { RelanceService } from '../services/relance.service'
import { ok, fail } from '@sgsi/shared'

export function registerRelancesIpc(db: PrismaClient): void {
  const service = new RelanceService(db)

  ipcMain.handle('relances:list', async (_, thresholdDays = 30) => {
    try { return ok(await service.getOverdueParents(thresholdDays)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:send', async (_, parentIds: string[]) => {
    try { return ok(await service.sendReminders(parentIds)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:history', async () => {
    try { return ok(await service.getReminderHistory()) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:printLetters', async (_, parentIds: string[]) => {
    try { return ok(await service.generateLettersHtml(parentIds)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}

export async function checkOverdueAtStartup(db: PrismaClient, win: BrowserWindow): Promise<void> {
  try {
    const service = new RelanceService(db)
    const overdue = await service.getOverdueParents(30)
    if (overdue.length === 0) return

    const totalBalance = overdue.reduce((s, o) => s + o.balance, 0)
    win.webContents.send('relances:startup-alert', {
      count:    overdue.length,
      total:    totalBalance,
      currency: 'GNF',
    })
  } catch {
    // non-critical
  }
}
