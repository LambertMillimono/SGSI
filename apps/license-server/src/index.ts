/**
 * SGSI License Server v2 — TypeScript
 * Endpoints:
 *   POST /api/license/activate    — activate + bind hardware ID
 *   POST /api/license/validate    — validate (check status + machine binding)
 *   POST /api/license/generate    — [ADMIN] generate new key
 *   POST /api/license/revoke      — [ADMIN] revoke / suspend
 *   POST /api/license/reactivate  — [ADMIN] reactivate + optionally extend
 *   GET  /api/license/list        — [ADMIN] list all licenses
 *   GET  /api/health              — health check
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import rateLimit from 'express-rate-limit'
import https_lib from 'https'

const app  = express()
const PORT = Number(process.env.PORT ?? 3500)

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? 'sgsi-admin-2024-change-me'
const DB_FILE      = path.join(__dirname, '..', 'data', 'licenses.json')

/* ── Middlewares ─────────────────────────────────────────────── */
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }))
app.use(express.json({ limit: '1mb' }))

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans 15 minutes.' },
}))

// Stricter limit for activation
const activateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Trop de tentatives d\'activation. Réessayez dans 1 heure.' },
})

/* ── DB helpers ───────────────────────────────────────────────── */
interface LicenseRecord {
  key:           string
  plan:          'STD' | 'PRO' | 'ULT'
  planName:      string
  maxStudents:   number
  schoolName:    string
  customerEmail: string
  notes:         string
  isActive:      boolean
  issuedAt:      string
  expiresAt:     string | null
  hardwareIds:   string[]         // machine binding — multiple machines allowed
  maxMachines:   number           // default 1
  lastActivatedAt: string | null
  lastValidatedAt: string | null
  revokedAt:     string | null
  revokedReason: string | null
}

interface DB { licenses: LicenseRecord[] }

function loadDb(): DB {
  try {
    if (!fs.existsSync(DB_FILE)) return { licenses: [] }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as DB
  } catch { return { licenses: [] } }
}

function saveDb(db: DB): void {
  const dir = path.dirname(DB_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

function findLicense(db: DB, key: string): LicenseRecord | undefined {
  return db.licenses.find(l => l.key === key.toUpperCase().trim())
}

/* ── Plan config ─────────────────────────────────────────────── */
const PLANS: Record<string, { name: string; maxStudents: number }> = {
  STD: { name: 'Standard',     maxStudents: 500  },
  PRO: { name: 'Professional', maxStudents: 2000 },
  ULT: { name: 'Ultimate',     maxStudents: 9999 },
}

function generateKey(plan: string, year: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `SGSI-${plan.toUpperCase()}-${code}-${year}`
}

function isExpired(lic: LicenseRecord): boolean {
  if (!lic.expiresAt) return false
  return new Date() > new Date(lic.expiresAt)
}

/* ── Admin middleware ─────────────────────────────────────────── */
function adminOnly(req: Request, res: Response, next: NextFunction): void {
  const secret = (req.headers['x-admin-secret'] as string) ?? req.body?.adminSecret
  if (secret !== ADMIN_SECRET) {
    res.status(401).json({ error: 'Non autorisé' }); return
  }
  next()
}

/* ══════════════════════════════════════════════════════════════
   ROUTES
   ══════════════════════════════════════════════════════════════ */

app.get('/api/health', (_req, res) => {
  const db = loadDb()
  res.json({
    status:    'ok',
    service:   'SGSI License Server v2',
    version:   '2.0.0',
    timestamp: new Date().toISOString(),
    licenses:  db.licenses.length,
    active:    db.licenses.filter(l => l.isActive && !isExpired(l)).length,
  })
})

/* ── POST /api/license/activate ─────────────────────────────── */
app.post('/api/license/activate', activateLimiter, (req, res) => {
  const { licenseKey, hardwareId, schoolName } = req.body as {
    licenseKey?: string; hardwareId?: string; schoolName?: string
  }

  if (!licenseKey?.trim())   { res.status(400).json({ error: 'licenseKey manquant' }); return }
  if (!hardwareId?.trim())   { res.status(400).json({ error: 'hardwareId manquant' }); return }

  const db  = loadDb()
  const lic = findLicense(db, licenseKey)

  if (!lic) {
    res.status(404).json({ error: 'Clé de licence invalide ou inexistante.' }); return
  }
  if (!lic.isActive) {
    res.status(403).json({ error: 'Cette licence a été révoquée ou suspendue.' }); return
  }
  if (isExpired(lic)) {
    res.status(403).json({ error: `Licence expirée le ${new Date(lic.expiresAt!).toLocaleDateString('fr-FR')}.` }); return
  }

  const hwId = hardwareId.trim()

  // Machine binding check
  if (!lic.hardwareIds.includes(hwId)) {
    if (lic.hardwareIds.length >= lic.maxMachines) {
      res.status(403).json({
        error: `Cette licence est déjà activée sur ${lic.maxMachines} appareil(s). Contactez votre distributeur pour ajouter des machines.`,
      }); return
    }
    lic.hardwareIds.push(hwId)
  }

  // Update record
  lic.lastActivatedAt = new Date().toISOString()
  lic.lastValidatedAt = new Date().toISOString()
  if (schoolName) lic.schoolName = schoolName

  saveDb(db)

  res.json({
    success:     true,
    plan:        lic.plan,
    planName:    lic.planName,
    maxStudents: lic.maxStudents,
    schoolName:  lic.schoolName,
    expiresAt:   lic.expiresAt,
    issuedAt:    lic.issuedAt,
  })
})

/* ── POST /api/license/validate ─────────────────────────────── */
app.post('/api/license/validate', (req, res) => {
  const { licenseKey, hardwareId } = req.body as { licenseKey?: string; hardwareId?: string }

  if (!licenseKey?.trim()) { res.status(400).json({ valid: false, error: 'licenseKey manquant' }); return }

  const db  = loadDb()
  const lic = findLicense(db, licenseKey)

  if (!lic)            { res.status(404).json({ valid: false, error: 'Licence introuvable' }); return }
  if (!lic.isActive)   { res.status(403).json({ valid: false, error: 'Licence révoquée' }); return }
  if (isExpired(lic))  { res.status(403).json({ valid: false, error: 'Licence expirée' }); return }

  // Machine binding validation
  if (hardwareId && lic.hardwareIds.length > 0 && !lic.hardwareIds.includes(hardwareId.trim())) {
    res.status(403).json({ valid: false, error: 'Licence non autorisée sur cet appareil.' }); return
  }

  // Update last validated
  lic.lastValidatedAt = new Date().toISOString()
  saveDb(db)

  const daysUntilExpiry = lic.expiresAt
    ? Math.max(0, Math.ceil((new Date(lic.expiresAt).getTime() - Date.now()) / 86400000))
    : undefined

  res.json({
    valid:           true,
    plan:            lic.plan,
    planName:        lic.planName,
    maxStudents:     lic.maxStudents,
    schoolName:      lic.schoolName,
    expiresAt:       lic.expiresAt,
    daysUntilExpiry,
  })
})

/* ── POST /api/license/generate [ADMIN] ──────────────────────── */
app.post('/api/license/generate', adminOnly, (req, res) => {
  const { plan = 'STD', expiryYear, schoolName = '', customerEmail = '', notes = '', maxMachines = 1 } = req.body
  const year     = Number(expiryYear ?? new Date().getFullYear() + 1)
  const planUp   = String(plan).toUpperCase() as 'STD' | 'PRO' | 'ULT'
  const planInfo = PLANS[planUp]

  if (!planInfo) { res.status(400).json({ error: 'Plan invalide (STD, PRO, ULT)' }); return }

  const key       = generateKey(planUp, year)
  const expiresAt = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const record: LicenseRecord = {
    key, plan: planUp, planName: planInfo.name, maxStudents: planInfo.maxStudents,
    schoolName, customerEmail, notes,
    isActive: true,
    issuedAt: new Date().toISOString(),
    expiresAt,
    hardwareIds: [],
    maxMachines: Number(maxMachines) || 1,
    lastActivatedAt: null, lastValidatedAt: null,
    revokedAt: null, revokedReason: null,
  }

  const db = loadDb()
  db.licenses.push(record)
  saveDb(db)

  res.status(201).json({ message: 'Licence générée', key, plan: planInfo.name, maxStudents: planInfo.maxStudents, expiresAt, schoolName })
})

/* ── POST /api/license/revoke [ADMIN] ────────────────────────── */
app.post('/api/license/revoke', adminOnly, (req, res) => {
  const { key, reason = '' } = req.body
  if (!key) { res.status(400).json({ error: 'key manquant' }); return }

  const db  = loadDb()
  const lic = findLicense(db, key)
  if (!lic) { res.status(404).json({ error: 'Licence introuvable' }); return }

  lic.isActive = false
  lic.revokedAt = new Date().toISOString()
  lic.revokedReason = reason || 'Révoquée par administrateur'
  saveDb(db)

  res.json({ message: `Licence ${key} révoquée`, key })
})

/* ── POST /api/license/reactivate [ADMIN] ───────────────────── */
app.post('/api/license/reactivate', adminOnly, (req, res) => {
  const { key, newExpiryYear, clearMachines = false } = req.body
  if (!key) { res.status(400).json({ error: 'key manquant' }); return }

  const db  = loadDb()
  const lic = findLicense(db, key)
  if (!lic) { res.status(404).json({ error: 'Licence introuvable' }); return }

  lic.isActive = true
  lic.revokedAt = null
  lic.revokedReason = null
  if (newExpiryYear) lic.expiresAt = new Date(Number(newExpiryYear), 11, 31, 23, 59, 59).toISOString()
  if (clearMachines) lic.hardwareIds = []
  saveDb(db)

  res.json({ message: 'Licence réactivée', key, expiresAt: lic.expiresAt })
})

/* ── GET /api/license/list [ADMIN] ──────────────────────────── */
app.get('/api/license/list', adminOnly, (_req, res) => {
  const db = loadDb()
  const summary = db.licenses.map(l => ({
    key:          l.key,
    plan:         l.plan,
    planName:     l.planName,
    schoolName:   l.schoolName,
    isActive:     l.isActive,
    expired:      isExpired(l),
    expiresAt:    l.expiresAt,
    issuedAt:     l.issuedAt,
    machineCount: l.hardwareIds.length,
    maxMachines:  l.maxMachines,
    lastValidatedAt: l.lastValidatedAt,
    revokedAt:    l.revokedAt,
  }))

  res.json({
    total:   db.licenses.length,
    active:  summary.filter(l => l.isActive && !l.expired).length,
    expired: summary.filter(l => l.expired).length,
    revoked: summary.filter(l => !l.isActive).length,
    licenses: summary,
  })
})

/* ── Brevo email helper ──────────────────────────────────────── */
import https_module from 'https'

const BREVO_API_KEY  = process.env.BREVO_API_KEY  ?? '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'
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL     ?? 'lambertmillimono8@gmail.com'

function sendBrevoEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      sender:      { name: 'SGSI License System', email: ADMIN_EMAIL },
      to:          [{ email: opts.to }],
      subject:     opts.subject,
      htmlContent: opts.html,
    })
    const req = https_module.request({
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => {
        if ((res.statusCode ?? 0) < 300) resolve()
        else reject(new Error(`Brevo error ${res.statusCode}: ${data}`))
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/* ── POST /api/license/request — School requests a key ────────── */
const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: { error: 'Trop de demandes. Réessayez dans 1 heure.' },
})

app.post('/api/license/request', requestLimiter, async (req: Request, res: Response) => {
  const {
    schoolName   = '',
    contactEmail = '',
    contactName  = '',
    hardwareId   = '',
    plan         = 'STD',
    message      = '',
  } = req.body as {
    schoolName?: string; contactEmail?: string; contactName?: string;
    hardwareId?: string; plan?: string; message?: string;
  }

  if (!schoolName?.trim())   { res.status(400).json({ error: 'Nom de l\'école manquant' }); return }
  if (!contactEmail?.trim()) { res.status(400).json({ error: 'Email de contact manquant' }); return }

  const requestId  = crypto.randomBytes(4).toString('hex').toUpperCase()
  const planUp     = (plan ?? 'STD').toUpperCase()
  const planInfo   = PLANS[planUp] ?? PLANS.STD
  const requestedAt = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Conakry' })

  // Build admin notification email
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #F0EFFF; padding: 24px; }
  .card { background: #FFFFFF; border-radius: 14px; max-width: 580px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 24px rgba(99,102,241,0.12); }
  .header { background: linear-gradient(135deg, #1E1B4B, #6366F1); padding: 28px 36px; }
  .h-title { color: #FFFFFF; font-size: 20px; font-weight: 800; margin: 0; }
  .h-sub   { color: rgba(255,255,255,0.65); font-size: 12px; margin-top: 4px; }
  .body    { padding: 28px 36px; }
  .alert-box { background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px 18px; margin-bottom: 22px; }
  .alert-title { color: #92400E; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .alert-text  { color: #92400E; font-size: 13px; }
  .grid { display: grid; grid-template-columns: 140px 1fr; gap: 10px 16px; font-size: 13px; margin-bottom: 24px; }
  .label { color: #6B7280; font-weight: 600; }
  .value { color: #1F2937; font-weight: 500; }
  .hw-box { background: #EEF2FF; border: 1px solid #C7D2FE; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; }
  .hw-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366F1; margin-bottom: 4px; }
  .hw-value { font-family: monospace; font-size: 13px; color: #312E81; font-weight: 600; word-break: break-all; }
  .plan-box { background: #F5F3FF; border: 1px solid #DDD6FE; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; text-align: center; }
  .plan-code { font-size: 20px; font-weight: 900; color: #6366F1; }
  .plan-name { font-size: 13px; color: #6B7280; }
  .plan-max  { font-size: 13px; font-weight: 600; color: #374151; margin-top: 2px; }
  .footer { background: #F9FAFB; padding: 16px 36px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; }
  .btn { display: inline-block; background: #6366F1; color: #FFF; font-weight: 700; font-size: 14px; padding: 12px 28px; border-radius: 8px; text-decoration: none; margin-top: 4px; }
</style></head>
<body>
<div class="card">
  <div class="header">
    <div class="h-title">🔑 Nouvelle demande de licence SGSI</div>
    <div class="h-sub">Référence : REQ-${requestId} · ${requestedAt}</div>
  </div>
  <div class="body">
    <div class="alert-box">
      <div class="alert-title">⚡ Action requise</div>
      <div class="alert-text">Une école demande une clé de licence. Générez et envoyez-la à l'adresse email indiquée ci-dessous.</div>
    </div>

    <div class="grid">
      <div class="label">École</div>       <div class="value"><strong>${schoolName}</strong></div>
      <div class="label">Contact</div>     <div class="value">${contactName || '—'}</div>
      <div class="label">Email contact</div><div class="value"><strong>${contactEmail}</strong></div>
      <div class="label">Plan demandé</div><div class="value">${planInfo.name} (${planUp}) — ${planInfo.maxStudents.toLocaleString()} élèves max</div>
      <div class="label">Message</div>     <div class="value">${message || '(aucun message)'}</div>
      <div class="label">Date demande</div><div class="value">${requestedAt}</div>
    </div>

    <div class="hw-box">
      <div class="hw-label">ID Machine (Hardware ID)</div>
      <div class="hw-value">${hardwareId || '(non fourni)'}</div>
    </div>

    <div class="plan-box">
      <div class="plan-code">${planUp}</div>
      <div class="plan-name">${planInfo.name}</div>
      <div class="plan-max">Jusqu'à ${planInfo.maxStudents.toLocaleString()} élèves</div>
    </div>

    <p style="font-size:13px;color:#374151;line-height:1.6;margin-bottom:20px;">
      Pour générer une clé pour cette école, utilisez votre outil d'administration SGSI :<br/>
      <code style="background:#F3F4F6;padding:2px 8px;border-radius:4px;font-size:12px;">
        node src/admin.js generate --plan ${planUp} --year ${new Date().getFullYear()+1} --school "${schoolName}" --email "${contactEmail}"
      </code>
    </p>
  </div>
  <div class="footer">SGSI License System · Ce mail a été généré automatiquement</div>
</div>
</body>
</html>`

  try {
    await sendBrevoEmail({
      to:      ADMIN_EMAIL,
      subject: `🔑 [SGSI] Demande de licence — ${schoolName} (${planUp})`,
      html,
    })

    // Log request in DB
    const db  = loadDb()
    const rec = db as any
    if (!rec.requests) rec.requests = []
    rec.requests.push({
      id: requestId, schoolName, contactEmail, contactName,
      plan: planUp, hardwareId, message,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    })
    saveDb(db)

    res.json({
      success:   true,
      requestId,
      message:   `Votre demande a été envoyée. L'administrateur SGSI vous contactera à ${contactEmail} avec votre clé d'activation.`,
    })
  } catch (e: any) {
    console.error('[License Request] Email error:', e.message)
    res.status(500).json({
      error: 'Impossible d\'envoyer la demande. Réessayez ou contactez directement lambertmillimono8@gmail.com',
    })
  }
})

/* ── GET /api/license/requests [ADMIN] ─────────────────────── */
app.get('/api/license/requests', adminOnly, (_req, res) => {
  const db = loadDb() as any
  res.json({ requests: db.requests ?? [] })
})

/* ── POST /api/license/send-key [ADMIN] ─────────────────────── */
app.post('/api/license/send-key', adminOnly, async (req: Request, res: Response) => {
  const { licenseKey, clientEmail, schoolName } = req.body
  if (!licenseKey || !clientEmail) { res.status(400).json({ error: 'licenseKey et clientEmail requis' }); return }

  const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F0EFFF;padding:24px}
  .card{background:#fff;border-radius:14px;max-width:520px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,.12)}
  .hdr{background:linear-gradient(135deg,#1E1B4B,#6366F1);padding:28px 36px}
  .logo{display:flex;align-items:center;gap:12px}
  .lm{width:44px;height:44px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff}
  .lt{color:#fff;font-size:18px;font-weight:800}.ls{color:rgba(255,255,255,.6);font-size:12px;margin-top:2px}
  .body{padding:28px 36px}
  .title{font-size:20px;font-weight:800;color:#1E1B4B;margin-bottom:10px}
  .sub{color:#52525B;font-size:13px;line-height:1.7;margin-bottom:24px}
  .key-box{background:#F5F3FF;border:2px solid #6366F1;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px}
  .key-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6366F1;margin-bottom:10px}
  .key-val{font-family:monospace;font-size:22px;font-weight:900;color:#312E81;letter-spacing:1px;word-break:break-all}
  .steps{margin-bottom:20px}
  .step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
  .snum{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#4F46E5);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .stxt{font-size:13px;color:#374151;line-height:1.6}
  .footer{background:#F9FAFB;padding:16px 36px;text-align:center;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="logo"><div class="lm">S</div><div><div class="lt">SGSI</div><div class="ls">SchoolManager Pro</div></div></div></div>
  <div class="body">
    <div class="title">Votre clé de licence est prête ! 🎉</div>
    <div class="sub">Bonjour,<br/>Votre clé de licence <strong>SGSI SchoolManager Pro</strong> pour <strong>${schoolName || 'votre école'}</strong> a été générée. Activez-la dès maintenant.</div>
    <div class="key-box">
      <div class="key-label">Clé de licence</div>
      <div class="key-val">${licenseKey}</div>
    </div>
    <div class="steps">
      <div class="step"><div class="snum">1</div><div class="stxt">Ouvrez l'application <strong>SGSI Desktop</strong></div></div>
      <div class="step"><div class="snum">2</div><div class="stxt">Sur l'écran d'activation, entrez la clé ci-dessus</div></div>
      <div class="step"><div class="snum">3</div><div class="stxt">Cliquez <strong>"Activer la licence"</strong> — votre accès est immédiat</div></div>
    </div>
    <p style="font-size:12px;color:#6B7280">En cas de problème : lambertmillimono8@gmail.com</p>
  </div>
  <div class="footer">SGSI SchoolManager Pro · Ne partagez pas cette clé</div>
</div></body></html>`

  try {
    await sendBrevoEmail({ to: clientEmail, subject: `🔑 Votre clé de licence SGSI — ${schoolName || 'SchoolManager Pro'}`, html })

    // Mark request as processed
    const db = loadDb() as any
    if (db.requests) {
      const req2 = db.requests.find((r: any) => r.contactEmail === clientEmail)
      if (req2) req2.status = 'processed'
      saveDb(db)
    }

    res.json({ success: true, message: `Clé envoyée à ${clientEmail}` })
  } catch (e: any) {
    res.status(500).json({ error: `Erreur email: ${e.message}` })
  }
})

/* ── Admin Panel (web UI) ────────────────────────────────────── */
app.use(express.static(path.join(__dirname, '..')))
app.get('/admin', adminOnly, (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'))
})

/* ── Start ───────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n✅ SGSI License Server v2 — port ${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health`)
  console.log(`   Admin:  set X-Admin-Secret header = "${ADMIN_SECRET}"\n`)
})

export default app
