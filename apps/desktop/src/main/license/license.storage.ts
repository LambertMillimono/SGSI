/**
 * license.storage.ts — Encrypted + HMAC-signed local license cache
 *
 * Security:
 *   - AES-256-GCM encryption (authenticated encryption — detects tampering)
 *   - HMAC-SHA256 signature on the entire payload
 *   - Encryption key derived from hardware ID (machine-bound)
 *   - Any modification to the file invalidates the signature
 */

import fs     from 'fs'
import path   from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import { generateHardwareId } from './hardware'

/* ── Constants ────────────────────────────────────────────────── */
const STORAGE_VERSION = 1
const CACHE_FILE      = path.join(app.getPath('userData'), '.sgsi_lic')
const HMAC_SECRET     = 'sgsi-hmac-secret-v1-do-not-share'  // in production: env var

/* ── Types ────────────────────────────────────────────────────── */
export interface LicenseCache {
  version:       number
  key:           string
  plan:          string
  planName:      string
  maxStudents:   number
  schoolName:    string
  hardwareId:    string
  expiresAt:     string | null
  issuedAt:      string
  activatedAt:   string
  validatedAt:   string    // last successful server validation
  serverValidated: boolean
}

interface StorageEnvelope {
  v:    number           // version
  iv:   string           // AES IV (hex)
  tag:  string           // GCM auth tag (hex)
  data: string           // encrypted payload (hex)
  sig:  string           // HMAC signature (hex)
}

/* ── Encryption key (hardware-bound) ─────────────────────────── */
function deriveKey(): Buffer {
  const hwId = generateHardwareId()
  return crypto.createHash('sha256').update(hwId + HMAC_SECRET).digest()
}

/* ── AES-256-GCM helpers ─────────────────────────────────────── */
function encrypt(plaintext: string): { iv: string; tag: string; data: string } {
  const key = deriveKey()
  const iv  = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return {
    iv:   iv.toString('hex'),
    tag:  cipher.getAuthTag().toString('hex'),
    data: enc.toString('hex'),
  }
}

function decrypt(iv: string, tag: string, data: string): string {
  const key     = deriveKey()
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  )
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(data, 'hex')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}

/* ── HMAC helpers ────────────────────────────────────────────── */
function sign(payload: string): string {
  return crypto
    .createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex')
}

function verify(payload: string, sig: string): boolean {
  const expected = sign(payload)
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch { return false }
}

/* ── Public API ──────────────────────────────────────────────── */

/**
 * Save license cache to disk — encrypted + signed.
 */
export function saveLicense(data: LicenseCache): void {
  const plaintext = JSON.stringify(data)
  const { iv, tag, enc_data } = (() => {
    const e = encrypt(plaintext)
    return { iv: e.iv, tag: e.tag, enc_data: e.data }
  })()

  // Sign the ciphertext (not plaintext) to detect any modification
  const sigPayload = `${STORAGE_VERSION}:${iv}:${tag}:${enc_data}`
  const sig        = sign(sigPayload)

  const envelope: StorageEnvelope = {
    v: STORAGE_VERSION, iv, tag,
    data: enc_data,
    sig,
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(envelope), { encoding: 'utf8', mode: 0o600 })
}

/**
 * Load and verify license cache from disk.
 * Returns null if file missing, tampered, or decryption fails.
 */
export function loadLicense(): LicenseCache | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null

    const raw: StorageEnvelope = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    if (!raw || raw.v !== STORAGE_VERSION) return null

    // Verify signature — detect tampering
    const sigPayload = `${raw.v}:${raw.iv}:${raw.tag}:${raw.data}`
    if (!verify(sigPayload, raw.sig)) {
      console.warn('[SGSI License] Tampered license cache detected. Clearing.')
      clearLicense()
      return null
    }

    // Decrypt — GCM auth tag also detects modification
    const plaintext = decrypt(raw.iv, raw.tag, raw.data)
    const data: LicenseCache = JSON.parse(plaintext)

    // Extra sanity: hardware ID must match current machine
    const currentHwId = generateHardwareId()
    if (data.hardwareId && data.hardwareId !== currentHwId) {
      console.warn('[SGSI License] Hardware ID mismatch. License not valid on this machine.')
      return null
    }

    return data
  } catch (e) {
    console.error('[SGSI License] Failed to load license cache:', e)
    return null
  }
}

/**
 * Remove the license cache file.
 */
export function clearLicense(): void {
  try { if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE) } catch {}
}

/**
 * Check if a valid (non-expired) license cache exists locally.
 */
export function hasValidLocalLicense(): boolean {
  const cache = loadLicense()
  if (!cache) return false
  if (!cache.expiresAt) return true
  return new Date() < new Date(cache.expiresAt)
}

/**
 * Days since last server validation.
 */
export function daysSinceValidation(): number {
  const cache = loadLicense()
  if (!cache?.validatedAt) return Infinity
  const ms = Date.now() - new Date(cache.validatedAt).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}
