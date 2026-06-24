import { ipcMain, dialog, app, shell } from 'electron'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import { ok, fail } from '@sgsi/shared'

const PAY_METHODS: Record<string, string> = {
  CASH: 'Espèces', ORANGE_MONEY: 'Orange Money', WAVE: 'Wave',
  MOBILE_MONEY: 'Mobile Money', BANK_CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement', CHECK: 'Chèque',
}

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre']

export function registerReportsIpc(db: PrismaClient): void {

  // ── Export financier (paiements de l'année) vers Excel ─────────────────────
  ipcMain.handle('reports:exportFinancialExcel', async (_, year: number) => {
    try {
      const ExcelJS = require('exceljs')

      const [payments, school] = await Promise.all([
        db.payment.findMany({
          where: { paidAt: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) } },
          include: {
            enrollment: { include: { student: true, class: true } },
            feeType: true,
          },
          orderBy: { paidAt: 'desc' },
        }),
        db.school.findFirst(),
      ])

      const wb = new ExcelJS.Workbook()
      wb.creator = 'SGSI SchoolManager'
      wb.created = new Date()

      // ── Styles helpers ──────────────────────────────────────────────────────
      const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } } as const
      const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
      const altFill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } } as const

      function styleHeader(row: any) {
        row.eachCell((cell: any) => {
          cell.fill = headerFill
          cell.font = headerFont
          cell.alignment = { vertical: 'middle', horizontal: 'center' }
          cell.border = { bottom: { style: 'thin', color: { argb: 'FF93C5FD' } } }
        })
        row.height = 22
      }

      // ── Feuille 1 : Détail des paiements ──────────────────────────────────
      const wsDetail = wb.addWorksheet('Détail paiements')
      wsDetail.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
      wsDetail.columns = [
        { key: 'receiptNo',  width: 20 },
        { key: 'date',       width: 14 },
        { key: 'student',    width: 30 },
        { key: 'matricule',  width: 16 },
        { key: 'class',      width: 14 },
        { key: 'feeType',    width: 22 },
        { key: 'amount',     width: 18 },
        { key: 'method',     width: 16 },
      ]

      const titleRow = wsDetail.addRow([`RAPPORT FINANCIER ${year} — ${school?.name ?? 'SGSI'}`])
      titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: 'FF1E3A8A' } }
      wsDetail.mergeCells('A1:H1')
      wsDetail.addRow([])

      const hRow = wsDetail.addRow([
        'N° Reçu', 'Date', 'Élève', 'Matricule', 'Classe',
        'Type de frais', 'Montant (GNF)', 'Mode paiement',
      ])
      styleHeader(hRow)

      payments.forEach((p, i) => {
        const row = wsDetail.addRow({
          receiptNo: p.receiptNo,
          date: new Date(p.paidAt).toLocaleDateString('fr-FR'),
          student: `${p.enrollment.student.lastName} ${p.enrollment.student.firstName}`,
          matricule: p.enrollment.student.matricule,
          class: p.enrollment.class.name,
          feeType: p.feeType.name,
          amount: p.amount,
          method: PAY_METHODS[p.method] ?? p.method,
        })
        if (i % 2 === 0) {
          row.eachCell({ includeEmpty: true }, (cell: any, col: number) => {
            if (col <= 8) cell.fill = altFill
          })
        }
        row.getCell('amount').numFmt = '#,##0'
        row.getCell('amount').alignment = { horizontal: 'right' }
      })

      // Total row
      const totalRow = wsDetail.addRow(['', '', '', '', '', 'TOTAL', payments.reduce((s, p) => s + p.amount, 0), ''])
      totalRow.getCell(6).font = { bold: true }
      totalRow.getCell(7).font = { bold: true, color: { argb: 'FF1E3A8A' } }
      totalRow.getCell(7).numFmt = '#,##0'

      // ── Feuille 2 : Récapitulatif mensuel ────────────────────────────────
      const wsMonth = wb.addWorksheet('Par mois')
      wsMonth.columns = [
        { key: 'month', width: 16 },
        { key: 'count', width: 14 },
        { key: 'total', width: 20 },
      ]

      wsMonth.addRow([`Récapitulatif mensuel — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } }
      wsMonth.mergeCells('A1:C1')
      wsMonth.addRow([])

      const mHeader = wsMonth.addRow(['Mois', 'Nb paiements', 'Total (GNF)'])
      styleHeader(mHeader)

      const byMonth: Record<number, { count: number; total: number }> = {}
      payments.forEach(p => {
        const m = new Date(p.paidAt).getMonth() + 1
        if (!byMonth[m]) byMonth[m] = { count: 0, total: 0 }
        byMonth[m].count += 1
        byMonth[m].total += p.amount
      })

      let grandTotal = 0
      for (let m = 1; m <= 12; m++) {
        const d = byMonth[m] ?? { count: 0, total: 0 }
        const row = wsMonth.addRow({ month: MONTHS[m - 1], count: d.count, total: d.total })
        row.getCell('total').numFmt = '#,##0'
        if (d.total > 0) row.getCell('total').font = { color: { argb: 'FF15803D' } }
        grandTotal += d.total
      }
      const gRow = wsMonth.addRow({ month: 'TOTAL ANNÉE', count: payments.length, total: grandTotal })
      gRow.eachCell((cell: any) => { cell.font = { bold: true } })
      gRow.getCell('total').numFmt = '#,##0'
      gRow.getCell('total').font = { bold: true, color: { argb: 'FF1E3A8A' } }

      // ── Feuille 3 : Par type de frais ─────────────────────────────────────
      const wsFee = wb.addWorksheet('Par type de frais')
      wsFee.columns = [
        { key: 'feeType', width: 24 },
        { key: 'count',   width: 14 },
        { key: 'total',   width: 20 },
      ]

      wsFee.addRow([`Par type de frais — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } }
      wsFee.mergeCells('A1:C1')
      wsFee.addRow([])
      styleHeader(wsFee.addRow(['Type de frais', 'Nb paiements', 'Total (GNF)']))

      const byFee: Record<string, { count: number; total: number }> = {}
      payments.forEach(p => {
        const k = p.feeType.name
        if (!byFee[k]) byFee[k] = { count: 0, total: 0 }
        byFee[k].count += 1
        byFee[k].total += p.amount
      })
      Object.entries(byFee).sort(([, a], [, b]) => b.total - a.total).forEach(([name, d]) => {
        const row = wsFee.addRow({ feeType: name, count: d.count, total: d.total })
        row.getCell('total').numFmt = '#,##0'
      })

      // ── Feuille 4 : Liste des élèves ──────────────────────────────────────
      const wsStudents = wb.addWorksheet('Liste élèves')
      wsStudents.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }]
      wsStudents.columns = [
        { key: 'matricule',  width: 18 },
        { key: 'lastName',   width: 20 },
        { key: 'firstName',  width: 20 },
        { key: 'gender',     width: 10 },
        { key: 'class',      width: 14 },
        { key: 'birthDate',  width: 16 },
        { key: 'phone',      width: 16 },
        { key: 'email',      width: 26 },
      ]

      wsStudents.addRow([`Liste des élèves — ${school?.name ?? 'SGSI'} — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: 'FF1E3A8A' } }
      wsStudents.mergeCells('A1:H1')
      wsStudents.addRow([])
      styleHeader(wsStudents.addRow(['Matricule','Nom','Prénom','Genre','Classe','Date naissance','Téléphone','Email']))

      const students = await db.student.findMany({
        include: { enrollments: { include: { class: true }, orderBy: { enrolledAt: 'desc' }, take: 1 } },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      })

      students.forEach((s, i) => {
        const cls = s.enrollments[0]?.class?.name ?? '—'
        const row = wsStudents.addRow({
          matricule: s.matricule,
          lastName: s.lastName,
          firstName: s.firstName,
          gender: s.gender === 'MALE' ? 'M' : 'F',
          class: cls,
          birthDate: s.birthDate ? new Date(s.birthDate).toLocaleDateString('fr-FR') : '—',
          phone: s.phone ?? '—',
          email: s.email ?? '—',
        })
        if (i % 2 === 0) row.eachCell({ includeEmpty: true }, (cell: any, col: number) => { if (col <= 8) cell.fill = altFill })
      })

      // ── Sauvegarde ───────────────────────────────────────────────────────
      const defaultName = `rapport-${year}-${school?.sigle ?? 'SGSI'}.xlsx`
      const saveResult = await dialog.showSaveDialog({
        title: 'Enregistrer le rapport Excel',
        defaultPath: path.join(app.getPath('desktop'), defaultName),
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      })

      if (saveResult.canceled || !saveResult.filePath) return ok(null)
      await wb.xlsx.writeFile(saveResult.filePath)
      shell.openPath(path.dirname(saveResult.filePath))
      return ok({ filePath: saveResult.filePath })
    } catch (e: any) {
      return fail('EXCEL_ERROR', e.message)
    }
  })
}
