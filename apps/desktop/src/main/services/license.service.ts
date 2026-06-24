/**
 * LicenseService — Validation hybride (serveur + cache local)
 *
 * Flux :
 * 1. Activation → appel serveur obligatoire
 * 2. Revalidation → appel serveur (si connecté), sinon grace period 30j
 * 3. isValid()   → vérifie le cache local d'abord
 */

import type { PrismaClient } from '@prisma/client'
import { app }   from 'electron'
import https     from 'https'
import http      from 'http'
import fs        from 'fs'
import path      from 'path'
import os        from 'os'
import crypto    from 'crypto'

/* ── Config ─────────────────────────────────────────────────────── */
const LICENSE_SERVER  = process.env.LICENSE_SERVER || 'https://sgsi-license-server.onrender.com'
const GRACE_DAYS      = 30          // jours sans re-validation autorisés
const CACHE_FILE      = path.join(app.getPath('userData'), 'license-cache.json')

/* ── Machine ID ─────────────────────────────────────────────────── */
function getMachineId(): string {
  try {
    // Generate a unique but stable machine identifier
    const cpus  = os.cpus()[0]?.model ?? 'unknown'
    const user  = os.userInfo().username
    const home  = os.homedir()
    return crypto.createHash('sha256').update(`${cpus}:${user}:${home}`).digest('hex').slice(0, 16)
  } catch { return 'unknown' }
}

/* ── HTTP helper ────────────────────────────────────────────────── */
function httpPost(url: string, body: Record<string, unknown>, timeoutMs = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isTls   = parsed.protocol === 'https:'
    const mod     = isTls ? https : http
    const data    = JSON.stringify(body)

    const req = mod.request({
      hostname: parsed.hostname,
      port:     parsed.port ? Number(parsed.port) : (isTls ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent':     'SGSI-Desktop/1.0',
      },
      timeout: timeoutMs,
    }, (res) => {
      let raw = ''
      res.on('data', c => raw += c)
      res.on('end', () => {
        try   { resolve({ status: res.statusCode, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode, body: raw }) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.on('error',   reject)
    req.write(data)
    req.end()
  })
}

/* ── Local cache ────────────────────────────────────────────────── */
interface LicenseCache {
  key:           string
  plan:          string
  planName:      string
  maxStudents:   number
  schoolName:    string
  expiresAt:     string | null
  issuedAt:      string
  validatedAt:   string   // dernière validation serveur réussie
}

function readCache(): LicenseCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  } catch { return null }
}

function writeCache(data: LicenseCache): void {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8')
}

function clearCache(): void {
  try { if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE) } catch {}
}

function cacheIsWithinGrace(cache: LicenseCache): boolean {
  const lastValid = new Date(cache.validatedAt).getTime()
  const now       = Date.now()
  const graceMsec = GRACE_DAYS * 24 * 60 * 60 * 1000
  return (now - lastValid) < graceMsec
}

function cacheIsExpired(cache: LicenseCache): boolean {
  if (!cache.expiresAt) return false
  return new Date() > new Date(cache.expiresAt)
}

/* ══════════════════════════════════════════════════════════════════
   LicenseService
   ══════════════════════════════════════════════════════════════════ */
export class LicenseService {
  constructor(private db: PrismaClient) {}

  /** Récupère la licence stockée en base */
  async getLicense() {
    return this.db.license.findFirst({ orderBy: { issuedAt: 'desc' } })
  }

  /**
   * Activer une licence — appel serveur OBLIGATOIRE.
   * Si le serveur répond, on sauvegarde en DB + cache.
   */
  async activate(key: string): Promise<any> {
    if (!key?.trim()) throw new Error('Clé de licence manquante')

    const school     = await (this.db as any).schoolSettings?.findFirst() ?? await (this.db as any).school?.findFirst()
    const schoolName = (school as any)?.name ?? ''
    const machineId  = getMachineId()

    let serverData: any = null
    let serverError: string | null = null

    // ── Appel serveur ────────────────────────────────────────────
    try {
      const resp = await httpPost(`${LICENSE_SERVER}/api/license/validate`, {
        key:        key.trim().toUpperCase(),
        schoolName,
        machineId,
      })

      if (resp.status === 200 && resp.body?.valid) {
        serverData = resp.body
      } else {
        serverError = resp.body?.error ?? `Erreur serveur (${resp.status})`
      }
    } catch (e: any) {
      serverError = e.code === 'TIMEOUT' || e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED'
        ? 'Serveur de licences inaccessible. Vérifiez votre connexion Internet.'
        : e.message
    }

    if (serverError && !serverData) {
      throw new Error(serverError)
    }

    // ── Sauvegarder en base de données ───────────────────────────
    const cleanKey   = key.trim().toUpperCase()
    const existing   = await this.db.license.findUnique({ where: { key: cleanKey } })
    let license

    if (existing) {
      license = await this.db.license.update({
        where: { key: cleanKey },
        data: {
          isActive:    true,
          plan:        serverData.plan        ?? existing.plan,
          maxStudents: serverData.maxStudents ?? existing.maxStudents,
          schoolName:  schoolName || existing.schoolName,
          expiresAt:   serverData.expiresAt ? new Date(serverData.expiresAt) : existing.expiresAt,
        },
      })
    } else {
      license = await this.db.license.create({
        data: {
          key:         cleanKey,
          schoolName,
          plan:        serverData?.plan        ?? 'STANDARD',
          maxStudents: serverData?.maxStudents ?? 500,
          isActive:    true,
          expiresAt:   serverData?.expiresAt ? new Date(serverData.expiresAt) : null,
        },
      })
    }

    // ── Mettre à jour le cache local ─────────────────────────────
    writeCache({
      key:         cleanKey,
      plan:        serverData?.plan     ?? 'STANDARD',
      planName:    serverData?.planName ?? 'Standard',
      maxStudents: serverData?.maxStudents ?? 500,
      schoolName,
      expiresAt:   serverData?.expiresAt ?? null,
      issuedAt:    serverData?.issuedAt ?? new Date().toISOString(),
      validatedAt: new Date().toISOString(),
    })

    return { ...license, serverValidated: !!serverData }
  }

  /** Désactiver la licence localement */
  async deactivate(): Promise<void> {
    const lic = await this.getLicense()
    if (!lic) throw new Error('Aucune licence trouvée')
    await this.db.license.update({ where: { id: lic.id }, data: { isActive: false } })
    clearCache()
  }

  /**
   * Vérifier si la licence est valide.
   * Ordre de priorité :
   * 1. Cache local récent (< grace period) → OK sans réseau
   * 2. Appel serveur → revalider + mettre à jour cache
   * 3. Cache local dans grace period → OK hors ligne
   */
  async isValid(): Promise<{ valid: boolean; source: string; daysLeft?: number; reason?: string }> {
    // ── 1. Vérifier le cache local ───────────────────────────────
    const cache = readCache()

    if (!cache) {
      // Pas de cache → vérifier la base locale
      const dbLic = await this.getLicense()
      if (!dbLic || !dbLic.isActive) return { valid: false, source: 'db', reason: 'Aucune licence active' }
      if (dbLic.expiresAt && new Date() > dbLic.expiresAt) return { valid: false, source: 'db', reason: 'Licence expirée' }
      return { valid: true, source: 'db' }
    }

    if (cacheIsExpired(cache)) {
      return { valid: false, source: 'cache', reason: 'Licence expirée' }
    }

    // ── 2. Tenter revalidation serveur (optionnelle, silencieuse) ─
    try {
      const machineId = getMachineId()
      const resp      = await httpPost(`${LICENSE_SERVER}/api/license/validate`, {
        key:        cache.key,
        machineId,
      }, 4000)

      if (resp.status === 200 && resp.body?.valid) {
        // Mettre à jour le cache
        writeCache({ ...cache, validatedAt: new Date().toISOString(), ...resp.body })
        return { valid: true, source: 'server' }
      } else {
        // Serveur dit invalide → révoquer
        clearCache()
        return { valid: false, source: 'server', reason: resp.body?.error ?? 'Licence invalide selon le serveur' }
      }
    } catch {
      // Serveur inaccessible → grace period
    }

    // ── 3. Grace period ──────────────────────────────────────────
    if (cacheIsWithinGrace(cache)) {
      const lastValid     = new Date(cache.validatedAt)
      const graceExpiry   = new Date(lastValid.getTime() + GRACE_DAYS * 86400 * 1000)
      const daysRemaining = Math.max(0, Math.ceil((graceExpiry.getTime() - Date.now()) / 86400000))
      return { valid: true, source: 'grace', daysLeft: daysRemaining }
    }

    // Grace period dépassé
    return {
      valid: false,
      source: 'grace',
      reason: `La licence n'a pas pu être validée depuis ${GRACE_DAYS} jours. Connectez-vous à Internet.`,
    }
  }

  /** Infos complètes pour l'UI */
  async getLicenseInfo() {
    const [db, cache, validity] = await Promise.all([
      this.getLicense(),
      Promise.resolve(readCache()),
      this.isValid(),
    ])
    return { db, cache, validity }
  }
}
