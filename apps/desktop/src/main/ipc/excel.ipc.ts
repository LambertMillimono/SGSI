/**
 * Excel Import / Export IPC handlers
 * - students:downloadTemplate  → save a blank import template .xlsx
 * - students:importExcel       → read an .xlsx and return preview rows
 * - students:confirmImport     → bulk-create students from validated rows
 * - students:exportExcel       → export all (or filtered) students to .xlsx
 * - students:exportClassList   → export one class roster to .xlsx
 * - payments:exportExcel       → export payment history to .xlsx
 */

import { ipcMain, dialog, app } from 'electron'
import type { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

function ok<T>(d: T) { return { success: true, data: d } }
function fail(msg: string) { return { success: false, error: { code: 'ERROR', message: msg } } }

/* ── Column mapping for the import template ─────────────────────────
   A  Nom (lastName)          *required
   B  Prénom (firstName)      *required
   C  Sexe  (MASCULIN/FÉMININ)*required
   D  Date naissance (DD/MM/YYYY)
   E  Lieu de naissance
   F  Nationalité
   G  Téléphone
   H  Adresse
   I  Email
   ────────────────────────────────────────────────────────────────── */
const COLUMNS = [
  { key: 'lastName',   header: 'Nom *',              width: 20 },
  { key: 'firstName',  header: 'Prénom *',            width: 20 },
  { key: 'gender',     header: 'Sexe * (MASCULIN/FÉMININ)', width: 24 },
  { key: 'birthDate',  header: 'Date de naissance (JJ/MM/AAAA)', width: 26 },
  { key: 'birthPlace', header: 'Lieu de naissance',   width: 20 },
  { key: 'nationality',header: 'Nationalité',          width: 16 },
  { key: 'phone',      header: 'Téléphone',            width: 18 },
  { key: 'address',    header: 'Adresse',              width: 28 },
  { key: 'email',      header: 'Email',                width: 26 },
]

/** Parse an Excel date cell that may be a serial number or a string. */
function parseDate(raw: any): string | undefined {
  if (!raw) return undefined
  if (raw instanceof Date) return dayjs(raw).format('YYYY-MM-DD')
  const s = String(raw).trim()
  const parsed = dayjs(s, ['DD/MM/YYYY', 'D/M/YYYY', 'YYYY-MM-DD'], true)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined
}

/** Normalise gender from French string to enum value. */
function parseGender(raw: any): 'MALE' | 'FEMALE' | undefined {
  if (!raw) return undefined
  const s = String(raw).trim().toUpperCase()
  if (s === 'MASCULIN' || s === 'M' || s === 'MALE')   return 'MALE'
  if (s === 'FÉMININ'  || s === 'FEMININ' || s === 'F' || s === 'FEMALE') return 'FEMALE'
  return undefined
}

export function registerExcelIpc(db: PrismaClient): void {

  /* ── Download blank import template ──────────────────────────── */
  ipcMain.handle('students:downloadTemplate', async () => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Enregistrer le modèle d\'import',
        defaultPath: 'modele-import-eleves.xlsx',
        filters:     [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (canceled || !filePath) return ok(null)

      const wb = new ExcelJS.Workbook()
      wb.creator = 'SGSI SchoolManager Pro'

      const ws = wb.addWorksheet('Élèves')

      // Style header row
      ws.columns = COLUMNS.map(c => ({
        header: c.header,
        key:    c.key,
        width:  c.width,
      }))

      const headerRow = ws.getRow(1)
      headerRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
        cell.border    = {
          bottom: { style: 'thin', color: { argb: 'FF0D47A1' } },
        }
      })
      headerRow.height = 26

      // Example row
      ws.addRow({
        lastName:    'BAH',
        firstName:   'Amadou',
        gender:      'MASCULIN',
        birthDate:   '15/08/2010',
        birthPlace:  'Conakry',
        nationality: 'Guinéenne',
        phone:       '+224 620 000 000',
        address:     'Quartier Madina',
        email:       '',
      })
      const exRow = ws.getRow(2)
      exRow.eachCell(cell => {
        cell.font = { italic: true, color: { argb: 'FF546E8A' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF4FE' } }
      })

      // Protect required columns with note
      ws.getColumn('A').note = 'Obligatoire'
      ws.getColumn('B').note = 'Obligatoire'
      ws.getColumn('C').note = 'Obligatoire — écrire exactement MASCULIN ou FÉMININ'

      await wb.xlsx.writeFile(filePath)
      return ok({ filePath })
    } catch (e: any) { return fail(e.message) }
  })

  /* ── Read Excel file → return preview rows (no DB write) ─────── */
  ipcMain.handle('students:importExcel', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title:      'Sélectionner le fichier Excel des élèves',
        filters:    [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'],
      })
      if (canceled || filePaths.length === 0) return ok(null)

      const wb = new ExcelJS.Workbook()
      await wb.xlsx.readFile(filePaths[0])
      const ws = wb.worksheets[0]
      if (!ws) return fail('Feuille introuvable dans le fichier Excel')

      const rows: any[] = []
      let skipped = 0

      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return // skip header
        const vals = row.values as any[] // index starts at 1
        const lastName  = String(vals[1] ?? '').trim()
        const firstName = String(vals[2] ?? '').trim()
        const genderRaw = vals[3]
        const gender    = parseGender(genderRaw)

        if (!lastName || !firstName) { skipped++; return }

        rows.push({
          rowNum,
          lastName,
          firstName,
          gender:      gender ?? null,
          genderRaw:   String(genderRaw ?? '').trim(),
          birthDate:   parseDate(vals[4]) ?? null,
          birthPlace:  String(vals[5] ?? '').trim() || null,
          nationality: String(vals[6] ?? '').trim() || null,
          phone:       String(vals[7] ?? '').trim() || null,
          address:     String(vals[8] ?? '').trim() || null,
          email:       String(vals[9] ?? '').trim() || null,
          // Validation flags
          valid: !!lastName && !!firstName && !!gender,
          errors: [
            !lastName  && 'Nom manquant',
            !firstName && 'Prénom manquant',
            !gender    && `Sexe invalide (reçu: "${String(genderRaw ?? '')}") — écrire MASCULIN ou FÉMININ`,
          ].filter(Boolean),
        })
      })

      return ok({ rows, skipped, file: path.basename(filePaths[0]) })
    } catch (e: any) { return fail(e.message) }
  })

  /* ── Bulk-create students from validated rows ─────────────────── */
  ipcMain.handle('students:confirmImport', async (_, rows: any[], actorId: string) => {
    const validRows = rows.filter(r => r.valid)
    if (validRows.length === 0) return fail('Aucune ligne valide à importer')

    let created = 0, duplicates = 0, errors = 0
    const results: any[] = []

    for (const row of validRows) {
      try {
        // Check duplicate by name + birth date
        const existing = await db.student.findFirst({
          where: {
            lastName:  { equals: row.lastName,  mode: 'insensitive' },
            firstName: { equals: row.firstName, mode: 'insensitive' },
            ...(row.birthDate ? { birthDate: new Date(row.birthDate) } : {}),
          },
        })
        if (existing) {
          duplicates++
          results.push({ ...row, status: 'duplicate', message: 'Élève déjà existant' })
          continue
        }

        // Generate matricule
        const school = await db.school.findFirst()
        const sigle  = school?.sigle ?? 'ECO'
        const year   = new Date().getFullYear()
        const count  = await db.student.count()
        const matricule = `${sigle}-${year}-${String(count + 1).padStart(4, '0')}`

        await db.student.create({
          data: {
            lastName:    row.lastName,
            firstName:   row.firstName,
            gender:      row.gender,
            birthDate:   row.birthDate ? new Date(row.birthDate) : undefined,
            birthPlace:  row.birthPlace  || undefined,
            nationality: row.nationality || undefined,
            phone:       row.phone       || undefined,
            address:     row.address     || undefined,
            email:       row.email       || undefined,
            matricule,
          },
        })

        try {
          await db.auditLog.create({ data: { userId: actorId, action: 'IMPORT_CREATE', entity: 'student', details: matricule } })
        } catch { /* non-fatal */ }

        created++
        results.push({ ...row, status: 'created', matricule })
      } catch (e: any) {
        errors++
        results.push({ ...row, status: 'error', message: e.message })
      }
    }

    return ok({ created, duplicates, errors, results })
  })

  /* ── Export students to Excel ─────────────────────────────────── */
  ipcMain.handle('students:exportExcel', async (_, classId?: string) => {
    try {
      const students = await db.student.findMany({
        where: classId
          ? { enrollments: { some: { classId } } }
          : undefined,
        include: {
          enrollments: {
            orderBy: { enrolledAt: 'desc' },
            take: 1,
            include: { class: true, academicYear: true },
          },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      const school = await db.school.findFirst()
      const className = classId
        ? students[0]?.enrollments[0]?.class?.name ?? 'classe'
        : 'tous-les-eleves'
      const defaultName = `eleves-${className}-${dayjs().format('YYYY-MM-DD')}.xlsx`

      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Exporter la liste des élèves',
        defaultPath: defaultName,
        filters:     [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (canceled || !filePath) return ok(null)

      const wb = new ExcelJS.Workbook()
      wb.creator = 'SGSI SchoolManager Pro'
      const ws   = wb.addWorksheet('Élèves')

      // Header
      ws.columns = [
        { header: 'N°',              key: 'num',         width: 6  },
        { header: 'Matricule',       key: 'matricule',   width: 20 },
        { header: 'Nom',             key: 'lastName',    width: 18 },
        { header: 'Prénom',          key: 'firstName',   width: 18 },
        { header: 'Sexe',            key: 'gender',      width: 12 },
        { header: 'Date naissance',  key: 'birthDate',   width: 16 },
        { header: 'Classe',          key: 'class',       width: 14 },
        { header: 'Année scolaire',  key: 'year',        width: 16 },
        { header: 'Téléphone',       key: 'phone',       width: 18 },
        { header: 'Adresse',         key: 'address',     width: 28 },
      ]

      const hRow = ws.getRow(1)
      hRow.eachCell(cell => {
        cell.font      = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      hRow.height = 24

      // Data rows
      students.forEach((s, i) => {
        const enroll = s.enrollments[0]
        const row = ws.addRow({
          num:       i + 1,
          matricule: s.matricule,
          lastName:  s.lastName,
          firstName: s.firstName,
          gender:    s.gender === 'MALE' ? 'MASCULIN' : 'FÉMININ',
          birthDate: s.birthDate ? dayjs(s.birthDate).format('DD/MM/YYYY') : '—',
          class:     enroll?.class?.name ?? '—',
          year:      enroll?.academicYear?.name ?? '—',
          phone:     s.phone ?? '—',
          address:   s.address ?? '—',
        })
        if (i % 2 === 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF4FE' } }
          })
        }
      })

      // Auto-fit + totals
      ws.addRow({})
      const totalRow = ws.addRow({ num: '', matricule: `Total : ${students.length} élève(s)` })
      totalRow.getCell('matricule').font = { bold: true, color: { argb: 'FF1565C0' } }

      await wb.xlsx.writeFile(filePath)
      return ok({ filePath, count: students.length })
    } catch (e: any) { return fail(e.message) }
  })

  /* ── Export payments to Excel ─────────────────────────────────── */
  ipcMain.handle('payments:exportExcel', async (_, year: number) => {
    try {
      const start = new Date(year, 0, 1)
      const end   = new Date(year, 11, 31, 23, 59, 59)

      const payments = await db.payment.findMany({
        where: {
          paidAt: { gte: start, lte: end },
          method: { not: 'PLAN' }, // exclude plan containers
        },
        include: {
          feeType: true,
          enrollment: {
            include: {
              student: true,
              class:   true,
            },
          },
        },
        orderBy: { paidAt: 'asc' },
      })

      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Exporter les paiements',
        defaultPath: `paiements-${year}.xlsx`,
        filters:     [{ name: 'Excel', extensions: ['xlsx'] }],
      })
      if (canceled || !filePath) return ok(null)

      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(`Paiements ${year}`)

      ws.columns = [
        { header: 'N°',         key: 'num',       width: 6  },
        { header: 'Date',       key: 'date',      width: 14 },
        { header: 'N° Reçu',   key: 'receipt',   width: 18 },
        { header: 'Élève',      key: 'student',   width: 24 },
        { header: 'Matricule',  key: 'matricule', width: 18 },
        { header: 'Classe',     key: 'class',     width: 14 },
        { header: 'Motif',      key: 'feeType',   width: 22 },
        { header: 'Montant (GNF)', key: 'amount', width: 18 },
        { header: 'Mode',       key: 'method',    width: 16 },
        { header: 'Remarque',   key: 'note',      width: 24 },
      ]

      const hRow = ws.getRow(1)
      hRow.eachCell(cell => {
        cell.font  = { bold: true, color: { argb: 'FFFFFFFF' } }
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      hRow.height = 24

      const METHODS: Record<string, string> = {
        CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave',
        MOBILE_MONEY: 'Mobile Money', BANK_TRANSFER: 'Virement',
      }

      let total = 0
      payments.forEach((p, i) => {
        total += p.amount
        const row = ws.addRow({
          num:       i + 1,
          date:      dayjs(p.paidAt).format('DD/MM/YYYY HH:mm'),
          receipt:   p.receiptNo,
          student:   `${p.enrollment?.student?.lastName} ${p.enrollment?.student?.firstName}`,
          matricule: p.enrollment?.student?.matricule ?? '—',
          class:     p.enrollment?.class?.name ?? '—',
          feeType:   p.feeType?.name ?? '—',
          amount:    p.amount,
          method:    METHODS[p.method] ?? p.method,
          note:      p.note ?? '',
        })
        if (i % 2 === 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECF4FE' } }
          })
        }
        row.getCell('amount').numFmt = '#,##0'
      })

      ws.addRow({})
      const totRow = ws.addRow({ num: '', date: 'TOTAL', amount: total })
      totRow.getCell('date').font   = { bold: true, color: { argb: 'FF1565C0' } }
      totRow.getCell('amount').font = { bold: true, color: { argb: 'FF1565C0' } }
      totRow.getCell('amount').numFmt = '#,##0'

      await wb.xlsx.writeFile(filePath)
      return ok({ filePath, count: payments.length, total })
    } catch (e: any) { return fail(e.message) }
  })
}
