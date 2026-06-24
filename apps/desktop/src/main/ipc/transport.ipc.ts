import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { TransportService } from '../services/transport.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerTransportIpc(db: PrismaClient) {
  const svc = new TransportService(db)

  ipcMain.handle('transport:listBuses', async () => {
    try { return ok(await svc.listBuses()) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:createBus', async (_, data: any) => {
    try { return ok(await svc.createBus(data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:updateBus', async (_, id: string, data: any) => {
    try { return ok(await svc.updateBus(id, data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:deleteBus', async (_, id: string) => {
    try { return ok(await svc.deleteBus(id)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:createRoute', async (_, data: any) => {
    try { return ok(await svc.createRoute(data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:updateRoute', async (_, id: string, data: any) => {
    try { return ok(await svc.updateRoute(id, data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:deleteRoute', async (_, id: string) => {
    try { return ok(await svc.deleteRoute(id)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('transport:stats', async () => {
    try { return ok(await svc.stats()) }
    catch (e: any) { return fail(e.message) }
  })
}
