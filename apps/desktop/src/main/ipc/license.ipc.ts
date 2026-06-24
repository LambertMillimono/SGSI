/**
 * license.ipc.ts — Secure IPC handlers for the license system
 *
 * Security rules:
 *   - Never expose hardwareId full value to renderer
 *   - Never expose encryption keys
 *   - Validate all inputs on main process side
 */

import { ipcMain } from 'electron'
import https from 'https'
import http  from 'http'
import type { PrismaClient } from '@prisma/client'
import {
  activateLicense,
  validateLicense,
  deactivateLicense,
  getLicenseInfo,
  isLicenseValidSync,
} from '../license'

const LICENSE_SERVER = process.env.LICENSE_SERVER ?? 'http://localhost:3500'
const BREVO_API_KEY  = process.env.BREVO_API_KEY  ?? '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'
const ADMIN_EMAIL    = 'lambertmillimono8@gmail.com'

/** HTTP POST helper — runs in main process (no CSP restriction) */
function mainPost(url: string, body: Record<string, unknown>, timeoutMs = 10000): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const isTls  = parsed.protocol === 'https:'
    const mod    = isTls ? https : http
    const data   = JSON.stringify(body)

    const req = mod.request({
      hostname: parsed.hostname,
      port:     parsed.port ? Number(parsed.port) : (isTls ? 443 : 80),
      path:     parsed.pathname,
      method:   'POST',
      headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout:  timeoutMs,
    }, (res) => {
      let raw = ''
      res.on('data', c => (raw += c))
      res.on('end', () => {
        try   { resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) }) }
        catch { resolve({ status: res.statusCode ?? 0, body: raw }) }
      })
    })
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')) })
    req.on('error',   reject)
    req.write(data)
    req.end()
  })
}

/** Send request-key email directly via Brevo (fallback when server is offline) */
async function sendRequestEmailDirect(data: {
  schoolName: string; contactEmail: string; contactName: string;
  plan: string; hardwareId: string; message: string
}): Promise<void> {
  const planNames: Record<string, string> = { STD: 'Standard (500 élèves)', PRO: 'Professional (2 000 élèves)', ULT: 'Ultimate (Illimité)' }
  const planName = planNames[data.plan] ?? data.plan

  const html = `<div style="font-family:Arial,sans-serif;padding:24px;max-width:560px">
    <div style="background:linear-gradient(135deg,#1E1B4B,#6366F1);padding:24px;border-radius:12px;margin-bottom:20px">
      <h2 style="color:#fff;margin:0">🔑 Nouvelle demande de licence SGSI</h2>
    </div>
    <div style="background:#FEF3C7;border:1px solid #FDE68A;border-radius:8px;padding:14px;margin-bottom:20px">
      <strong style="color:#92400E">⚡ Action requise</strong>
      <p style="color:#92400E;margin:6px 0 0">Une école demande une clé de licence. Répondez à son email avec la clé générée.</p>
    </div>
    <table style="width:100%;font-size:13px">
      <tr><td style="color:#6B7280;padding:6px 0;width:140px">École</td><td><strong>${data.schoolName}</strong></td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Responsable</td><td>${data.contactName || '—'}</td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Email contact</td><td><strong>${data.contactEmail}</strong></td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Plan demandé</td><td><strong>${planName}</strong></td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Message</td><td>${data.message || '(aucun)'}</td></tr>
    </table>
    <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:12px;margin:16px 0">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6366F1;margin-bottom:6px">ID Machine</div>
      <div style="font-family:monospace;color:#312E81;word-break:break-all">${data.hardwareId || '(non fourni)'}</div>
    </div>
    <div style="background:#F3F4F6;border-radius:8px;padding:12px;font-size:12px;color:#374151">
      <strong>Commande pour générer la clé :</strong><br/>
      <code>node src/admin.js generate --plan ${data.plan} --year ${new Date().getFullYear()+1} --school "${data.schoolName}" --email "${data.contactEmail}"</code>
    </div>
  </div>`

  const brevoBody = JSON.stringify({
    sender:      { name: 'SGSI License System', email: ADMIN_EMAIL },
    to:          [{ email: ADMIN_EMAIL }],
    subject:     `🔑 [SGSI] Demande de licence — ${data.schoolName} (${data.plan})`,
    htmlContent: html,
  })

  await new Promise<void>((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers:  {
        'api-key':      BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(brevoBody),
      },
    }, (res) => {
      let d = ''
      res.on('data', c => (d += c))
      res.on('end', () => {
        if ((res.statusCode ?? 0) < 300) resolve()
        else reject(new Error(`Brevo ${res.statusCode}: ${d}`))
      })
    })
    req.on('error', reject)
    req.write(brevoBody)
    req.end()
  })
}

function ok<T>(data: T)                        { return { success: true,  data  } }
function fail(code: string, message: string)   { return { success: false, error: { code, message } } }

export function registerLicenseIpc(db: PrismaClient): void {

  /** Activate license key — requires internet */
  ipcMain.handle('license:activate', async (_, key: string) => {
    try {
      if (!key?.trim()) return fail('INVALID_KEY', 'Clé de licence manquante')
      const result = await activateLicense(key.trim().toUpperCase(), db)
      return ok(result)
    } catch (e: any) {
      return fail('ACTIVATION_FAILED', e.message ?? 'Erreur d\'activation')
    }
  })

  /** Full license info for UI */
  ipcMain.handle('license:get', async () => {
    try {
      const info = await getLicenseInfo()
      // Mask full hardware ID before sending to renderer
      return ok({
        ...info,
        hardwareId: info.hardwareId.slice(0, 8) + '...' + info.hardwareId.slice(-4),
      })
    } catch (e: any) {
      return fail('LICENSE_ERROR', e.message)
    }
  })

  /** Validate — with server re-validation attempt */
  ipcMain.handle('license:validate', async () => {
    try {
      const result = await validateLicense()
      return ok(result)
    } catch (e: any) {
      return ok({ valid: false, source: 'error', reason: e.message })
    }
  })

  /** Quick sync check (no network) */
  ipcMain.handle('license:isValid', async () => {
    return ok(isLicenseValidSync())
  })

  /**
   * Request a license key — sends notification email directly via Brevo.
   * No external server required — works always.
   */
  ipcMain.handle('license:request', async (_, data: {
    schoolName: string; contactEmail: string; contactName: string;
    plan: string; hardwareId: string; message: string
  }) => {
    if (!data.schoolName?.trim())   return fail('MISSING', "Nom de l'école requis")
    if (!data.contactEmail?.trim()) return fail('MISSING', 'Email de contact requis')

    // Always send directly via Brevo (no server dependency)
    try {
      await sendRequestEmailDirect(data)
      const requestId = Math.random().toString(36).slice(2, 8).toUpperCase()
      return ok({
        success:   true,
        requestId,
        message:   `Demande envoyée ! L'administrateur SGSI vous contactera à ${data.contactEmail} dans les prochaines heures.`,
      })
    } catch (e: any) {
      const errMsg = e.message ?? ''
      // Brevo error: give user a clear message
      if (errMsg.includes('Brevo') || errMsg.includes('401') || errMsg.includes('403')) {
        return fail('EMAIL_ERROR', 'Erreur de configuration email. Contactez directement : lambertmillimono8@gmail.com')
      }
      if (errMsg.includes('ENOTFOUND') || errMsg.includes('ECONNREFUSED') || errMsg.includes('TIMEOUT')) {
        return fail('NETWORK_ERROR', 'Pas de connexion Internet. Vérifiez votre connexion et réessayez.')
      }
      return fail('EMAIL_ERROR', `Erreur : ${errMsg}. Contactez directement lambertmillimono8@gmail.com`)
    }
  })

  /** ADMIN — Generate a new license key (directly, no server needed) */
  ipcMain.handle('license:adminGenerate', async (_, data: {
    plan: string; schoolName: string; customerEmail: string; expiryYear: number; maxMachines: number
  }) => {
    try {
      const PLANS: Record<string, { name: string; maxStudents: number }> = {
        STD: { name: 'Standard', maxStudents: 500 },
        PRO: { name: 'Professional', maxStudents: 2000 },
        ULT: { name: 'Ultimate', maxStudents: 9999 },
      }
      const planUp   = (data.plan ?? 'STD').toUpperCase()
      const planInfo = PLANS[planUp] ?? PLANS.STD
      const chars    = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      let code = ''
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
      const key       = `SGSI-${planUp}-${code}-${data.expiryYear}`
      const expiresAt = new Date(data.expiryYear, 11, 31, 23, 59, 59).toISOString()

      // Try to register on the license server (optional)
      try {
        await mainPost(`${LICENSE_SERVER}/api/license/generate`, {
          adminSecret: process.env.ADMIN_SECRET ?? 'sgsi-admin-secret-change-me',
          plan: planUp, expiryYear: data.expiryYear,
          schoolName: data.schoolName, customerEmail: data.customerEmail,
          maxMachines: data.maxMachines ?? 1,
        }, 4000)
      } catch { /* server offline — key still works locally */ }

      return ok({ key, plan: planUp, planName: planInfo.name, maxStudents: planInfo.maxStudents, expiresAt })
    } catch (e: any) {
      return fail('GEN_ERROR', e.message)
    }
  })

  /** ADMIN — Send generated key to client via Brevo */
  ipcMain.handle('license:sendKey', async (_, data: {
    licenseKey: string; clientEmail: string; schoolName: string
  }) => {
    if (!data.licenseKey || !data.clientEmail) return fail('MISSING', 'licenseKey et clientEmail requis')

    const keyParts = data.licenseKey.split('-')
    const plan     = keyParts[1] ?? 'STD'
    const year     = keyParts[keyParts.length - 1] ?? ''
    const PLAN_NAMES: Record<string, string> = { STD: 'Standard', PRO: 'Professional', ULT: 'Ultimate' }

    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F0EFFF;padding:24px;margin:0}
  .card{background:#fff;border-radius:16px;max-width:520px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,.12)}
  .hdr{background:linear-gradient(135deg,#1E1B4B,#6366F1);padding:28px 36px}
  .logo{display:flex;align-items:center;gap:12px}
  .lm{width:44px;height:44px;background:rgba(255,255,255,.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff}
  .lt{color:#fff;font-size:18px;font-weight:800}.ls{color:rgba(255,255,255,.6);font-size:12px;margin-top:2px}
  .body{padding:28px 36px}
  h2{font-size:20px;color:#1E1B4B;margin:0 0 10px}
  p{color:#52525B;font-size:13px;line-height:1.7;margin:0 0 20px}
  .key-box{background:#F5F3FF;border:2px solid #6366F1;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px}
  .key-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#6366F1;margin-bottom:10px}
  .key-val{font-family:monospace;font-size:22px;font-weight:900;color:#312E81;letter-spacing:1px;word-break:break-all}
  .steps{margin-bottom:20px}
  .step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px}
  .snum{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#6366F1,#4F46E5);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
  .stxt{font-size:13px;color:#374151;line-height:1.6}
  .footer{background:#F9FAFB;padding:16px 36px;text-align:center;border-top:1px solid #E5E7EB;font-size:11px;color:#9CA3AF}
</style></head><body>
<div class="card">
  <div class="hdr"><div class="logo"><div class="lm">S</div><div><div class="lt">SGSI</div><div class="ls">SchoolManager Pro</div></div></div></div>
  <div class="body">
    <h2>🎉 Votre clé de licence est prête !</h2>
    <p>Bonjour,<br/>Voici votre clé de licence <strong>SGSI SchoolManager Pro</strong> pour <strong>${data.schoolName || 'votre école'}</strong>.<br/>
    Plan : <strong>${PLAN_NAMES[plan] ?? plan}</strong> · Valide jusqu'au 31/12/${year}</p>
    <div class="key-box">
      <div class="key-label">🔑 Clé de licence</div>
      <div class="key-val">${data.licenseKey}</div>
    </div>
    <p style="font-weight:700;margin-bottom:12px">Comment activer :</p>
    <div class="steps">
      <div class="step"><div class="snum">1</div><div class="stxt">Ouvrez l'application <strong>SGSI Desktop</strong> sur votre ordinateur</div></div>
      <div class="step"><div class="snum">2</div><div class="stxt">Sur l'écran d'activation, entrez la clé ci-dessus</div></div>
      <div class="step"><div class="snum">3</div><div class="stxt">Cliquez <strong>"Activer la licence"</strong> — votre accès est immédiat ✅</div></div>
    </div>
    <p style="font-size:12px;color:#6B7280;margin:0">Problème ? Contactez : lambertmillimono8@gmail.com</p>
  </div>
  <div class="footer">SGSI SchoolManager Pro · Ne partagez pas cette clé · Elle est liée à votre machine</div>
</div></body></html>`

    try {
      await sendRequestEmailDirect({
        schoolName: data.schoolName, contactEmail: data.clientEmail,
        contactName: '', plan: plan, hardwareId: '', message: `CLE_ENVOYEE:${data.licenseKey}`,
      })

      // Actually send with proper template via Brevo
      const brevoBody = JSON.stringify({
        sender:      { name: 'SGSI SchoolManager', email: ADMIN_EMAIL },
        to:          [{ email: data.clientEmail }],
        subject:     `🔑 Votre clé de licence SGSI — ${data.schoolName || 'SchoolManager Pro'}`,
        htmlContent: html,
      })
      await new Promise<void>((resolve, reject) => {
        const https_req = require('https').request({
          hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
          headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(brevoBody) },
        }, (res: any) => {
          let d = ''; res.on('data', (c: any) => (d += c))
          res.on('end', () => { if ((res.statusCode ?? 0) < 300) resolve(); else reject(new Error(`Brevo ${res.statusCode}: ${d}`)) })
        })
        https_req.on('error', reject); https_req.write(brevoBody); https_req.end()
      })

      return ok({ success: true, message: `Clé envoyée à ${data.clientEmail}` })
    } catch (e: any) {
      return fail('SEND_ERROR', `Impossible d'envoyer l'email : ${e.message}`)
    }
  })

  /** Deactivate locally */
  ipcMain.handle('license:deactivate', async () => {
    try {
      deactivateLicense()
      return ok(null)
    } catch (e: any) {
      return fail('DEACTIVATION_FAILED', e.message)
    }
  })
}
