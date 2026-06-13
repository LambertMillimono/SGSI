import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { PaymentService } from '../services/payment.service'
import { ok, fail } from '@sgsi/shared'

export function registerPaymentsIpc(db: PrismaClient): void {
  const service = new PaymentService(db)

  ipcMain.handle('payments:record', async (_, data, cashierId: string) => {
    try { return ok(await service.record(data, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:list', async (_, enrollmentId: string) => {
    try { return ok(await service.listByEnrollment(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:unpaid', async (_, classId?: string) => {
    try { return ok(await service.listUnpaid(classId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('feetypes:list', async (_, levelId?: string) => {
    try { return ok(await service.listFeeTypes(levelId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('feetypes:create', async (_, data, actorId: string) => {
    try { return ok(await service.createFeeType(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:receipt', async (_, id: string) => {
    try { return ok(await service.getById(id)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
