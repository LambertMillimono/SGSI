import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { MedicalService } from '../services/medical.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerMedicalIpc(db: PrismaClient) {
  const svc = new MedicalService(db)

  ipcMain.handle('medical:getRecord', async (_, studentId: string) => {
    try { return ok(await svc.getRecord(studentId)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('medical:updateRecord', async (_, id: string, data: any) => {
    try { return ok(await svc.updateRecord(id, data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('medical:addConsultation', async (_, medicalRecordId: string, data: any) => {
    try { return ok(await svc.addConsultation(medicalRecordId, { ...data, date: data.date ? new Date(data.date) : undefined })) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('medical:deleteConsultation', async (_, id: string) => {
    try { return ok(await svc.deleteConsultation(id)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('medical:listRecent', async (_, limit?: number) => {
    try { return ok(await svc.listRecent(limit)) }
    catch (e: any) { return fail(e.message) }
  })
}
