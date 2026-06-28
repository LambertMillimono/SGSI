import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { StudentService } from '../services/student.service'
import { ClassService } from '../services/class.service'
import { ok, fail } from '@sgsi/shared'
import { withAuth, withRole } from '../ipc-guard'

export function registerStudentsIpc(db: PrismaClient): void {
  const students = new StudentService(db)
  const classes = new ClassService(db)

  ipcMain.handle('students:list', async (_, filters) => {
    try { return ok(await students.list(filters)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:findById', async (_, id: string) => {
    try { return ok(await students.findById(id)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:create', withAuth(async (_, data, actorId: string) => {
    try { return ok(await students.create(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  }))

  ipcMain.handle('students:update', withAuth(async (_, id: string, data, actorId: string) => {
    try { return ok(await students.update(id, data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  }))

  ipcMain.handle('students:delete', withRole('SECRETARY', async (_, id: string, actorId: string) => {
    try { await students.delete(id, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  }))

  ipcMain.handle('students:enroll', withAuth(async (_, studentId: string, classId: string, yearId: string, actorId: string) => {
    try { return ok(await students.enroll(studentId, classId, yearId, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  }))

  // Classes IPC (registered here to avoid extra file)
  ipcMain.handle('classes:list', async (_, yearId?: string) => {
    try { return ok(await classes.listClasses(yearId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('classes:create', async (_, data, actorId: string) => {
    try { return ok(await classes.createClass(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('classes:findById', async (_, id: string) => {
    try { return ok(await classes.findClassById(id)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('cycles:list', async () => {
    try { return ok(await classes.listCycles()) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('levels:list', async () => {
    try { return ok(await classes.listLevels()) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('levels:create', async (_, data, actorId: string) => {
    try { return ok(await classes.createLevel(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
