import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

export function registerSubjectsIpc(db: PrismaClient): void {
  ipcMain.handle('subjects:list', async () => {
    try {
      return ok(await db.subject.findMany({ orderBy: { name: 'asc' } }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('subjects:create', async (_, data: { name: string; code: string }) => {
    try {
      const subject = await db.subject.create({
        data: { name: data.name, code: data.code.toUpperCase().trim() },
      })
      return ok(subject)
    } catch (e: any) {
      return fail(
        e.code === 'P2002' ? 'CODE_TAKEN' : 'ERROR',
        e.code === 'P2002' ? 'Ce code est déjà utilisé' : e.message,
      )
    }
  })

  ipcMain.handle('subjects:delete', async (_, id: string) => {
    try {
      await db.subject.delete({ where: { id } })
      return ok(null)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('classSubjects:list', async (_, classId: string) => {
    try {
      return ok(await db.classSubject.findMany({
        where: { classId },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { subject: { name: 'asc' } },
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('classSubjects:add', async (_, data: {
    classId: string; subjectId: string; coefficient: number; hoursPerWeek: number
  }) => {
    try {
      const cs = await db.classSubject.create({
        data: {
          classId: data.classId,
          subjectId: data.subjectId,
          coefficient: data.coefficient,
          hoursPerWeek: data.hoursPerWeek,
        },
        include: { subject: true },
      })
      return ok(cs)
    } catch (e: any) {
      return fail(
        e.code === 'P2002' ? 'ALREADY_EXISTS' : 'ERROR',
        e.code === 'P2002' ? 'Cette matière est déjà assignée à cette classe' : e.message,
      )
    }
  })

  ipcMain.handle('classSubjects:update', async (_, id: string, data: { coefficient?: number; hoursPerWeek?: number }) => {
    try {
      return ok(await db.classSubject.update({ where: { id }, data, include: { subject: true } }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('classSubjects:remove', async (_, id: string) => {
    try {
      await db.classSubject.delete({ where: { id } })
      return ok(null)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  // ── Programme par niveau (LevelSubject) ──────────────────────────────────────

  ipcMain.handle('levelSubjects:list', async (_, levelId: string) => {
    try {
      return ok(await db.levelSubject.findMany({
        where: { levelId },
        include: { subject: true },
        orderBy: { subject: { name: 'asc' } },
      }))
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('levelSubjects:upsert', async (_, data: {
    levelId: string; subjectId: string; coefficient: number; hoursPerWeek: number
  }) => {
    try {
      const ls = await db.levelSubject.upsert({
        where: { levelId_subjectId: { levelId: data.levelId, subjectId: data.subjectId } },
        create: { levelId: data.levelId, subjectId: data.subjectId, coefficient: data.coefficient, hoursPerWeek: data.hoursPerWeek },
        update: { coefficient: data.coefficient, hoursPerWeek: data.hoursPerWeek },
        include: { subject: true },
      })
      return ok(ls)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('levelSubjects:remove', async (_, id: string) => {
    try {
      await db.levelSubject.delete({ where: { id } })
      return ok(null)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('levelSubjects:applyToClasses', async (_, levelId: string) => {
    try {
      const levelSubjects = await db.levelSubject.findMany({ where: { levelId } })
      const classes = await db.class.findMany({ where: { levelId } })
      let updated = 0
      for (const cls of classes) {
        for (const ls of levelSubjects) {
          const existing = await db.classSubject.findFirst({
            where: { classId: cls.id, subjectId: ls.subjectId },
          })
          if (existing) {
            await db.classSubject.update({
              where: { id: existing.id },
              data: { coefficient: ls.coefficient, hoursPerWeek: ls.hoursPerWeek },
            })
            updated++
          }
        }
      }
      return ok({ updated, classes: classes.length, subjects: levelSubjects.length })
    } catch (e: any) { return fail('ERROR', e.message) }
  })
}
