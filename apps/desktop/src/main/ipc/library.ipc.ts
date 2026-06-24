import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { LibraryService } from '../services/library.service'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string, code = 'ERROR') { return { success: false, error: { code, message } } }

export function registerLibraryIpc(db: PrismaClient) {
  const svc = new LibraryService(db)

  ipcMain.handle('library:listBooks', async (_, search?: string) => {
    try { return ok(await svc.listBooks(search)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:createBook', async (_, data: any) => {
    try { return ok(await svc.createBook(data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:updateBook', async (_, id: string, data: any) => {
    try { return ok(await svc.updateBook(id, data)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:deleteBook', async (_, id: string) => {
    try { return ok(await svc.deleteBook(id)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:listLoans', async (_, filters?: any) => {
    try { return ok(await svc.listLoans(filters)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:createLoan', async (_, data: any) => {
    try { return ok(await svc.createLoan({ ...data, dueDate: new Date(data.dueDate) })) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:returnLoan', async (_, loanId: string, fine?: number) => {
    try { return ok(await svc.returnLoan(loanId, fine)) }
    catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('library:stats', async () => {
    try { return ok(await svc.stats()) }
    catch (e: any) { return fail(e.message) }
  })
}
