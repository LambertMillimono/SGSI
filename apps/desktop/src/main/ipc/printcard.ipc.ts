import { ipcMain, BrowserWindow, dialog } from 'electron'
import type { PrismaClient } from '@prisma/client'
import QRCode from 'qrcode'
import path from 'path'
import fs from 'fs'

function ok<T>(data: T) { return { success: true, data } }
function fail(msg: string) { return { success: false, error: { code: 'ERROR', message: msg } } }

/**
 * Build the student ID card HTML.
 * Design: professional two-sided school card (landscape)
 * matching the standard school ID card layout.
 */
async function buildCardHtml(student: any, school: any): Promise<string> {
  const fullName   = `${student.lastName} ${student.firstName}`
  const enrollment = student.enrollments?.[0]
  const className  = enrollment?.class?.name ?? '—'
  const yearLabel  = enrollment?.academicYear?.name ?? new Date().getFullYear().toString()
  const matricule  = student.matricule ?? '—'
  const birthDate  = student.birthDate
    ? new Date(student.birthDate).toLocaleDateString('fr-FR')
    : '—'

  /* Parent info (via StudentParent junction) */
  const parentLinks   = student.parents ?? []
  const firstParent   = parentLinks[0]?.parent ?? null
  const guardian      = firstParent
    ? `${firstParent.lastName} ${firstParent.firstName}`
    : '—'
  const guardianPhone = firstParent?.phone ?? '—'

  /* School info */
  const schoolName    = school?.name    ?? 'SGSI — SchoolManager Pro'
  const schoolSlogan  = school?.address ?? 'Excellence · Innovation · Réussite'
  const schoolAddress = [school?.address, school?.city].filter(Boolean).join(', ') || '—'
  const schoolPhone   = school?.phone   ?? '—'
  const schoolEmail   = school?.email   ?? '—'
  const schoolWebsite = school?.website ?? 'www.sgsi.edu'

  /* QR Code */
  const qrData = JSON.stringify({
    id:   student.id,
    m:    matricule,
    nom:  fullName,
    cl:   className,
    an:   yearLabel,
  })
  const qrDataUri = await QRCode.toDataURL(qrData, {
    width: 100, margin: 1,
    color: { dark: '#1565C0', light: '#FFFFFF' },
  })

  /* Photo — supports both base64 data URLs and legacy file paths */
  let photoSrc = ''
  if (student.photo) {
    if (student.photo.startsWith('data:')) {
      photoSrc = student.photo          // already a data URL — use directly
    } else if (fs.existsSync(student.photo)) {
      const ext  = path.extname(student.photo).slice(1) || 'jpeg'
      const data = fs.readFileSync(student.photo)
      photoSrc   = `data:image/${ext};base64,${data.toString('base64')}`
    }
  }

  /* Validity */
  const joinedDate  = enrollment?.enrolledAt
    ? new Date(enrollment.enrolledAt).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR')
  const expireYear  = (new Date().getFullYear() + 1).toString()
  const expireDate  = `31/08/${expireYear}`

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Carte scolaire — ${fullName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #E8EEF5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 30px 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-title {
      font-size: 12px;
      font-weight: 700;
      color: #546E8A;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 20px;
      text-align: center;
    }

    .cards-wrapper {
      display: flex;
      flex-direction: column;
      gap: 28px;
      align-items: center;
      width: 100%;
    }

    .card-label {
      font-size: 10px;
      font-weight: 700;
      color: #78909C;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 6px;
      text-align: center;
    }

    /* ── Card shell — BOTH cards identical size ─────────── */
    .card {
      width: 640px;
      min-height: 280px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow:
        0 4px 6px rgba(0,0,0,0.08),
        0 12px 28px rgba(0,0,0,0.14),
        0 0 0 1px rgba(0,0,0,0.06);
      background: #FFFFFF;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* Make both cards the exact same rendered height */
    .card.card-front { height: 320px; }
    .card.card-back  { height: 320px; }

    /* ════════════════════════════════════════════════════════
       FRONT CARD
       ════════════════════════════════════════════════════════ */

    /* Top header bar */
    .front-header {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 40%, #1976D2 100%);
      display: flex;
      align-items: center;
      padding: 12px 18px;
      gap: 14px;
      position: relative;
    }

    /* Light blue accent stripe at very top */
    .front-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #40C4FF, #00B0FF, #40C4FF);
    }

    .header-logo-box {
      width: 52px; height: 52px;
      background: rgba(255,255,255,0.15);
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7);
      text-align: center; line-height: 1.3;
      flex-shrink: 0;
    }
    .header-title {
      flex: 1;
    }
    .header-school-name {
      font-size: 17px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .header-slogan {
      font-size: 9px;
      color: #90CAF9;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-badge {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    /* Card body — flex-grow fills the space between header and footer */
    .front-body {
      display: flex;
      padding: 16px 18px 14px;
      gap: 18px;
      background: #FFFFFF;
      flex: 1;
    }

    /* Photo section */
    .photo-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .photo-wrap {
      width: 108px;
      height: 132px;
      border: 2px solid #1565C0;
      border-radius: 4px;
      overflow: hidden;
      background: #ECF4FE;
      position: relative;
    }
    .photo-wrap img {
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .photo-placeholder {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 4px;
    }
    .photo-placeholder-icon {
      width: 48px; height: 48px;
      border: 2px dashed #90CAF9;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .photo-placeholder-icon svg { fill: #90CAF9; }
    .photo-placeholder-text {
      font-size: 8px; color: #90CAF9;
      text-transform: uppercase; letter-spacing: 0.06em;
    }

    /* Blue diagonal accent left of photo */
    .photo-accent {
      position: absolute;
      top: 0; left: 0;
      width: 0; height: 0;
      border-style: solid;
      border-width: 22px 22px 0 0;
      border-color: #1565C0 transparent transparent transparent;
    }

    /* Fields */
    .fields-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0;
    }

    .field-row {
      display: flex;
      align-items: baseline;
      padding: 5px 0;
      border-bottom: 1px dashed #E3F0FC;
    }
    .field-row:last-child { border-bottom: none; }

    .field-label {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      width: 112px;
      flex-shrink: 0;
    }
    .field-colon {
      font-size: 10px;
      color: #1565C0;
      margin: 0 6px;
      font-weight: 700;
    }
    .field-value {
      font-size: 11px;
      color: #1A237E;
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .field-value.large {
      font-size: 12px;
      font-weight: 700;
    }
    .field-value.mono {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: #0D47A1;
      letter-spacing: 0.05em;
    }

    /* Front footer */
    .front-footer {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 18px;
    }
    .footer-address {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .footer-address span {
      font-size: 8.5px;
      color: #BBDEFB;
      letter-spacing: 0.02em;
    }
    .footer-address span strong {
      color: #FFFFFF;
    }
    .signature-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .signature-line {
      width: 100px;
      height: 1px;
      background: rgba(255,255,255,0.5);
    }
    .signature-title {
      font-size: 8.5px;
      color: #90CAF9;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Blue accent decorative right of footer */
    .footer-accent {
      width: 18px;
      height: 100%;
      background: rgba(255,255,255,0.08);
      position: absolute;
      right: 0; top: 0;
      clip-path: polygon(100% 0, 0% 100%, 100% 100%);
    }

    /* ════════════════════════════════════════════════════════
       BACK CARD
       ════════════════════════════════════════════════════════ */

    .back-header {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      position: relative;
    }
    .back-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #40C4FF, #00B0FF, #40C4FF);
    }
    .back-header-title {
      font-size: 13px;
      font-weight: 800;
      color: #FFFFFF;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .back-dates {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .back-date-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .back-date-label {
      font-size: 8px;
      color: #90CAF9;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .back-date-value {
      font-size: 9px;
      color: #FFFFFF;
      font-weight: 700;
    }

    /* Back body — flex-grow to fill remaining space like the front */
    .back-body {
      padding: 14px 18px;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .terms-title {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }
    .terms-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .terms-list li {
      font-size: 9px;
      color: #546E8A;
      line-height: 1.5;
      padding-left: 12px;
      position: relative;
    }
    .terms-list li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #1565C0;
      font-weight: 700;
    }

    /* Back footer */
    .back-footer {
      background: #F5F8FF;
      border-top: 2px solid #1565C0;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .contact-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .contact-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .contact-label {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      width: 50px;
      flex-shrink: 0;
    }
    .contact-value {
      font-size: 9px;
      color: #37474F;
      font-weight: 500;
    }
    .back-logo-qr {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .back-logo-box {
      font-size: 9px;
      font-weight: 800;
      color: #1565C0;
      text-align: center;
      line-height: 1.3;
    }
    .qr-box {
      width: 68px; height: 68px;
      border: 1.5px solid #1565C0;
      border-radius: 4px;
      padding: 3px;
      background: white;
    }
    .qr-box img { width: 100%; }

    /* Print hint */
    .no-print {
      margin-top: 28px;
      text-align: center;
      font-size: 12px;
      color: #90A4AE;
    }
    .no-print kbd {
      background: #ECEFF1;
      border: 1px solid #CFD8DC;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="page-title">Carte scolaire — Année ${yearLabel}</div>

  <div class="cards-wrapper">

    <!-- ═══════ RECTO ═══════ -->
    <div>
      <div class="card-label">Recto</div>
      <div class="card card-front">

        <!-- Header -->
        <div class="front-header">
          <div class="header-logo-box">LOGO<br/>HERE</div>
          <div class="header-title">
            <div class="header-school-name">${schoolName}</div>
            <div class="header-slogan">${schoolSlogan}</div>
          </div>
          <div class="header-badge">Carte Scolaire</div>
        </div>

        <!-- Body -->
        <div class="front-body">

          <!-- Photo -->
          <div class="photo-col">
            <div class="photo-wrap">
              <div class="photo-accent"></div>
              ${photoSrc
                ? `<img src="${photoSrc}" alt="Photo"/>`
                : `<div class="photo-placeholder">
                    <div class="photo-placeholder-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                    <div class="photo-placeholder-text">Photo</div>
                  </div>`
              }
            </div>
          </div>

          <!-- Fields -->
          <div class="fields-col">
            <div class="field-row">
              <span class="field-label">Matricule</span>
              <span class="field-colon">:</span>
              <span class="field-value mono">${matricule}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Nom complet</span>
              <span class="field-colon">:</span>
              <span class="field-value large">${fullName}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Date de naissance</span>
              <span class="field-colon">:</span>
              <span class="field-value">${birthDate}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Père / Tuteur</span>
              <span class="field-colon">:</span>
              <span class="field-value">${guardian}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Classe</span>
              <span class="field-colon">:</span>
              <span class="field-value large">${className}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Urgence</span>
              <span class="field-colon">:</span>
              <span class="field-value">${guardianPhone}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="front-footer" style="position:relative">
          <div class="footer-address">
            <span><strong>Adresse :</strong> ${schoolAddress}</span>
            <span><strong>Tél :</strong> ${schoolPhone}</span>
          </div>
          <div class="signature-area">
            <div style="height:18px"></div>
            <div class="signature-line"></div>
            <div class="signature-title">Le Directeur</div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══════ VERSO ═══════ -->
    <div>
      <div class="card-label">Verso</div>
      <div class="card card-back">

        <!-- Header -->
        <div class="back-header">
          <div class="back-header-title">Termes et Conditions</div>
          <div class="back-dates">
            <div class="back-date-row">
              <span class="back-date-label">Date d'entrée :</span>
              <span class="back-date-value">${joinedDate}</span>
            </div>
            <div class="back-date-row">
              <span class="back-date-label">Expire le :</span>
              <span class="back-date-value">${expireDate}</span>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="back-body">
          <ul class="terms-list">
            <li>Cette carte est strictement personnelle et non transférable. Elle doit être présentée à toute demande d'un membre du personnel de l'établissement.</li>
            <li>En cas de perte ou de vol, le titulaire est tenu d'en informer immédiatement la direction. Des frais de remplacement pourront être appliqués.</li>
            <li>Toute falsification ou utilisation frauduleuse de cette carte entraînera des sanctions disciplinaires et pourra faire l'objet de poursuites.</li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="back-footer">
          <div class="contact-col">
            <div class="contact-row">
              <span class="contact-label">Téléphone</span>
              <span class="contact-value">${schoolPhone}</span>
            </div>
            <div class="contact-row">
              <span class="contact-label">Email</span>
              <span class="contact-value">${schoolEmail}</span>
            </div>
            <div class="contact-row">
              <span class="contact-label">Site web</span>
              <span class="contact-value">${schoolWebsite}</span>
            </div>
          </div>
          <div class="back-logo-qr">
            <div class="back-logo-box">${schoolName}</div>
            <div class="qr-box">
              <img src="${qrDataUri}" alt="QR Code de vérification"/>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>

  <div class="no-print">
    Appuyez sur <kbd>Ctrl+P</kbd> pour imprimer · Choisissez "Enregistrer en PDF" pour sauvegarder
  </div>
</body>
</html>`
}

export function registerPrintCardIpc(db: PrismaClient): void {
  ipcMain.handle('students:printCard', async (_, studentId: string) => {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            orderBy: { enrolledAt: 'desc' },
            take: 1,
            include: {
              class:        { include: { level: true } },
              academicYear: true,
            },
          },
          parents: { include: { parent: true }, take: 1 },
        },
      })
      if (!student) return fail('Élève introuvable')

      const school = await db.school.findFirst()
      const html   = await buildCardHtml(student, school)

      const win = new BrowserWindow({
        width:  720,
        height: 820,
        title:  `Carte scolaire — ${student.lastName} ${student.firstName}`,
        show:   false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration:  false,
        },
      })

      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      win.once('ready-to-show', () => {
        win.show()
        setTimeout(() => win.focus(), 150)
      })

      return ok({ opened: true })
    } catch (e: any) {
      return fail(e.message)
    }
  })

  ipcMain.handle('students:saveCardPdf', async (_, studentId: string) => {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            orderBy: { enrolledAt: 'desc' },
            take: 1,
            include: { class: true, academicYear: true },
          },
          parents: { include: { parent: true }, take: 1 },
        },
      })
      if (!student) return fail('Élève introuvable')

      const { canceled, filePath } = await dialog.showSaveDialog({
        title:       'Enregistrer la carte scolaire en PDF',
        defaultPath: `carte-scolaire-${student.matricule ?? student.id}.pdf`,
        filters:     [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return ok(null)

      const school = await db.school.findFirst()
      const html   = await buildCardHtml(student, school)

      const win = new BrowserWindow({
        width: 800, height: 600,
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false },
      })

      await new Promise<void>((resolve, reject) => {
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
        win.webContents.once('did-finish-load', async () => {
          try {
            const pdfBuffer = await win.webContents.printToPDF({
              printBackground: true,
              pageSize:        'A4',
              landscape:       false,
            })
            require('fs').writeFileSync(filePath, pdfBuffer)
            win.destroy()
            resolve()
          } catch (err) { win.destroy(); reject(err) }
        })
      })

      return ok({ filePath })
    } catch (e: any) {
      return fail(e.message)
    }
  })
}
