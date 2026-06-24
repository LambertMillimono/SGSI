import { ipcMain } from 'electron'
import { ok, fail } from '@sgsi/shared'
import { ExpenseService } from '../services/expense.service'
import type { PrismaClient } from '@prisma/client'

export function registerExpensesIpc(db: PrismaClient): void {
  const svc = new ExpenseService(db)

  ipcMain.handle('expenses:list', async (_, filters?: any) => {
    try { return ok(await svc.list(filters)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('expenses:create', async (_, data: any) => {
    try { return ok(await svc.create(data)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('expenses:delete', async (_, id: string) => {
    try { await svc.delete(id); return ok(null) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('expenses:summary', async (_, year: number) => {
    try { return ok(await svc.monthlySummary(year)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('cash:today', async () => {
    try { return ok(await svc.getTodayCash()) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('cash:open', async (_, openBalance: number, openedBy: string) => {
    try { return ok(await svc.openCash(openBalance, openedBy)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('cash:close', async (_, id: string, closeBalance: number, closedBy: string) => {
    try { return ok(await svc.closeCash(id, closeBalance, closedBy)) }
    catch (e: any) { return fail('ERROR', e.message) }
  })
}
