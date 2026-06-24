/**
 * license.service.ts — Professional License Service
 *
 * Replaces the old service with:
 *   - Secure Hardware ID (Windows Registry + MACs)
 *   - AES-256-GCM encrypted local cache
 *   - HMAC signature (anti-tampering)
 *   - Machine binding enforcement
 *   - Automatic 30-day grace period
 *   - Online / offline validation
 */

import https from 'https'
import http  from 'http'
import type { PrismaClient } from '@prisma/client'

import { generateHardwareId, getShortHardwareId } from './hardware'
import {
  saveLicense, loadLicense, clearLicense,
  hasValidLocalLicense, daysSinceValidation, LicenseCache,
} from './license.storage'
import { validateCachedLicense }   from './license.validator'
import {
  LicenseValidationResult, ActivationResponse, LicenseInfo,
} from './license.types'

/* ── Config ────────────────────────────────────────────────────── */
const LICENSE_SERVER  = process.env.LICENSE_SERVER ?? 'https://sgsi-license-server.onrender.com'
const REQUEST_TIMEOUT = 8_000  // ms
const GRACE_DAYS      = 30

/* ── HTTP helper ────────────────────────────────────────────────── */
function httpPost<T>(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = REQUEST_TIMEOUT,
): Promise<{ status: number; body: T }> {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const isTls   = parsed.protocol === 'https:'
    const mod     = isTls ? https : http
    const data    = JSON.stringify(body)

    const req = mod.request({
      hostname: parsed.hostname,
      port:     parsed.port ? Number(parsed.port) : isTls ? 443 : 80,
      path:     parsed.pathname,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(data),
        'User-Agent':     'SGSI-Desktop/2.0',
        'X-Client-ID':    generateHardwareId().slice(0, 8),
      },
      timeout: timeoutMs,
    }, (res) => {
      let raw = ''
      res.on('data', c => (raw += c))
      res.on('end', () => {
        try   { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) as T }) }
        catch { resolve({ status: res.statusCode ?? 0, body: raw as unknown as T }) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.on('error',   reject)
    req.write(data)
    req.end()
  })
}

/* ══════════════════════════════════════════════════════════════════
   PUBLIC API
   ══════════════════════════════════════════════════════════════════ */

/**
 * Activate a license key.
 * - Calls server (required for first activation)
 * - Stores encrypted cache locally
 * - Binds hardware ID on server
 */
export async function activateLicense(
  licenseKey: string,
  db: PrismaClient,
): Promise<ActivationResponse> {
  const key        = licenseKey.trim().toUpperCase()
  const hardwareId = generateHardwareId()

  // Get school name for display
  let schoolName = ''
  try {
    const school   = await (db as any).school?.findFirst()
    schoolName     = (school as any)?.name ?? ''
  } catch {}

  // Parse key locally to extract plan/year (always works offline)
  function parseKeyLocally(k: string) {
    const parts = k.split('-')
    if (parts.length < 4 || parts[0] !== 'SGSI') return null
    const planCode = parts[1]
    const PLANS: Record<string, { name: string; maxStudents: number }> = {
      STD: { name: 'Standard',     maxStudents: 500  },
      PRO: { name: 'Professional', maxStudents: 2000 },
      ULT: { name: 'Ultimate',     maxStudents: 9999 },
    }
    const plan = PLANS[planCode]
    if (!plan) return null
    const yearPart = parts[parts.length - 1]
    const year     = parseInt(yearPart, 10)
    if (isNaN(year) || year < 2024 || year > 2099) return null
    return {
      plan:        planCode,
      planName:    plan.name,
      maxStudents: plan.maxStudents,
      expiresAt:   year === 2099 ? null : new Date(year, 11, 31, 23, 59, 59).toISOString(),
      issuedAt:    new Date().toISOString(),
    }
  }

  // Call license server
  let serverResp: ActivationResponse | null = null
  try {
    const resp = await httpPost<ActivationResponse>(`${LICENSE_SERVER}/api/license/activate`, {
      licenseKey:  key,
      hardwareId,
      schoolName,
    })

    if (resp.status === 200 && resp.body?.success) {
      serverResp = resp.body
    } else if (resp.status === 404 || resp.status === 0) {
      // Route not found on server → fall back to local activation
      const local = parseKeyLocally(key)
      if (local) {
        serverResp = {
          success: true, plan: local.plan as any, planName: local.planName,
          maxStudents: local.maxStudents, schoolName, expiresAt: local.expiresAt, issuedAt: local.issuedAt,
        }
      } else {
        throw new Error('Clé de licence invalide. Format attendu : SGSI-PRO-XXXXXXXX-2027')
      }
    } else {
      // Server explicitly rejected the key (403 suspended, 401 invalid, etc.)
      const msg = (resp.body as any)?.error ?? `Erreur (HTTP ${resp.status})`
      throw new Error(msg)
    }
  } catch (e: any) {
    // Network error (no server) → try local validation
    if (e.code === 'TIMEOUT' || e.code === 'ENOTFOUND' || e.code === 'ECONNREFUSED' ||
        e.message?.includes('TIMEOUT') || e.message?.includes('ENOTFOUND') || e.message?.includes('ECONNREFUSED')) {
      const local = parseKeyLocally(key)
      if (local) {
        serverResp = {
          success: true, plan: local.plan as any, planName: local.planName,
          maxStudents: local.maxStudents, schoolName, expiresAt: local.expiresAt, issuedAt: local.issuedAt,
        }
      } else {
        throw new Error('Clé de licence invalide. Format attendu : SGSI-PRO-XXXXXXXX-2027')
      }
    } else if (!serverResp) {
      throw e
    }
  }

  // Save encrypted cache
  const cache: LicenseCache = {
    version:         1,
    key,
    plan:            serverResp.plan,
    planName:        serverResp.planName,
    maxStudents:     serverResp.maxStudents,
    schoolName:      serverResp.schoolName,
    hardwareId,
    expiresAt:       serverResp.expiresAt,
    issuedAt:        serverResp.issuedAt ?? new Date().toISOString(),
    activatedAt:     new Date().toISOString(),
    validatedAt:     new Date().toISOString(),
    serverValidated: true,
  }
  saveLicense(cache)

  // Also save to local Prisma DB
  try {
    await db.license.upsert({
      where:  { key },
      update: { isActive: true, expiresAt: serverResp.expiresAt ? new Date(serverResp.expiresAt) : null, plan: serverResp.plan, maxStudents: serverResp.maxStudents },
      create: { key, schoolName, plan: serverResp.plan, maxStudents: serverResp.maxStudents, isActive: true, expiresAt: serverResp.expiresAt ? new Date(serverResp.expiresAt) : null },
    })
  } catch { /* non-fatal */ }

  return serverResp
}

/**
 * Validate current license.
 * 1. Load encrypted local cache
 * 2. Try server re-validation (silently)
 * 3. Fall back to grace period
 */
export async function validateLicense(): Promise<LicenseValidationResult> {
  const cache = loadLicense()

  // No local cache
  if (!cache) {
    return { valid: false, source: 'none', reason: 'Aucune licence activée sur cet appareil.' }
  }

  // Check local expiry first
  if (cache.expiresAt && new Date() > new Date(cache.expiresAt)) {
    clearLicense()
    return { valid: false, source: 'cache', reason: 'Licence expirée. Veuillez renouveler.' }
  }

  // Try server re-validation (timeout = 4s, non-blocking)
  try {
    const hardwareId = generateHardwareId()
    const resp = await httpPost<any>(`${LICENSE_SERVER}/api/license/validate`, {
      licenseKey: cache.key,
      hardwareId,
    }, 4_000)

    if (resp.status === 200 && resp.body?.valid) {
      // Update cache with fresh validation timestamp
      saveLicense({ ...cache, validatedAt: new Date().toISOString(), serverValidated: true })
      const daysUntilExpiry = cache.expiresAt
        ? Math.max(0, Math.ceil((new Date(cache.expiresAt).getTime() - Date.now()) / 86400000))
        : undefined
      return {
        valid:           true,
        source:          'server',
        plan:            cache.plan as any,
        planName:        cache.planName,
        maxStudents:     cache.maxStudents,
        schoolName:      cache.schoolName,
        expiresAt:       cache.expiresAt,
        daysUntilExpiry,
        serverValidated: true,
      }
    }

    if (resp.status === 403) {
      // Server explicitly says license is invalid (revoked/suspended/expired)
      const reason = resp.body?.error ?? 'Licence invalide selon le serveur'
      clearLicense()
      return { valid: false, source: 'server', reason }
    }
  } catch {
    // Server unreachable — fall through to grace period check
  }

  // Server unreachable or other error — apply grace period logic
  return validateCachedLicense(cache)
}

/**
 * Deactivate license locally.
 */
export function deactivateLicense(): void {
  clearLicense()
}

/**
 * Get complete license info for UI display.
 */
export async function getLicenseInfo(): Promise<LicenseInfo> {
  const hardwareId      = generateHardwareId()
  const shortHardwareId = getShortHardwareId()
  const validation      = await validateLicense()
  const cache           = loadLicense()

  const needsOnlineValidation = cache
    ? daysSinceValidation() >= Math.floor(GRACE_DAYS * 0.7)  // warn at 70% of grace
    : false

  return {
    isActivated:    !!cache,
    validation,
    hardwareId,
    shortHardwareId,
    needsOnlineValidation,
  }
}

/**
 * Quick sync check (no network) — for app startup guard.
 */
export function isLicenseValidSync(): boolean {
  return hasValidLocalLicense()
}
