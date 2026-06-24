import { ipcMain, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../services/grade.service'
import { BulletinService } from '../services/bulletin.service'
import { ok, fail } from '@sgsi/shared'

/** Parse a raw cell value to a valid grade 0-20, or null */
function parseGrade(raw: any): number | null {
  if (raw === null || raw === undefined || raw === '') return null
  const n = parseFloat(String(raw).replace(',', '.'))
  if (isNaN(n) || n < 0 || n > 20) return null
  return n
}

/**
 * Parse Excel rows for grade import.
 * Expected columns: Matricule | Nom | Prénom | DS1 | DS2 | Composition
 * (columns can be in any order if headers are present)
 */
function parseGradeXlsx(data: any[][]): Array<{
  matricule: string; lastName: string; firstName: string;
  ds1: number | null; ds2: number | null; composition: number | null;
}> {
  if (data.length < 2) return []

  const headerRow = (data[0] as any[]).map(h => String(h ?? '').trim().toLowerCase())

  const find = (...keys: string[]) => {
    for (const k of keys) {
      const i = headerRow.findIndex(h => h === k || h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }

  const iMat  = find('matricule', 'id', 'n°')
  const iNom  = find('nom', 'lastname', 'last_name')
  const iPren = find('prénom', 'prenom', 'firstname', 'first_name')
  const iDs1  = find('ds1', 'devoir1', 'devoir 1', 'd1', 'interro1')
  const iDs2  = find('ds2', 'devoir2', 'devoir 2', 'd2', 'interro2')
  const iComp = find('composition', 'compo', 'examen', 'exam', 'final')

  // Fallback positions (Matricule | Nom | Prénom | DS1 | DS2 | Compo)
  const g = (row: any[], idx: number, fallback: number) =>
    idx >= 0 ? row[idx] : row[fallback]

  return data.slice(1)
    .map(row => ({
      matricule:   String(g(row, iMat, 0) ?? '').trim().toUpperCase(),
      lastName:    String(g(row, iNom, 1) ?? '').trim().toUpperCase(),
      firstName:   String(g(row, iPren, 2) ?? '').trim(),
      ds1:         parseGrade(g(row, iDs1,  3)),
      ds2:         parseGrade(g(row, iDs2,  4)),
      composition: parseGrade(g(row, iComp, 5)),
    }))
    .filter(r => r.matricule || r.lastName)
}

/** Legacy single-note parsers (kept for backward compatibility) */
function parseCsv(content: string): Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const sep    = lines[0].includes(';') ? ';' : ','
  const header = lines[0].toLowerCase().split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const cols = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
    const obj:Record<string,string> = {}
    header.forEach((h, i) => { obj[h] = cols[i] ?? '' })
    const noteRaw = obj['note'] ?? obj['grade'] ?? obj['valeur'] ?? ''
    const value   = noteRaw ? parseFloat(noteRaw.replace(',', '.')) : null
    return {
      lastName:  (obj['nom'] ?? '').toUpperCase(),
      firstName: obj['prenom'] ?? obj['prénom'] ?? '',
      matricule: obj['matricule'] ?? '',
      value: value !== null && !isNaN(value) ? value : null,
    }
  })
}

function parseXlsxData(data: any[][]): Array<{ lastName: string; firstName: string; matricule: string; value: number | null }> {
  if (data.length < 2) return []
  const header = (data[0] as string[]).map(h => String(h ?? '').trim().toLowerCase())
  const iMat  = header.findIndex(h => h === 'matricule' || h === 'id')
  const iNom  = header.findIndex(h => h === 'nom')
  const iPren = header.findIndex(h => h === 'prenom' || h === 'prénom')
  const iNote = header.findIndex(h => h === 'note' || h === 'grade' || h === 'valeur')
  return data.slice(1).map(row => {
    const noteRaw = iNote >= 0 ? row[iNote] : row[3]
    const value   = noteRaw != null ? parseFloat(String(noteRaw).replace(',', '.')) : null
    return {
      lastName:  String(iNom  >= 0 ? row[iNom]  : row[0] ?? '').toUpperCase(),
      firstName: String(iPren >= 0 ? row[iPren] : row[1] ?? ''),
      matricule: String(iMat  >= 0 ? row[iMat]  : row[2] ?? '').toUpperCase(),
      value:     value !== null && !isNaN(value) ? value : null,
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

  /* ── Download grade import template ─────────────────────────── */
  ipcMain.handle('grades:downloadTemplate', async () => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Enregistrer le modèle d\'import des notes',
        defaultPath: 'modele-import-notes.xlsx',
        filters:     [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (canceled || !filePath) return ok(null)

      const ExcelJS = require('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'SGSI SchoolManager Pro'
      const ws = wb.addWorksheet('Notes')

      ws.columns = [
        { header: 'Matricule *',                    key: 'matricule',   width: 22 },
        { header: 'Nom',                            key: 'lastName',    width: 18 },
        { header: 'Prénom',                         key: 'firstName',   width: 18 },
        { header: 'DS1 (0-20)',                     key: 'ds1',         width: 12 },
        { header: 'DS2 (0-20)',                     key: 'ds2',         width: 12 },
        { header: 'Composition (0-20)',              key: 'composition', width: 18 },
      ]

      const hRow = ws.getRow(1)
      hRow.eachCell(cell => {
        cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      hRow.height = 24

      // Example row
      ws.addRow({ matricule: 'DEMOAB-2025-0001', lastName: 'BAH', firstName: 'Amadou', ds1: 15, ds2: 12, composition: 14 })
      const ex = ws.getRow(2)
      ex.eachCell(cell => { cell.font = { italic: true, color: { argb: 'FF6B7280' } } })

      await wb.xlsx.writeFile(filePath)
      return ok({ filePath })
    } catch (e: any) { return fail('ERROR', e.message) }
  })

  /* ── Import grades from Excel (multi-column: DS1 / DS2 / Compo) ─ */
  ipcMain.handle('grades:importExcel', async (_, classId: string, subjectId: string, period: number, actorId: string) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title:      'Importer les notes depuis Excel',
        filters:    [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return ok(null)

      const XLSX     = require('xlsx')
      const workbook = XLSX.readFile(filePaths[0])
      const data: any[][] = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { header: 1, defval: '' }
      )
      const rows = parseGradeXlsx(data)
      if (rows.length === 0) return fail('EMPTY', 'Aucune ligne trouvée dans le fichier')

      // Get all active enrollments for this class
      const enrollments = await db.enrollment.findMany({
        where:   { classId, status: 'ACTIVE' },
        include: { student: { select: { matricule: true, firstName: true, lastName: true } } },
      })

      let imported = 0, notFound = 0, errors = 0
      const report: Array<{ matricule: string; name: string; status: string; ds1?: number; ds2?: number; composition?: number }> = []

      const EVAL_MAP = [
        { key: 'ds1',         type: 'DS1'         },
        { key: 'ds2',         type: 'DS2'         },
        { key: 'composition', type: 'COMPOSITION' },
      ] as const

      for (const row of rows) {
        const enrollment = enrollments.find(e =>
          e.student.matricule === row.matricule ||
          (e.student.lastName.toUpperCase() === row.lastName && e.student.firstName.toLowerCase() === row.firstName.toLowerCase())
        )

        if (!enrollment) {
          notFound++
          report.push({ matricule: row.matricule || '?', name: `${row.lastName} ${row.firstName}`, status: 'Élève introuvable' })
          continue
        }

        try {
          for (const ev of EVAL_MAP) {
            const score = row[ev.key]
            if (score !== null) {
              await (db as any).grade.upsert({
                where: {
                  enrollmentId_subjectId_period_type: {
                    enrollmentId: enrollment.id,
                    subjectId,
                    period,
                    type: ev.type,
                  },
                },
                update: { score },
                create: { enrollmentId: enrollment.id, subjectId, period, type: ev.type, score },
              })
            }
          }
          imported++
          report.push({
            matricule: enrollment.student.matricule,
            name:      `${enrollment.student.lastName} ${enrollment.student.firstName}`,
            status:    'Importé',
            ds1:       row.ds1 ?? undefined,
            ds2:       row.ds2 ?? undefined,
            composition: row.composition ?? undefined,
          })
        } catch {
          errors++
          report.push({ matricule: enrollment.student.matricule, name: `${enrollment.student.lastName}`, status: 'Erreur DB' })
        }
      }

      return ok({ imported, notFound, errors, total: rows.length, report })
    } catch (e: any) { return fail('IMPORT_ERROR', e.message) }
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
