/**
 * SGSI License Server
 * ===================
 * Serveur de validation de licences SchoolManager Pro
 *
 * Endpoints:
 *   POST /api/license/validate   — valider une clé (client Electron)
 *   POST /api/license/generate   — générer une clé  (admin)
 *   POST /api/license/revoke     — révoquer une clé  (admin)
 *   GET  /api/license/list       — lister toutes les clés (admin)
 *   GET  /api/health             — health check
 */

const express  = require('express')
const cors     = require('cors')
const crypto   = require('crypto')
const fs       = require('fs')
const path     = require('path')

const app  = express()
const PORT = process.env.PORT || 3500

// ── Config ─────────────────────────────────────────────────────────
const ADMIN_SECRET  = process.env.ADMIN_SECRET  || 'sgsi-admin-secret-change-me'
const DB_FILE       = path.join(__dirname, '..', 'data', 'licenses.json')

// ── Middlewares ─────────────────────────────────────────────────────
app.use(cors({
  origin: '*',       // Accept requests from Electron (file:// or localhost)
  methods: ['GET', 'POST'],
}))
app.use(express.json())

// ── Database (JSON file) ────────────────────────────────────────────
function loadDb() {
  try {
    if (!fs.existsSync(DB_FILE)) return { licenses: [] }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
  } catch { return { licenses: [] } }
}

function saveDb(db) {
  const dir = path.dirname(DB_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8')
}

// ── License helpers ─────────────────────────────────────────────────
const PLANS = {
  STD: { name: 'Standard',     maxStudents: 500,  price: 'Basique'       },
  PRO: { name: 'Professional', maxStudents: 2000, price: 'Professionnel' },
  ULT: { name: 'Ultimate',     maxStudents: 9999, price: 'Illimité'      },
}

function generateKey(plan = 'STD', expiryYear = new Date().getFullYear() + 1) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return `SGSI-${plan.toUpperCase()}-${code}-${expiryYear}`
}

function parseKey(key) {
  const parts = key.toUpperCase().trim().split('-')
  if (parts.length < 4 || parts[0] !== 'SGSI') return null

  const planCode = parts[1]
  const plan     = PLANS[planCode]
  if (!plan) return null

  // Find year segment
  let expiryYear = null
  for (const p of parts.slice(2)) {
    const yr = parseInt(p, 10)
    if (yr >= 2024 && yr <= 2099) { expiryYear = yr; break }
  }

  return { planCode, plan, expiryYear }
}

function isExpired(license) {
  if (!license.expiresAt) return false
  return new Date() > new Date(license.expiresAt)
}

// ── Admin middleware ────────────────────────────────────────────────
function adminOnly(req, res, next) {
  const secret = req.headers['x-admin-secret'] || req.body?.adminSecret
  if (secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Non autorisé' })
  }
  next()
}

// ══════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    service:   'SGSI License Server',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
  })
})

// ─────────────────────────────────────────────────────────────────────
// POST /api/license/validate
// Body: { key, schoolName, machineId }
// ─────────────────────────────────────────────────────────────────────
app.post('/api/license/validate', (req, res) => {
  const { key, schoolName, machineId } = req.body

  if (!key) return res.status(400).json({ valid: false, error: 'Clé manquante' })

  const db      = loadDb()
  const license = db.licenses.find(l => l.key === key.toUpperCase().trim())

  if (!license) {
    return res.status(404).json({ valid: false, error: 'Clé de licence invalide ou non trouvée' })
  }

  if (!license.isActive) {
    return res.status(403).json({ valid: false, error: 'Cette licence a été désactivée' })
  }

  if (isExpired(license)) {
    return res.status(403).json({ valid: false, error: `Licence expirée le ${new Date(license.expiresAt).toLocaleDateString('fr-FR')}` })
  }

  // Update last seen + machine info
  license.lastValidatedAt = new Date().toISOString()
  if (schoolName) license.schoolName = schoolName
  if (machineId && !license.machineIds.includes(machineId)) {
    license.machineIds.push(machineId)
  }
  saveDb(db)

  return res.json({
    valid:       true,
    key:         license.key,
    plan:        license.plan,
    planName:    PLANS[license.plan]?.name ?? license.plan,
    maxStudents: license.maxStudents,
    schoolName:  license.schoolName,
    expiresAt:   license.expiresAt,
    issuedAt:    license.issuedAt,
  })
})

// ─────────────────────────────────────────────────────────────────────
// POST /api/license/generate   [ADMIN]
// Body: { adminSecret, plan, expiryYear, schoolName, customerEmail }
// ─────────────────────────────────────────────────────────────────────
app.post('/api/license/generate', adminOnly, (req, res) => {
  const {
    plan        = 'STD',
    expiryYear  = new Date().getFullYear() + 1,
    schoolName  = '',
    customerEmail = '',
    notes       = '',
  } = req.body

  const planInfo = PLANS[plan.toUpperCase()]
  if (!planInfo) return res.status(400).json({ error: 'Plan invalide (STD, PRO, ULT)' })

  const key        = generateKey(plan, expiryYear)
  const expiresAt  = new Date(expiryYear, 11, 31, 23, 59, 59).toISOString()

  const db = loadDb()
  const license = {
    key,
    plan:           plan.toUpperCase(),
    planName:       planInfo.name,
    maxStudents:    planInfo.maxStudents,
    schoolName,
    customerEmail,
    notes,
    isActive:       true,
    issuedAt:       new Date().toISOString(),
    expiresAt,
    lastValidatedAt: null,
    machineIds:      [],
  }

  db.licenses.push(license)
  saveDb(db)

  return res.status(201).json({
    message:    'Licence générée avec succès',
    key,
    plan:       planInfo.name,
    maxStudents: planInfo.maxStudents,
    expiresAt,
    schoolName,
  })
})

// ─────────────────────────────────────────────────────────────────────
// POST /api/license/revoke   [ADMIN]
// Body: { adminSecret, key }
// ─────────────────────────────────────────────────────────────────────
app.post('/api/license/revoke', adminOnly, (req, res) => {
  const { key } = req.body
  if (!key) return res.status(400).json({ error: 'Clé manquante' })

  const db      = loadDb()
  const license = db.licenses.find(l => l.key === key.toUpperCase().trim())

  if (!license) return res.status(404).json({ error: 'Licence introuvable' })

  license.isActive   = false
  license.revokedAt  = new Date().toISOString()
  saveDb(db)

  return res.json({ message: `Licence ${key} révoquée`, key })
})

// ─────────────────────────────────────────────────────────────────────
// GET /api/license/list   [ADMIN]
// ─────────────────────────────────────────────────────────────────────
app.get('/api/license/list', adminOnly, (req, res) => {
  const db = loadDb()
  const summary = db.licenses.map(l => ({
    key:         l.key,
    plan:        l.plan,
    planName:    PLANS[l.plan]?.name ?? l.plan,
    schoolName:  l.schoolName,
    isActive:    l.isActive,
    expired:     isExpired(l),
    expiresAt:   l.expiresAt,
    issuedAt:    l.issuedAt,
    lastValidatedAt: l.lastValidatedAt,
    machineCount: l.machineIds?.length ?? 0,
  }))
  return res.json({
    total:   db.licenses.length,
    active:  summary.filter(l => l.isActive && !l.expired).length,
    expired: summary.filter(l => l.expired).length,
    revoked: summary.filter(l => !l.isActive).length,
    licenses: summary,
  })
})

// ─────────────────────────────────────────────────────────────────────
// POST /api/license/reactivate   [ADMIN]
// ─────────────────────────────────────────────────────────────────────
app.post('/api/license/reactivate', adminOnly, (req, res) => {
  const { key, newExpiryYear } = req.body
  const db      = loadDb()
  const license = db.licenses.find(l => l.key === key.toUpperCase().trim())
  if (!license) return res.status(404).json({ error: 'Licence introuvable' })

  license.isActive  = true
  license.revokedAt = null
  if (newExpiryYear) {
    license.expiresAt = new Date(newExpiryYear, 11, 31, 23, 59, 59).toISOString()
  }
  saveDb(db)
  return res.json({ message: 'Licence réactivée', key })
})

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🔑 SGSI License Server démarré sur le port ${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health`)
  console.log(`   Admin Secret: ${ADMIN_SECRET}\n`)
})
