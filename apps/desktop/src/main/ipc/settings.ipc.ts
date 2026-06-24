import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

const DEFAULT_MODULES = [
  'students', 'grades', 'payments', 'absences', 'schedule',
  'staff', 'expenses', 'reports', 'library', 'infirmerie', 'transport', 'messages',
]

function getModulesFilePath() {
  return path.join(app.getPath('userData'), 'sgsi-modules.json')
}

function readModulesFromFile(): string[] {
  try {
    const content = fs.readFileSync(getModulesFilePath(), 'utf-8')
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : DEFAULT_MODULES
  } catch {
    return DEFAULT_MODULES
  }
}

function writeModulesToFile(modules: string[]) {
  fs.writeFileSync(getModulesFilePath(), JSON.stringify(modules), 'utf-8')
}

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
      const sanitized = {
        ...data,
        passingAverage: data.passingAverage != null ? parseFloat(data.passingAverage) : undefined,
        eliminatoryThreshold: data.eliminatoryThreshold != null ? parseFloat(data.eliminatoryThreshold) : undefined,
      }
      let school = await db.school.findFirst()
      if (!school) {
        school = await db.school.create({ data: sanitized })
      } else {
        school = await db.school.update({ where: { id: school.id }, data: sanitized })
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

  ipcMain.handle('settings:createCycle', async (_, data: any) => {
    try {
      const count = await db.cycle.count()
      const cycle = await db.cycle.create({ data: { name: data.name, order: count + 1 } })
      return ok(cycle)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createClass', async (_, data: any) => {
    try {
      const cls = await db.class.create({
        data: { name: data.name, levelId: data.levelId, academicYearId: data.academicYearId, maxStudents: data.maxStudents ?? 40 },
        include: { level: { include: { cycle: true } } },
      })
      return ok(cls)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:createLevel', async (_, data: any) => {
    try {
      const count = await db.level.count({ where: { cycleId: data.cycleId } })
      const level = await db.level.create({
        data: { name: data.name, order: count + 1, cycleId: data.cycleId },
        include: { cycle: true },
      })
      return ok(level)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:getModules', async () => {
    try { return ok(readModulesFromFile()) }
    catch (e: any) { return ok(DEFAULT_MODULES) }
  })

  ipcMain.handle('settings:setModules', async (_, modules: string[]) => {
    try { writeModulesToFile(modules); return ok(modules) }
    catch (e: any) { return fail('ERROR', e.message) }
  })

  // ── SMTP ─────────────────────────────────────────────────────────────────────

  const smtpFilePath = () => path.join(app.getPath('userData'), 'sgsi-smtp.json')

  ipcMain.handle('settings:getSmtpConfig', async () => {
    try {
      const file = smtpFilePath()
      if (!fs.existsSync(file)) return ok(null)
      const config = JSON.parse(fs.readFileSync(file, 'utf-8'))
      return ok({ ...config, password: config.password ? '••••••••' : '' })
    } catch { return ok(null) }
  })

  ipcMain.handle('settings:setSmtpConfig', async (_, config: any) => {
    try {
      const file = smtpFilePath()
      let existing: any = {}
      if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, 'utf-8'))
      const toSave = { ...config, password: config.password === '••••••••' ? (existing.password ?? '') : config.password }
      fs.writeFileSync(file, JSON.stringify(toSave), 'utf-8')
      return ok(null)
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('settings:testSmtp', async (_, testEmail: string) => {
    try {
      const file = smtpFilePath()
      if (!fs.existsSync(file)) return fail('NO_SMTP', 'Aucune configuration SMTP enregistrée')
      const smtp = JSON.parse(fs.readFileSync(file, 'utf-8'))
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.password },
        tls: { rejectUnauthorized: false },
      })
      await transporter.sendMail({
        from: `"${smtp.fromName || 'SGSI'}" <${smtp.fromEmail || smtp.user}>`,
        to: testEmail,
        subject: 'Test SMTP — SGSI SchoolManager',
        html: '<p>Si vous recevez cet email, votre configuration SMTP est correcte !</p><p><strong>SGSI SchoolManager</strong></p>',
      })
      return ok(null)
    } catch (e: any) { return fail('SMTP_ERROR', e.message) }
  })

  // ── Code de récupération (fallback sans email) ────────────────────────────────

  const recoveryFilePath = () => path.join(app.getPath('userData'), 'sgsi-recovery.json')

  ipcMain.handle('settings:getRecoveryCode', async () => {
    try {
      const file = recoveryFilePath()
      if (!fs.existsSync(file)) return ok({ isSet: false })
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
      return ok({ isSet: !!data.hash })
    } catch {
      return ok({ isSet: false })
    }
  })

  ipcMain.handle('settings:setRecoveryCode', async (_, code: string) => {
    try {
      const hash = crypto.createHash('sha256').update(code.trim()).digest('hex')
      fs.writeFileSync(recoveryFilePath(), JSON.stringify({ hash }), 'utf-8')
      return ok(null)
    } catch (e: any) {
      return fail('ERROR', e.message)
    }
  })
}
