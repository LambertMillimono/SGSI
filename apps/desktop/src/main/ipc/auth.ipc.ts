import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { ok, fail } from '@sgsi/shared'

export function registerAuthIpc(db: PrismaClient, jwtSecret: string): void {
  const auth = new AuthService(db, jwtSecret)

  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try { return ok(await auth.login(username, password)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:verifyToken', async (_, token: string) => {
    try { return ok(auth.verifyToken(token)) }
    catch { return fail('INVALID_TOKEN', 'Token invalide') }
  })

  ipcMain.handle('auth:requestReset', async (_, userId: string, requestedBy: string) => {
    try { return ok({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) }) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:changePassword', async (_, userId: string, newPassword: string) => {
    try { await auth.changePassword(userId, newPassword); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:checkPermission', async (_, userId: string, module: string, action: string) => {
    try { return ok(await auth.checkPermission(userId, module, action)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  // JWT is stateless — logout is handled client-side by discarding the token
  ipcMain.handle('auth:logout', async () => ok(null))

  ipcMain.handle('auth:findByUsername', async (_, username: string) => {
    try {
      const rows = await db.$queryRaw<Array<{ id: string; firstName: string; lastName: string; role: string; isActive: number }>>`
        SELECT id, firstName, lastName, role, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`
      const user = rows[0] ?? null
      if (!user) return fail('NOT_FOUND', 'Aucun compte trouvé avec cet identifiant')
      if (!user.isActive) return fail('DISABLED', 'Ce compte est désactivé. Contactez votre administrateur.')
      return ok({ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role })
    } catch (e: any) {
      return fail(e.code ?? 'ERROR', e.message)
    }
  })

  // Send a 6-digit OTP to the user's email and store its hash+expiry in userData
  ipcMain.handle('auth:sendResetEmail', async (_, username: string) => {
    try {
      const rows = await db.$queryRaw<Array<{ id: string; firstName: string; lastName: string; email: string | null; isActive: number }>>`
        SELECT id, firstName, lastName, email, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`
      const user = rows[0] ?? null
      if (!user) return fail('NOT_FOUND', 'Aucun compte trouvé avec cet identifiant')
      if (!user.isActive) return fail('DISABLED', 'Ce compte est désactivé. Contactez votre administrateur.')
      if (!user.email) return fail('NO_EMAIL', 'Aucune adresse email configurée pour ce compte. Demandez à votre administrateur de renseigner votre email dans Paramètres → Utilisateurs.')

      const smtpFile = path.join(app.getPath('userData'), 'sgsi-smtp.json')
      if (!fs.existsSync(smtpFile)) return fail('NO_SMTP', 'Le serveur email n\'est pas encore configuré. Demandez à l\'administrateur de le configurer dans Paramètres → Établissement.')
      const smtp = JSON.parse(fs.readFileSync(smtpFile, 'utf-8'))

      // Generate and store OTP (SHA-256 hash, 15-min expiry)
      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      const hash = crypto.createHash('sha256').update(otp).digest('hex')
      const expiry = Date.now() + 15 * 60 * 1000

      const tokensFile = path.join(app.getPath('userData'), 'sgsi-reset-tokens.json')
      let tokens: Record<string, { hash: string; expiry: number }> = {}
      try { if (fs.existsSync(tokensFile)) tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf-8')) } catch {}
      // Purge expired tokens
      const now = Date.now()
      Object.keys(tokens).forEach(k => { if (tokens[k].expiry < now) delete tokens[k] })
      tokens[user.id] = { hash, expiry }
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), 'utf-8')

      // Send email via nodemailer
      const nodemailer = require('nodemailer')
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.password },
        tls: { rejectUnauthorized: false },
      })
      const fromName  = smtp.fromName  || 'SGSI SchoolManager'
      const fromEmail = smtp.fromEmail || smtp.user
      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: user.email,
        subject: `Code de réinitialisation — ${fromName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <h2 style="color:#1E3A8A;margin-bottom:8px;">Réinitialisation de mot de passe</h2>
            <p>Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p>
            <p>Votre code de réinitialisation est :</p>
            <div style="background:#EFF6FF;border:2px solid #2563EB;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
              <span style="font-size:40px;font-weight:900;letter-spacing:10px;color:#1E3A8A;">${otp}</span>
            </div>
            <p style="color:#6B7280;font-size:14px;">Ce code est valable <strong>15 minutes</strong>. Ne le communiquez à personne.</p>
            <p style="color:#6B7280;font-size:14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
            <hr style="border:1px solid #E5E7EB;margin:24px 0;">
            <p style="color:#9CA3AF;font-size:11px;">${fromName} — SGSI SchoolManager</p>
          </div>
        `,
      })

      // Return masked email: john.doe@gmail.com → jo***@gm***.com
      const [local, domain] = user.email.split('@')
      const [domainName, ...tldParts] = domain.split('.')
      const maskedEmail = local.slice(0, 2) + '***@' + domainName.slice(0, 2) + '***.' + tldParts.join('.')
      return ok({ maskedEmail, userId: user.id })
    } catch (e: any) {
      return fail(e.code ?? 'SMTP_ERROR', e.message)
    }
  })

  // Verify OTP and set new password
  ipcMain.handle('auth:resetByOtp', async (_, userId: string, otp: string, newPassword: string) => {
    try {
      const tokensFile = path.join(app.getPath('userData'), 'sgsi-reset-tokens.json')
      if (!fs.existsSync(tokensFile)) return fail('INVALID_OTP', 'Code invalide ou expiré')
      const tokens: Record<string, { hash: string; expiry: number }> = JSON.parse(fs.readFileSync(tokensFile, 'utf-8'))
      const token = tokens[userId]
      if (!token) return fail('INVALID_OTP', 'Code invalide ou expiré')
      if (token.expiry < Date.now()) {
        delete tokens[userId]
        fs.writeFileSync(tokensFile, JSON.stringify(tokens), 'utf-8')
        return fail('OTP_EXPIRED', 'Code expiré. Faites une nouvelle demande.')
      }
      const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex')
      if (inputHash !== token.hash) return fail('INVALID_OTP', 'Code incorrect')
      await auth.changePassword(userId, newPassword)
      delete tokens[userId]
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), 'utf-8')
      return ok(null)
    } catch (e: any) {
      return fail(e.code ?? 'ERROR', e.message)
    }
  })

  // Recovery code fallback (when email/SMTP not available)
  ipcMain.handle('auth:resetByRecovery', async (_, username: string, recoveryCode: string, newPassword: string) => {
    try {
      const recoveryFile = path.join(app.getPath('userData'), 'sgsi-recovery.json')
      if (!fs.existsSync(recoveryFile)) return fail('NO_RECOVERY', 'Aucun code de récupération configuré.')
      const stored = JSON.parse(fs.readFileSync(recoveryFile, 'utf-8'))
      const inputHash = crypto.createHash('sha256').update(recoveryCode.trim()).digest('hex')
      if (inputHash !== stored.hash) return fail('INVALID_CODE', 'Code de récupération incorrect')
      const rows = await db.$queryRaw<Array<{ id: string; isActive: number }>>`
        SELECT id, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`
      const user = rows[0] ?? null
      if (!user || !user.isActive) return fail('NOT_FOUND', 'Utilisateur introuvable')
      await auth.changePassword(user.id, newPassword)
      return ok(null)
    } catch (e: any) {
      return fail(e.code ?? 'ERROR', e.message)
    }
  })
}
