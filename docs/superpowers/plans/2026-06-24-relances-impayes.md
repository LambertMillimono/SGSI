# Relances Impayés Automatiques — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une page "Relances" permettant d'envoyer SMS/email aux parents en retard de paiement et d'imprimer des lettres formelles, avec une alerte au démarrage de l'app.

**Architecture:** Un nouveau service `relance.service.ts` interroge `listUnpaid()` et joint les données parents, envoie via `email.service.ts` (Brevo, déjà configuré), et persiste l'historique dans `ReminderLog`. Un IPC bridge expose 4 endpoints au renderer. La page UI a 2 onglets : Impayés (envoi + impression) et Historique.

**Tech Stack:** TypeScript, Prisma (SQLite), Electron IPC, React + Ant Design, Brevo API (SMS + email)

---

## File Map

| Action | Fichier |
|--------|---------|
| Create | `packages/db/prisma/schema.prisma` (ajout ReminderLog) |
| Create | `apps/desktop/src/main/services/relance.service.ts` |
| Create | `apps/desktop/src/main/ipc/relances.ipc.ts` |
| Create | `apps/desktop/src/renderer/pages/relances/RelancesPage.tsx` |
| Modify | `apps/desktop/src/main/ipc/index.ts` |
| Modify | `apps/desktop/src/renderer/utils/ipcBridge.ts` |
| Modify | `apps/desktop/src/renderer/App.tsx` |
| Modify | `apps/desktop/src/renderer/components/layout/Sidebar.tsx` |
| Modify | `apps/desktop/src/main/index.ts` |

---

## Task 1: Modèle Prisma ReminderLog

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Étape 1 : Ajouter le modèle ReminderLog à la fin du schema**

Ouvrir `packages/db/prisma/schema.prisma` et ajouter à la fin :

```prisma
model ReminderLog {
  id          String   @id @default(cuid())
  parentId    String
  studentId   String
  amountDue   Float
  channel     String
  status      String
  sentAt      DateTime @default(now())
  errorMsg    String?
  schoolYear  String   @default("")

  parent  Parent  @relation(fields: [parentId], references: [id])
  student Student @relation(fields: [studentId], references: [id])
}
```

- [ ] **Étape 2 : Ajouter la relation inverse sur Parent**

Dans le modèle `Parent` existant, ajouter :
```prisma
  reminders   ReminderLog[]
```

- [ ] **Étape 3 : Ajouter la relation inverse sur Student**

Dans le modèle `Student` existant, ajouter :
```prisma
  reminders   ReminderLog[]
```

- [ ] **Étape 4 : Créer et appliquer la migration**

```bash
cd packages/db
npx prisma migrate dev --name add_reminder_log
npx prisma generate
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Étape 5 : Commit**

```bash
git add packages/db/prisma/
git commit -m "feat(db): add ReminderLog model for payment reminders"
```

---

## Task 2: Service relance.service.ts

**Files:**
- Create: `apps/desktop/src/main/services/relance.service.ts`

- [ ] **Étape 1 : Créer le fichier avec les imports et types**

```typescript
import type { PrismaClient } from '@prisma/client'
import { sendEmail, sendSms, loadBrevoConfig } from './email.service'

export interface OverdueParent {
  studentId:      string
  studentName:    string
  className:      string
  amountDue:      Float
  amountPaid:     Float
  balance:        Float
  daysOverdue:    number
  parentId:       string
  parentName:     string
  phone:          string | null
  email:          string | null
  channel:        'SMS' | 'EMAIL' | 'BOTH' | 'NONE'
  lastRemindedAt: Date | null
  alreadyReminded: boolean
}

export class RelanceService {
  constructor(private db: PrismaClient) {}
```

Corriger le type `Float` → `number` :

```typescript
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
```

- [ ] **Étape 2 : Ajouter `getOverdueParents()`**

```typescript
  async getOverdueParents(thresholdDays = 30): Promise<OverdueParent[]> {
    // 1. Récupérer tous les enrollments actifs avec paiements et parents
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

    const school = await this.db.school.findFirst()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const results: OverdueParent[] = []

    for (const e of enrollments) {
      // Calcul du solde
      const feeTypes = await this.db.feeType.findMany({
        where: { OR: [{ levelId: e.class.levelId }, { levelId: null }], isRequired: true },
      })
      const totalDue  = feeTypes.reduce((s, f) => s + f.amount, 0)
      const totalPaid = e.payments.reduce((s, p) => s + p.amount, 0)
      const balance   = totalDue - totalPaid

      if (balance <= 0) continue

      // Calcul du retard : ancienneté de l'inscription
      const enrolledAt = e.createdAt ?? new Date()
      const daysOverdue = Math.floor((Date.now() - enrolledAt.getTime()) / (1000 * 60 * 60 * 24))
      if (daysOverdue < thresholdDays) continue

      // Parent principal (premier lien)
      const link   = e.student.parents[0]
      const parent = link?.parent ?? null

      // Dernière relance envoyée
      const lastLog = await this.db.reminderLog.findFirst({
        where:   { studentId: e.studentId, parentId: parent?.id ?? '' },
        orderBy: { sentAt: 'desc' },
      })

      const alreadyReminded = lastLog ? lastLog.sentAt > sevenDaysAgo : false

      // Déterminer le canal
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
        lastRemindedAt:  lastLog?.sentAt ?? null,
        alreadyReminded,
      })
    }

    return results
  }
```

- [ ] **Étape 3 : Ajouter `sendReminders()`**

```typescript
  async sendReminders(parentIds: string[]): Promise<{ sent: number; failed: number; skipped: number }> {
    const config = loadBrevoConfig()
    if (!config?.apiKey) throw new Error('Brevo non configure. Allez dans Parametres > Email.')

    const school = await this.db.school.findFirst()
    const schoolName  = school?.name  ?? 'Notre etablissement'
    const schoolPhone = school?.phone ?? ''
    const currency    = school?.currency ?? 'GNF'

    const overdueList = await this.getOverdueParents(0)
    const targets = overdueList.filter(o => parentIds.includes(o.parentId))

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

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#1e3a8a">${schoolName}</h2>
          <p>Bonjour <strong>${target.parentName}</strong>,</p>
          <p>Nous vous informons que votre enfant <strong>${target.studentName}</strong>
          (Classe : ${target.className}) a un solde impayé de
          <strong style="color:#dc2626">${target.balance.toLocaleString('fr-FR')} ${currency}</strong>.</p>
          <p>Merci de régulariser votre situation avant le <strong>${deadlineDate}</strong>.</p>
          <p>Pour tout renseignement, contactez-nous au <strong>${schoolPhone}</strong>.</p>
          <p style="color:#6b7280;font-size:12px">— ${schoolName}</p>
        </div>`

      let status: 'SENT' | 'FAILED' = 'SENT'
      let errorMsg: string | undefined

      try {
        if (target.channel === 'SMS' || target.channel === 'BOTH') {
          await sendSms({ to: target.phone!, message: smsText, sender: 'SGSI' })
        }
        if ((target.channel === 'EMAIL' || target.channel === 'BOTH') && target.email) {
          await sendEmail({
            to: target.email,
            subject: `Rappel de paiement — ${target.studentName}`,
            html: emailHtml,
            text: smsText,
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
          parentId:  target.parentId,
          studentId: target.studentId,
          amountDue: target.balance,
          channel:   target.channel,
          status,
          errorMsg,
          schoolYear: new Date().getFullYear().toString(),
        },
      })
    }

    return { sent, failed, skipped }
  }
```

- [ ] **Étape 4 : Ajouter `getReminderHistory()` et `generateLetterHtml()`**

```typescript
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
    const school = await this.db.school.findFirst()
    const schoolName  = school?.name        ?? 'Notre Etablissement'
    const schoolAddr  = school?.address     ?? ''
    const schoolPhone = school?.phone       ?? ''
    const dirName     = school?.directorName ?? 'Le Directeur'
    const currency    = school?.currency    ?? 'GNF'
    const today       = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const deadline    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR')

    const overdueList = await this.getOverdueParents(0)
    const targets = overdueList.filter(o => parentIds.includes(o.parentId))

    const pageStyle = `
      <style>
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

    const letters = targets.map(t => `
      <div class="letter">
        <div class="header">
          <div class="school-info">
            <div style="font-size:16pt">${schoolName}</div>
            <div>${schoolAddr}</div>
            <div>Tel : ${schoolPhone}</div>
            <hr/>
          </div>
          <div class="date-loc">
            Conakry, le ${today}
          </div>
        </div>

        <div style="margin-bottom:24px">
          <strong>À l'attention de :</strong><br/>
          ${t.parentName}<br/>
          <em>Parent/Tuteur de ${t.studentName}</em>
        </div>

        <div class="object">
          Objet : Rappel de paiement — ${t.studentName} (${t.className})
        </div>

        <div class="body-text">
          <p>Monsieur / Madame ${t.parentName},</p>

          <p>Nous vous informons que le compte de votre enfant
          <strong>${t.studentName}</strong>, inscrit en classe de
          <strong>${t.className}</strong>, présente un solde impayé de
          <strong>${t.balance.toLocaleString('fr-FR')} ${currency}</strong>
          à la date du ${today}.</p>

          <p>Nous vous prions de bien vouloir régulariser votre situation
          dans un délai de <strong>7 jours</strong> à compter de la réception
          de ce courrier, soit au plus tard le <strong>${deadline}</strong>.</p>

          <p>Pour tout renseignement, veuillez contacter notre service de
          comptabilité au <strong>${schoolPhone}</strong>.</p>

          <p>Nous vous remercions de votre compréhension et restons
          disponibles pour tout arrangement.</p>
        </div>

        <div class="signature">
          <p>${dirName}</p>
          <div class="sig-line"></div>
          <p><em>(Signature et cachet)</em></p>
        </div>
      </div>`)

    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>${pageStyle}</head><body>${letters.join('')}</body></html>`
  }
}
```

- [ ] **Étape 5 : Commit**

```bash
git add apps/desktop/src/main/services/relance.service.ts
git commit -m "feat(services): add RelanceService (overdue parents, send, history, letters)"
```

---

## Task 3: IPC relances.ipc.ts

**Files:**
- Create: `apps/desktop/src/main/ipc/relances.ipc.ts`
- Modify: `apps/desktop/src/main/ipc/index.ts`

- [ ] **Étape 1 : Créer relances.ipc.ts**

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { RelanceService } from '../services/relance.service'
import { ok, fail } from '@sgsi/shared'

export function registerRelancesIpc(db: PrismaClient): void {
  const service = new RelanceService(db)

  ipcMain.handle('relances:list', async (_, thresholdDays = 30) => {
    try { return ok(await service.getOverdueParents(thresholdDays)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:send', async (_, parentIds: string[]) => {
    try { return ok(await service.sendReminders(parentIds)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:history', async () => {
    try { return ok(await service.getReminderHistory()) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('relances:printLetters', async (_, parentIds: string[]) => {
    try { return ok(await service.generateLettersHtml(parentIds)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}

/** Called from main/index.ts at startup — notifies renderer if overdue payments exist */
export async function checkOverdueAtStartup(db: PrismaClient, win: BrowserWindow): Promise<void> {
  try {
    const service  = new RelanceService(db)
    const overdue  = await service.getOverdueParents(30)
    if (overdue.length === 0) return

    const totalBalance = overdue.reduce((s, o) => s + o.balance, 0)
    win.webContents.send('relances:startup-alert', {
      count:   overdue.length,
      total:   totalBalance,
      currency: 'GNF',
    })
  } catch {
    // Startup check is non-critical — ignore errors
  }
}
```

- [ ] **Étape 2 : Enregistrer dans ipc/index.ts**

Ajouter l'import :
```typescript
import { registerRelancesIpc } from './relances.ipc'
```

Ajouter l'appel dans `registerIpcHandlers()`, après `registerDisciplineIpc(db)` :
```typescript
  registerRelancesIpc(db)
```

- [ ] **Étape 3 : Commit**

```bash
git add apps/desktop/src/main/ipc/relances.ipc.ts apps/desktop/src/main/ipc/index.ts
git commit -m "feat(ipc): add relances IPC handlers (list, send, history, printLetters)"
```

---

## Task 4: ipcBridge.ts — ajout des appels relances

**Files:**
- Modify: `apps/desktop/src/renderer/utils/ipcBridge.ts`

- [ ] **Étape 1 : Ajouter le namespace `relances` dans l'objet `ipc`**

À la fin de l'objet `ipc` (avant le `}` final), ajouter :

```typescript
  relances: {
    list: (thresholdDays = 30) =>
      invoke<any[]>('relances:list', thresholdDays),
    send: (parentIds: string[]) =>
      invoke<{ sent: number; failed: number; skipped: number }>('relances:send', parentIds),
    history: () =>
      invoke<any[]>('relances:history'),
    printLetters: (parentIds: string[]) =>
      invoke<string>('relances:printLetters', parentIds),
  },
```

- [ ] **Étape 2 : Commit**

```bash
git add apps/desktop/src/renderer/utils/ipcBridge.ts
git commit -m "feat(bridge): expose relances IPC to renderer"
```

---

## Task 5: Page RelancesPage.tsx

**Files:**
- Create: `apps/desktop/src/renderer/pages/relances/RelancesPage.tsx`

- [ ] **Étape 1 : Créer la page avec l'onglet Impayés**

```typescript
import { useEffect, useState } from 'react'
import { Table, Button, Checkbox, Tag, Tabs, Alert, Space, Select, message, Modal } from 'antd'
import { MailOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons'
import { ipc } from '../../utils/ipcBridge'
import { PageHeader } from '../../components/shared/PageHeader'

interface OverdueRow {
  studentId:       string
  studentName:     string
  className:       string
  balance:         number
  daysOverdue:     number
  parentId:        string
  parentName:      string
  phone:           string | null
  email:           string | null
  channel:         'SMS' | 'EMAIL' | 'BOTH' | 'NONE'
  alreadyReminded: boolean
}

interface HistoryRow {
  id:        string
  sentAt:    string
  channel:   string
  status:    string
  amountDue: number
  parent:    { firstName: string; lastName: string }
  student:   { firstName: string; lastName: string }
}

export function RelancesPage() {
  const [rows, setRows]           = useState<OverdueRow[]>([])
  const [history, setHistory]     = useState<HistoryRow[]>([])
  const [selected, setSelected]   = useState<string[]>([])
  const [threshold, setThreshold] = useState(30)
  const [loading, setLoading]     = useState(false)
  const [sending, setSending]     = useState(false)
  const [printing, setPrinting]   = useState(false)
  const [tab, setTab]             = useState('overdue')

  const school = { currency: 'GNF' }

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await ipc.relances.list(threshold)
      setRows(data)
      setSelected([])
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const data = await ipc.relances.history()
      setHistory(data)
    } catch {}
  }

  useEffect(() => { loadData() }, [threshold])
  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])

  const handleSend = async () => {
    if (selected.length === 0) { message.warning('Sélectionnez au moins un parent'); return }
    setSending(true)
    try {
      const result = await ipc.relances.send(selected)
      message.success(`Envoyé : ${result.sent} | Échec : ${result.failed} | Ignoré : ${result.skipped}`)
      loadData()
      loadHistory()
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const handlePrint = async () => {
    if (selected.length === 0) { message.warning('Sélectionnez au moins un parent'); return }
    setPrinting(true)
    try {
      const html = await ipc.relances.printLetters(selected)
      const win  = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
        win.focus()
        setTimeout(() => { win.print(); win.close() }, 500)
      }
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setPrinting(false)
    }
  }

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0)

  const overdueColumns = [
    {
      title: '',
      key: 'select',
      width: 40,
      render: (_: any, r: OverdueRow) => (
        <Checkbox
          disabled={r.channel === 'NONE'}
          checked={selected.includes(r.parentId)}
          onChange={e => {
            setSelected(prev =>
              e.target.checked ? [...prev, r.parentId] : prev.filter(id => id !== r.parentId)
            )
          }}
        />
      ),
    },
    { title: 'Élève',          dataIndex: 'studentName',  key: 'studentName' },
    { title: 'Classe',         dataIndex: 'className',    key: 'className' },
    { title: 'Parent',         dataIndex: 'parentName',   key: 'parentName' },
    { title: 'Téléphone',      dataIndex: 'phone',        key: 'phone', render: (v: any) => v ?? '—' },
    {
      title: 'Solde dû',
      dataIndex: 'balance',
      key: 'balance',
      render: (v: number) => (
        <span style={{ color: '#dc2626', fontWeight: 700 }}>
          {v.toLocaleString('fr-FR')} GNF
        </span>
      ),
    },
    {
      title: 'Retard',
      dataIndex: 'daysOverdue',
      key: 'daysOverdue',
      render: (v: number) => (
        <Tag color={v > 60 ? 'red' : v > 30 ? 'orange' : 'gold'}>{v} jours</Tag>
      ),
    },
    {
      title: 'Canal',
      dataIndex: 'channel',
      key: 'channel',
      render: (v: string) => {
        const colors: Record<string, string> = { SMS: 'blue', EMAIL: 'purple', BOTH: 'green', NONE: 'default' }
        return <Tag color={colors[v]}>{v}</Tag>
      },
    },
    {
      title: 'Déjà relancé',
      dataIndex: 'alreadyReminded',
      key: 'alreadyReminded',
      render: (v: boolean) => v ? <Tag color="orange">Oui (&lt;7j)</Tag> : <Tag color="green">Non</Tag>,
    },
  ]

  const historyColumns = [
    { title: 'Date',    dataIndex: 'sentAt',    key: 'sentAt',    render: (v: string) => new Date(v).toLocaleDateString('fr-FR') },
    { title: 'Parent',  key: 'parent',  render: (_: any, r: HistoryRow) => `${r.parent.firstName} ${r.parent.lastName}` },
    { title: 'Élève',   key: 'student', render: (_: any, r: HistoryRow) => `${r.student.firstName} ${r.student.lastName}` },
    { title: 'Montant', dataIndex: 'amountDue', key: 'amountDue', render: (v: number) => `${v.toLocaleString('fr-FR')} GNF` },
    { title: 'Canal',   dataIndex: 'channel',   key: 'channel',   render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Statut',
      dataIndex: 'status',
      key: 'status',
      render: (v: string) => <Tag color={v === 'SENT' ? 'green' : 'red'}>{v === 'SENT' ? 'Envoyé' : 'Échec'}</Tag>,
    },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader title="Relances Impayés" subtitle="Gérez les rappels de paiement aux parents" />

      <Tabs activeKey={tab} onChange={setTab} items={[
        {
          key: 'overdue',
          label: `Impayés (${rows.length})`,
          children: (
            <>
              {rows.length > 0 && (
                <Alert
                  type="warning"
                  icon={<WarningOutlined />}
                  showIcon
                  message={`${rows.length} parent(s) en retard — Total : ${totalBalance.toLocaleString('fr-FR')} GNF`}
                  style={{ marginBottom: 16 }}
                />
              )}

              {rows.length === 0 && !loading && (
                <Alert type="success" message="Aucun impayé en retard. Bonne gestion !" showIcon style={{ marginBottom: 16 }} />
              )}

              <Space style={{ marginBottom: 16 }} wrap>
                <span>Filtre retard :</span>
                <Select
                  value={threshold}
                  onChange={setThreshold}
                  options={[
                    { value: 15,  label: '> 15 jours' },
                    { value: 30,  label: '> 30 jours' },
                    { value: 60,  label: '> 60 jours' },
                  ]}
                />
                <Checkbox
                  checked={selected.length === rows.filter(r => r.channel !== 'NONE').length && rows.length > 0}
                  onChange={e =>
                    setSelected(e.target.checked ? rows.filter(r => r.channel !== 'NONE').map(r => r.parentId) : [])
                  }
                >
                  Tout sélectionner
                </Checkbox>
                <Button
                  type="primary"
                  icon={<MailOutlined />}
                  loading={sending}
                  disabled={selected.length === 0}
                  onClick={handleSend}
                >
                  Envoyer SMS/Email ({selected.length})
                </Button>
                <Button
                  icon={<PrinterOutlined />}
                  loading={printing}
                  disabled={selected.length === 0}
                  onClick={handlePrint}
                >
                  Imprimer les lettres ({selected.length})
                </Button>
              </Space>

              <Table
                rowKey="studentId"
                columns={overdueColumns}
                dataSource={rows}
                loading={loading}
                pagination={{ pageSize: 20 }}
                size="small"
              />
            </>
          ),
        },
        {
          key: 'history',
          label: 'Historique',
          children: (
            <Table
              rowKey="id"
              columns={historyColumns}
              dataSource={history}
              pagination={{ pageSize: 20 }}
              size="small"
            />
          ),
        },
      ]} />
    </div>
  )
}
```

- [ ] **Étape 2 : Commit**

```bash
git add apps/desktop/src/renderer/pages/relances/
git commit -m "feat(ui): add RelancesPage with overdue table, send and print"
```

---

## Task 6: Route + Sidebar + Alerte démarrage

**Files:**
- Modify: `apps/desktop/src/renderer/App.tsx`
- Modify: `apps/desktop/src/renderer/components/layout/Sidebar.tsx`
- Modify: `apps/desktop/src/main/index.ts`

- [ ] **Étape 1 : Ajouter la route dans App.tsx**

Importer la page :
```typescript
import { RelancesPage } from './pages/relances/RelancesPage'
```

Dans la liste des routes (pattern existant), ajouter :
```typescript
<Route path="/relances" element={<RelancesPage />} />
```

- [ ] **Étape 2 : Ajouter l'entrée dans Sidebar.tsx**

Dans le tableau `NAV`, après l'entrée `/expenses` :
```typescript
  { key: '/relances', icon: <AlertOutlined />, label: 'Relances', dividerBefore: false },
```

En haut du fichier, ajouter `AlertOutlined` dans les imports Ant Design :
```typescript
import { ..., AlertOutlined } from '@ant-design/icons'
```

- [ ] **Étape 3 : Alerte démarrage dans l'App renderer**

Dans `App.tsx`, écouter l'événement IPC au montage. Ajouter ce `useEffect` dans le composant principal :

```typescript
useEffect(() => {
  const electron = (window as any).electron
  if (!electron?.ipc) return

  const handleAlert = (_: any, data: { count: number; total: number; currency: string }) => {
    const dismissed = localStorage.getItem('relances-dismissed-until')
    if (dismissed && new Date(dismissed) > new Date()) return

    Modal.warning({
      title: `${data.count} parent(s) ont des impayés en retard`,
      content: `Total dû : ${data.total.toLocaleString('fr-FR')} ${data.currency}`,
      okText: 'Voir les relances',
      cancelText: 'Plus tard',
      onOk: () => navigate('/relances'),
      onCancel: () => {
        const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        localStorage.setItem('relances-dismissed-until', until)
      },
    })
  }

  electron.ipc.on('relances:startup-alert', handleAlert)
  return () => electron.ipc.removeListener?.('relances:startup-alert', handleAlert)
}, [])
```

Importer `Modal` depuis `antd` et `useNavigate` depuis `react-router-dom` si pas déjà fait.

- [ ] **Étape 4 : Appeler `checkOverdueAtStartup` dans main/index.ts**

Dans `apps/desktop/src/main/index.ts`, après que la fenêtre est créée et le renderer chargé, ajouter :

```typescript
import { checkOverdueAtStartup } from './ipc/relances.ipc'

// Dans la callback app.whenReady() après win.loadURL/loadFile :
win.webContents.once('did-finish-load', () => {
  checkOverdueAtStartup(db, win)
})
```

- [ ] **Étape 5 : Commit final**

```bash
git add apps/desktop/src/renderer/App.tsx \
        apps/desktop/src/renderer/components/layout/Sidebar.tsx \
        apps/desktop/src/main/index.ts
git commit -m "feat: wire up RelancesPage route, sidebar entry, and startup alert"
```

---

## Task 7: Build et test

- [ ] **Étape 1 : Compiler et lancer en dev**

```bash
cd apps/desktop
npm run dev
```

Expected: app démarre sans erreur TypeScript.

- [ ] **Étape 2 : Vérifier la page Relances**

- Menu latéral → "Relances" visible
- Page s'ouvre avec le tableau des impayés
- Filtre 15j / 30j / 60j fonctionne
- Case "Tout sélectionner" fonctionne
- Bouton "Imprimer les lettres" ouvre une fenêtre avec le courrier formaté

- [ ] **Étape 3 : Vérifier l'historique**

- Onglet "Historique" affiche les envois précédents

- [ ] **Étape 4 : Build .exe final**

```bash
npm run dist
```

Expected: `dist/SGSI-GestionScolaire-Setup-1.0.0.exe` généré sans erreur.

- [ ] **Étape 5 : Commit final**

```bash
git add -A
git commit -m "feat: relances impayes - SMS/email/lettre imprimee + alerte demarrage"
git push origin master
```
