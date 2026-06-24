import type { PrismaClient } from '@prisma/client'
import { sendEmail, sendSms, loadBrevoConfig } from './email.service'

export interface OverdueParent {
  studentId:       string
  studentName:     string
  className:       string
  amountDue:       number
  amountPaid:      number
  balance:         number
  daysOverdue:     number
  parentId:        string
  parentName:      string
  phone:           string | null
  email:           string | null
  channel:         'SMS' | 'EMAIL' | 'BOTH' | 'NONE'
  lastRemindedAt:  Date | null
  alreadyReminded: boolean
}

export class RelanceService {
  constructor(private db: PrismaClient) {}

  async getOverdueParents(thresholdDays = 30): Promise<OverdueParent[]> {
    const enrollments = await this.db.enrollment.findMany({
      where: { status: 'ACTIVE' },
      include: {
        student: {
          include: {
            parents: { include: { parent: true } },
          },
        },
        class: { include: { level: true } },
        payments: true,
      },
    })

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const results: OverdueParent[] = []

    for (const e of enrollments) {
      const feeTypes = await this.db.feeType.findMany({
        where: { OR: [{ levelId: e.class.levelId }, { levelId: null }], isRequired: true },
      })
      const totalDue  = feeTypes.reduce((s, f) => s + f.amount, 0)
      const totalPaid = e.payments.reduce((s, p) => s + p.amount, 0)
      const balance   = totalDue - totalPaid

      if (balance <= 0) continue

      const enrolledAt  = (e as any).createdAt ?? new Date()
      const daysOverdue = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (1000 * 60 * 60 * 24))
      if (daysOverdue < thresholdDays) continue

      const link   = (e.student as any).parents?.[0]
      const parent = link?.parent ?? null

      const lastLog = parent ? await this.db.reminderLog.findFirst({
        where:   { studentId: e.studentId, parentId: parent.id },
        orderBy: { sentAt: 'desc' },
      }) : null

      const alreadyReminded = lastLog ? new Date(lastLog.sentAt) > sevenDaysAgo : false

      const hasPhone = !!(parent?.phone)
      const hasEmail = !!(parent?.email)
      const channel: OverdueParent['channel'] =
        hasPhone && hasEmail ? 'BOTH' :
        hasPhone             ? 'SMS'  :
        hasEmail             ? 'EMAIL': 'NONE'

      results.push({
        studentId:       e.studentId,
        studentName:     `${e.student.firstName} ${e.student.lastName}`,
        className:       e.class.name,
        amountDue:       totalDue,
        amountPaid:      totalPaid,
        balance,
        daysOverdue,
        parentId:        parent?.id ?? '',
        parentName:      parent ? `${parent.firstName} ${parent.lastName}` : 'Inconnu',
        phone:           parent?.phone ?? null,
        email:           parent?.email ?? null,
        channel,
        lastRemindedAt:  lastLog ? new Date(lastLog.sentAt) : null,
        alreadyReminded,
      })
    }

    return results
  }

  async sendReminders(parentIds: string[]): Promise<{ sent: number; failed: number; skipped: number }> {
    const config = loadBrevoConfig()
    if (!config?.apiKey) throw new Error('Brevo non configure. Allez dans Parametres > Email.')

    const school      = await this.db.school.findFirst()
    const schoolName  = school?.name     ?? 'Notre etablissement'
    const schoolPhone = school?.phone    ?? ''
    const currency    = (school as any)?.currency ?? 'GNF'

    const overdueList = await this.getOverdueParents(0)
    const targets     = overdueList.filter(o => parentIds.includes(o.parentId))

    let sent = 0, failed = 0, skipped = 0

    for (const target of targets) {
      if (target.channel === 'NONE') { skipped++; continue }

      const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('fr-FR')

      const smsText =
        `Bonjour ${target.parentName}, votre enfant ${target.studentName} ` +
        `a un impaye de ${target.balance.toLocaleString('fr-FR')} ${currency}. ` +
        `Merci de regulariser avant le ${deadlineDate}. ` +
        `${schoolName} - ${schoolPhone}`

      const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">` +
        `<h2 style="color:#1e3a8a">${schoolName}</h2>` +
        `<p>Bonjour <strong>${target.parentName}</strong>,</p>` +
        `<p>Votre enfant <strong>${target.studentName}</strong> (Classe : ${target.className}) ` +
        `a un solde impaye de <strong style="color:#dc2626">${target.balance.toLocaleString('fr-FR')} ${currency}</strong>.</p>` +
        `<p>Merci de regulariser avant le <strong>${deadlineDate}</strong>.</p>` +
        `<p>Contact : <strong>${schoolPhone}</strong></p>` +
        `<p style="color:#6b7280;font-size:12px">-- ${schoolName}</p></div>`

      let status: 'SENT' | 'FAILED' = 'SENT'
      let errorMsg: string | undefined

      try {
        if (target.channel === 'SMS' || target.channel === 'BOTH') {
          await sendSms({ to: target.phone!, message: smsText, sender: 'SGSI' })
        }
        if ((target.channel === 'EMAIL' || target.channel === 'BOTH') && target.email) {
          await sendEmail({
            to:      target.email,
            subject: `Rappel de paiement - ${target.studentName}`,
            html:    emailHtml,
            text:    smsText,
          })
        }
        sent++
      } catch (e: any) {
        status   = 'FAILED'
        errorMsg = e.message
        failed++
      }

      await this.db.reminderLog.create({
        data: {
          parentId:   target.parentId,
          studentId:  target.studentId,
          amountDue:  target.balance,
          channel:    target.channel,
          status,
          errorMsg,
          schoolYear: new Date().getFullYear().toString(),
        },
      })
    }

    return { sent, failed, skipped }
  }

  async getReminderHistory() {
    return this.db.reminderLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 200,
      include: {
        parent:  { select: { firstName: true, lastName: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    })
  }

  async generateLettersHtml(parentIds: string[]): Promise<string> {
    const school      = await this.db.school.findFirst()
    const schoolName  = school?.name         ?? 'Notre Etablissement'
    const schoolAddr  = school?.address      ?? ''
    const schoolPhone = school?.phone        ?? ''
    const dirName     = school?.directorName ?? 'Le Directeur'
    const currency    = (school as any)?.currency ?? 'GNF'
    const today       = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const deadline    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')

    const overdueList = await this.getOverdueParents(0)
    const targets     = overdueList.filter(o => parentIds.includes(o.parentId))

    const pageStyle = `<style>
      @page { size: A4; margin: 2cm; }
      body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; }
      .letter { page-break-after: always; min-height: 24cm; }
      .letter:last-child { page-break-after: avoid; }
      .header { display: flex; justify-content: space-between; margin-bottom: 32px; }
      .school-info { font-weight: bold; }
      .date-loc { text-align: right; }
      .object { font-weight: bold; margin: 24px 0 16px; }
      .body-text { line-height: 2; text-align: justify; }
      .signature { margin-top: 48px; text-align: right; }
      .sig-line { margin-top: 48px; border-top: 1px solid #000; width: 200px; display: inline-block; }
      hr { border: none; border-top: 2px solid #000; margin: 8px 0; }
    </style>`

    const letters = targets.map(t =>
      `<div class="letter">
        <div class="header">
          <div class="school-info">
            <div style="font-size:16pt">${schoolName}</div>
            <div>${schoolAddr}</div>
            <div>Tel : ${schoolPhone}</div>
            <hr/>
          </div>
          <div class="date-loc">Conakry, le ${today}</div>
        </div>
        <div style="margin-bottom:24px">
          <strong>A l'attention de :</strong><br/>
          ${t.parentName}<br/>
          <em>Parent/Tuteur de ${t.studentName}</em>
        </div>
        <div class="object">Objet : Rappel de paiement - ${t.studentName} (${t.className})</div>
        <div class="body-text">
          <p>Monsieur / Madame ${t.parentName},</p>
          <p>Nous vous informons que le compte de votre enfant <strong>${t.studentName}</strong>,
          inscrit en classe de <strong>${t.className}</strong>, presente un solde impaye de
          <strong>${t.balance.toLocaleString('fr-FR')} ${currency}</strong> a la date du ${today}.</p>
          <p>Nous vous prions de bien vouloir regulariser votre situation dans un delai de
          <strong>7 jours</strong> a compter de la reception de ce courrier,
          soit au plus tard le <strong>${deadline}</strong>.</p>
          <p>Pour tout renseignement, veuillez contacter notre service de comptabilite
          au <strong>${schoolPhone}</strong>.</p>
          <p>Nous vous remercions de votre comprehension.</p>
        </div>
        <div class="signature">
          <p>${dirName}</p>
          <div class="sig-line"></div>
          <p><em>(Signature et cachet)</em></p>
        </div>
      </div>`
    )

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>${pageStyle}</head><body>${letters.join('')}</body></html>`
  }
}
