import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

export function registerSettingsIpc(db: PrismaClient): void {
  ipcMain.handle('settings:getSchool', async () => {
    try {
      let school = await db.school.findFirst()
      if (!school) {
        school = await db.school.create({
          data: { name: 'Mon École', sigle: 'ECO', currency: 'GNF', language: 'fr' },
        })
      }
      return ok(school)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:updateSchool', async (_, data: any) => {
    try {
      let school = await db.school.findFirst()
      if (!school) {
        school = await db.school.create({ data })
      } else {
        school = await db.school.update({ where: { id: school.id }, data })
      }
      return ok(school)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:listUsers', async () => {
    try {
      const users = await db.user.findMany({
        select: { id: true, username: true, firstName: true, lastName: true, role: true, isActive: true, lastLogin: true, email: true, phone: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      })
      return ok(users)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createUser', async (_, data: any) => {
    try {
      const bcrypt = require('bcryptjs')
      const hashed = await bcrypt.hash(data.password ?? 'Temp@1234', 12)
      const user = await db.user.create({
        data: {
          username: data.username,
          password: hashed,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? null,
          phone: data.phone ?? null,
          mustChangePassword: true,
        },
      })
      return ok({ id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName })
    } catch (e: any) { return fail(e.code === 'P2002' ? 'USERNAME_TAKEN' : 'ERROR', e.code === 'P2002' ? 'Nom d\'utilisateur déjà utilisé' : e.message) }
  })

  ipcMain.handle('settings:updateUser', async (_, id: string, data: any) => {
    try {
      const user = await db.user.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? null,
          phone: data.phone ?? null,
          role: data.role,
          isActive: data.isActive,
        },
      })
      return ok(user)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:resetUserPassword', async (_, userId: string, requestedBy: string) => {
    try {
      const bcrypt = require('bcryptjs')
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let tempPassword = ''
      for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)]
      const hashed = await bcrypt.hash(tempPassword, 12)
      await db.user.update({ where: { id: userId }, data: { password: hashed, mustChangePassword: true } })
      return ok({ tempPassword })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:listAcademicYears', async () => {
    try {
      const years = await db.academicYear.findMany({ orderBy: { startDate: 'desc' } })
      return ok(years)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createAcademicYear', async (_, data: any) => {
    try {
      if (data.isCurrent) await db.academicYear.updateMany({ data: { isCurrent: false } })
      const year = await db.academicYear.create({ data })
      return ok(year)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:setCurrentYear', async (_, id: string) => {
    try {
      await db.academicYear.updateMany({ data: { isCurrent: false } })
      const year = await db.academicYear.update({ where: { id }, data: { isCurrent: true } })
      return ok(year)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createClass', async (_, data: any) => {
    try {
      const cls = await db.class.create({
        data: { name: data.name, levelId: data.levelId, academicYearId: data.academicYearId, maxStudents: data.maxStudents ?? 50 },
        include: { level: true },
      })
      return ok(cls)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createLevel', async (_, data: any) => {
    try {
      const level = await db.level.create({ data: { name: data.name, order: data.order } })
      return ok(level)
    } catch (e: any) { return fail('ERROR', e.message) }
  })
}
