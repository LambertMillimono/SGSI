import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../services/grade.service'
import { BulletinService } from '../services/bulletin.service'
import { ok, fail } from '@sgsi/shared'

function parseCsv(content: string): Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const sep = lines[0].includes(';') ? ';' : ','
  const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows: Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const obj: Record<string, string> = {}
    header.forEach((h, idx) => { obj[h] = cols[idx] ?? '' })

    const noteRaw = obj['note'] ?? obj['grade'] ?? obj['valeur'] ?? obj['value'] ?? ''
    const value = noteRaw !== '' ? parseFloat(noteRaw.replace(',', '.')) : null

    rows.push({
      lastName: (obj['nom'] ?? obj['lastname'] ?? obj['last_name'] ?? '').toUpperCase(),
      firstName: obj['prenom'] ?? obj['prénom'] ?? obj['firstname'] ?? obj['first_name'] ?? '',
      matricule: obj['matricule'] ?? '',
      value: value !== null && !isNaN(value) ? value : null,
    })
  }
  return rows
}

// Excel rows: Nom | Prénom | Matricule | Note  (1st row = headers, skipped)
function parseXlsxData(data: any[][]): Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> {
  if (data.length < 2) return []
  const header = (data[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
  const idxNom      = header.findIndex(h => h === 'nom' || h === 'lastname' || h === 'last_name')
  const idxPrenom   = header.findIndex(h => h === 'prenom' || h === 'prénom' || h === 'firstname' || h === 'first_name')
  const idxMatricule = header.findIndex(h => h === 'matricule' || h === 'id')
  const idxNote     = header.findIndex(h => h === 'note' || h === 'grade' || h === 'valeur' || h === 'value')

  // Fallback: assume columns are Nom | Prénom | Matricule | Note if no headers found
  const getNom      = (r: any[]) => idxNom      >= 0 ? String(r[idxNom]      ?? '').trim() : String(r[0] ?? '').trim()
  const getPrenom   = (r: any[]) => idxPrenom   >= 0 ? String(r[idxPrenom]   ?? '').trim() : String(r[1] ?? '').trim()
  const getMatric   = (r: any[]) => idxMatricule >= 0 ? String(r[idxMatricule] ?? '').trim() : String(r[2] ?? '').trim()
  const getNote     = (r: any[]) => idxNote     >= 0 ? r[idxNote]                            : r[3]

  return data.slice(1).map(row => {
    const noteRaw = getNote(row)
    const value = noteRaw !== '' && noteRaw != null ? parseFloat(String(noteRaw).replace(',', '.')) : null
    return {
      lastName: getNom(row).toUpperCase(),
      firstName: getPrenom(row),
      matricule: getMatric(row),
      value: value !== null && !isNaN(value) ? value : null,
    }
  }).filter(r => r.matricule || r.lastName)
}

export function registerGradesIpc(db: PrismaClient): void {
  const grades = new GradeService(db)
  const bulletins = new BulletinService(db)

  ipcMain.handle('grades:list', async (_, enrollmentId: string, period: number) => {
    try { return ok(await grades.listByEnrollment(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:save', async (_, data, actorId: string) => {
    try { return ok(await grades.save(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:upsert', async (_, data, actorId: string) => {
    try { return ok(await grades.upsertGrade(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:listByClass', async (_, classId: string, subjectId: string, period: number, evalType: string) => {
    try { return ok(await grades.listByClassSubjectPeriodEvalType(classId, subjectId, period, evalType)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:averages', async (_, enrollmentId: string, period: number) => {
    try { return ok(await grades.computeAverages(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:ranking', async (_, classId: string, period: number) => {
    try { return ok(await grades.computeClassRankings(classId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:lock', async (_, enrollmentId: string, period: number, actorId: string) => {
    try { await grades.lockGrades(enrollmentId, period, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:statsBySubject', async (_, classId: string, period: number) => {
    try { return ok(await grades.statsBySubject(classId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:parseCsv', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Importer les notes depuis un fichier',
        filters: [
          { name: 'Fichiers notes (CSV, Excel)', extensions: ['csv', 'txt', 'xlsx'] },
        ],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return ok(null)
      const filePath = result.filePaths[0]

      if (filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
        const XLSX = require('xlsx')
        const workbook = XLSX.readFile(filePath)
        const sheetName = workbook.SheetNames[0]
        const data: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' })
        const rows = parseXlsxData(data)
        return ok(rows)
      } else {
        const content = fs.readFileSync(filePath, 'utf-8')
        const rows = parseCsv(content)
        return ok(rows)
      }
    } catch (e: any) { return fail('PARSE_ERROR', e.message) }
  })

  ipcMain.handle('bulletins:generate', async (_, enrollmentId: string, period: number, actorId: string) => {
    try { return ok(await bulletins.generate(enrollmentId, period, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:generateForClass', async (_, classId: string, period: number, actorId: string) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: 'ACTIVE' },
        select: { id: true },
      })
      const results = await Promise.allSettled(
        enrollments.map((e) => bulletins.generate(e.id, period, actorId))
      )
      const success = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length
      return ok({ success, failed, total: enrollments.length })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  ipcMain.handle('bulletins:validate', async (_, bulletinId: string, directorId: string) => {
    try { return ok(await bulletins.validate(bulletinId, directorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:list', async (_, enrollmentId: string) => {
    try { return ok(await bulletins.findByEnrollment(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('bulletins:countUnvalidated', async () => {
    try {
      const count = await db.bulletin.count({ where: { isValidated: false } })
      return ok(count)
    } catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
