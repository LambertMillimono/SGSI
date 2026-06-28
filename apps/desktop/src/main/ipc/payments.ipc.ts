import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { PaymentService } from '../services/payment.service'
import { ok, fail } from '@sgsi/shared'
import { withAuth, withRole } from '../ipc-guard'

export function registerPaymentsIpc(db: PrismaClient): void {
  const service = new PaymentService(db)

  ipcMain.handle('payments:record', withAuth(async (_, data, cashierId: string) => {
    try { return ok(await service.record(data, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  }))

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

  ipcMain.handle('feetypes:update', async (_, id: string, data, actorId: string) => {
    try { return ok(await service.updateFeeType(id, data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('feetypes:delete', async (_, id: string, actorId: string) => {
    try { await service.deleteFeeType(id, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:receipt', async (_, id: string) => {
    try { return ok(await service.getById(id)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // Rapport financier : total encaissé par mois/type
  ipcMain.handle('payments:report', async (_, year: number) => {
    try {
      const start = new Date(year, 0, 1)
      const end   = new Date(year, 11, 31, 23, 59, 59)
      const payments = await db.payment.findMany({
        where: { paidAt: { gte: start, lte: end } },
        include: { feeType: true },
        orderBy: { paidAt: 'asc' },
      })
      // Grouper par mois
      const byMonth: Record<number, { total: number; count: number }> = {}
      for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, count: 0 }
      for (const p of payments) {
        const m = new Date(p.paidAt).getMonth() + 1
        byMonth[m].total += p.amount
        byMonth[m].count += 1
      }
      const totalYear = payments.reduce((s, p) => s + p.amount, 0)
      return ok({ byMonth, totalYear, count: payments.length })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // ── Remises et exonérations ──
  ipcMain.handle('payments:recordDiscount', async (_, data, cashierId: string) => {
    try { return ok(await service.recordDiscount(data, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:listDiscounts', async (_, enrollmentId: string) => {
    try { return ok(await service.listDiscounts(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // ── Prévisions de recettes ──
  ipcMain.handle('payments:forecast', async (_, year: number) => {
    try { return ok(await service.forecast(year)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // ── Payment plans (paiement partiel / échelonné) ──
  ipcMain.handle('payments:createPlan', async (_, data, cashierId: string) => {
    try { return ok(await service.createPlan(data, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:listPlans', async (_, enrollmentId: string) => {
    try { return ok(await service.listPlans(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:listAllPlans', async () => {
    try { return ok(await service.listAllPlans()) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:payInstallment', async (_, installmentId: string, method: string, cashierId: string) => {
    try { return ok(await service.payInstallment(installmentId, method, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:deletePlan', async (_, planId: string, actorId: string) => {
    try { await service.deletePlan(planId, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // Rapport par type de frais
  ipcMain.handle('payments:reportByFeeType', async (_, year: number) => {
    try {
      const start = new Date(year, 0, 1)
      const end   = new Date(year, 11, 31, 23, 59, 59)
      const feeTypes = await db.feeType.findMany({ include: { payments: { where: { paidAt: { gte: start, lte: end } } } } })
      return ok(feeTypes.map(ft => ({
        id: ft.id,
        name: ft.name,
        total: ft.payments.reduce((s, p) => s + p.amount, 0),
        count: ft.payments.length,
      })).filter(ft => ft.count > 0))
    } catch (e: any) { return fail('ERROR', e.message) }
  })
}
