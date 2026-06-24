/**
 * Email service — uses Brevo (Sendinblue) API
 * REST API, no external SDK needed (uses native https module)
 * Config stored in %APPDATA%/@sgsi/desktop/brevo-config.json
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'

const CONFIG_FILE = path.join(app.getPath('userData'), 'brevo-config.json')

export interface BrevoConfig {
  apiKey:    string
  fromName:  string
  fromEmail: string
}

export function loadResendConfig(): BrevoConfig | null {
  return loadBrevoConfig()
}

export function loadBrevoConfig(): BrevoConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'))
  } catch { return null }
}

export function saveBrevoConfig(config: BrevoConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8')
}

/** Send email via Brevo REST API */
export async function sendEmail(opts: {
  to:      string | string[]
  subject: string
  html:    string
  text?:   string
}): Promise<{ id: string }> {
  const config = loadBrevoConfig()
  if (!config?.apiKey) throw new Error('Clé API Brevo non configurée. Allez dans Paramètres → Email.')
  if (!config?.fromEmail) throw new Error('Email expéditeur non configuré.')

  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).map(email => ({ email }))

  const body = JSON.stringify({
    sender:      { name: config.fromName || 'SGSI', email: config.fromEmail },
    to:          recipients,
    subject:     opts.subject,
    htmlContent: opts.html,
    textContent: opts.text ?? opts.subject,
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path:     '/v3/smtp/email',
      method:   'POST',
      headers: {
        'api-key':      config.apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ id: parsed.messageId ?? 'sent' })
          } else {
            reject(new Error(parsed.message ?? `Brevo error ${res.statusCode}: ${data}`))
          }
        } catch {
          reject(new Error(`Brevo response invalid: ${data}`))
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/** Send SMS via Brevo SMS API */
export async function sendSms(opts: {
  to:      string   // phone number with country code e.g. +224620000000
  message: string
  sender?: string   // max 11 chars alphanumeric
}): Promise<{ messageId: string }> {
  const config = loadBrevoConfig()
  if (!config?.apiKey) throw new Error('Clé API Brevo non configurée')

  const body = JSON.stringify({
    sender:    opts.sender ?? 'SGSI',
    recipient: opts.to.replace(/\s/g, ''),
    content:   opts.message,
    type:      'transactional',
  })

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.brevo.com',
      path:     '/v3/transactionalSMS/sms',
      method:   'POST',
      headers:  {
        'api-key':      config.apiKey,
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: parsed.messageId ?? 'sent' })
          } else {
            reject(new Error(parsed.message ?? `Brevo SMS error ${res.statusCode}`))
          }
        } catch { reject(new Error(`Response invalid: ${data}`)) }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/** Build the teacher welcome email HTML */
export function buildTeacherWelcomeEmail(opts: {
  teacherName:  string
  username:     string
  password:     string
  schoolName:   string
  schoolPhone?: string
}): string {
  const { teacherName, username, password, schoolName, schoolPhone } = opts

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #F0EFFF; padding: 32px 16px; -webkit-font-smoothing: antialiased; }
    .container { max-width: 560px; margin: 0 auto; }
    .card { background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(99,102,241,0.12); }
    .header { background: linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #6366F1 100%); padding: 32px 40px; }
    .logo-row { display: flex; align-items: center; gap: 14px; }
    .logo-mark { width: 44px; height: 44px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #FFF; }
    .logo-text { color: #FFFFFF; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .logo-sub { color: rgba(255,255,255,0.6); font-size: 12px; margin-top: 2px; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 22px; font-weight: 700; color: #1E1B4B; margin-bottom: 12px; letter-spacing: -0.3px; }
    .intro { color: #52525B; font-size: 14px; line-height: 1.75; margin-bottom: 28px; }
    .cred-box { background: #F5F3FF; border: 1.5px solid #C7D2FE; border-radius: 14px; padding: 24px 28px; margin-bottom: 24px; }
    .cred-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #6366F1; margin-bottom: 18px; }
    .cred-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #E0E7FF; }
    .cred-row:last-child { border-bottom: none; padding-bottom: 0; }
    .cred-label { font-size: 12px; color: #6B7280; font-weight: 600; }
    .cred-value { font-size: 14px; font-weight: 700; color: #312E81; font-family: 'Courier New', monospace; background: #FFFFFF; padding: 6px 14px; border-radius: 8px; border: 1px solid #C4B5FD; letter-spacing: 0.5px; }
    .alert { background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; }
    .alert p { font-size: 13px; color: #92400E; line-height: 1.6; }
    .steps-title { font-size: 13px; font-weight: 700; color: #1E1B4B; margin-bottom: 14px; }
    .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .step-num { width: 26px; height: 26px; border-radius: 50%; background: linear-gradient(135deg, #6366F1, #4F46E5); color: #FFF; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
    .step p { font-size: 13px; color: #374151; line-height: 1.6; margin: 0; }
    .divider { height: 1px; background: #F4F4F5; margin: 24px 0; }
    .note { font-size: 12px; color: #9CA3AF; line-height: 1.7; }
    .footer { background: linear-gradient(135deg, #F9F7FF, #F0EFFF); padding: 20px 40px; text-align: center; border-top: 1px solid #EDE9FE; }
    .footer p { font-size: 11px; color: #A1A1AA; line-height: 1.7; }
    .school-link { color: #6366F1; font-weight: 600; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">

      <!-- Header -->
      <div class="header">
        <div class="logo-row">
          <div class="logo-mark">S</div>
          <div>
            <div class="logo-text">SGSI</div>
            <div class="logo-sub">SchoolManager Pro · ${schoolName}</div>
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <div class="greeting">Bienvenue, ${teacherName} ! 👋</div>
        <p class="intro">
          Votre compte enseignant sur <strong>SGSI SchoolManager Pro</strong>
          de <strong>${schoolName}</strong> a été créé avec succès.
          Voici vos identifiants de connexion.
        </p>

        <!-- Credentials -->
        <div class="cred-box">
          <div class="cred-title">🔐 Vos identifiants de connexion</div>
          <div class="cred-row">
            <span class="cred-label">Identifiant</span>
            <span class="cred-value">${username}</span>
          </div>
          <div class="cred-row">
            <span class="cred-label">Mot de passe temporaire</span>
            <span class="cred-value">${password}</span>
          </div>
        </div>

        <!-- Alert -->
        <div class="alert">
          <p>⚠️ <strong>Action requise :</strong> Ce mot de passe est temporaire.
          Veuillez le modifier immédiatement après votre première connexion
          dans <strong>Paramètres → Mon profil</strong>.</p>
        </div>

        <!-- Steps -->
        <div class="steps-title">Comment vous connecter :</div>
        <div class="step">
          <div class="step-num">1</div>
          <p>Ouvrez l'application <strong>SGSI Desktop</strong> sur l'ordinateur de l'établissement</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <p>Saisissez votre identifiant <strong style="color:#6366F1">${username}</strong> et le mot de passe temporaire</p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <p>Changez votre mot de passe dans <strong>Paramètres → Mon profil</strong></p>
        </div>

        <div class="divider"></div>

        <p class="note">
          Besoin d'aide ? Contactez l'administration de <strong>${schoolName}</strong>
          ${schoolPhone ? `au <strong>${schoolPhone}</strong>` : ''}.
        </p>
      </div>

      <!-- Footer -->
      <div class="footer">
        <p>Email envoyé automatiquement par <span class="school-link">${schoolName}</span>
        via <span class="school-link">SGSI SchoolManager Pro</span>.<br/>
        Ne répondez pas à cet email.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}
