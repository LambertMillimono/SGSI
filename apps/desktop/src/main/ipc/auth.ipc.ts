import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { ok, fail } from '@sgsi/shared'
import { sendEmail, loadBrevoConfig } from '../services/email.service'

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

      // Vérifier que Brevo est configuré
      const brevoConfig = loadBrevoConfig()
      if (!brevoConfig?.apiKey) {
        return fail('NO_EMAIL_CONFIG', 'Le service email (Brevo) n\'est pas encore configuré. Demandez à l\'administrateur de le configurer dans Paramètres → Email (Brevo).')
      }

      // Generate and store OTP (SHA-256 hash, 15-min expiry)
      const otp    = Math.floor(100000 + Math.random() * 900000).toString()
      const hash   = crypto.createHash('sha256').update(otp).digest('hex')
      const expiry = Date.now() + 15 * 60 * 1000

      const tokensFile = path.join(app.getPath('userData'), 'sgsi-reset-tokens.json')
      let tokens: Record<string, { hash: string; expiry: number }> = {}
      try { if (fs.existsSync(tokensFile)) tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf-8')) } catch {}
      // Purge expired tokens
      const now = Date.now()
      Object.keys(tokens).forEach(k => { if (tokens[k].expiry < now) delete tokens[k] })
      tokens[user.id] = { hash, expiry }
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), 'utf-8')

      const schoolName = brevoConfig.fromName || 'SGSI SchoolManager'

      // Send OTP via Brevo
      await sendEmail({
        to:      user.email,
        subject: `Code de réinitialisation — ${schoolName}`,
        html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"/><style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#F0EFFF;padding:32px 16px;margin:0}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(99,102,241,.12)}
  .hdr{background:linear-gradient(135deg,#1E1B4B,#6366F1);padding:28px 36px}
  .hdr h1{color:#fff;font-size:20px;font-weight:800;margin:0}
  .hdr p{color:rgba(255,255,255,.6);font-size:12px;margin:4px 0 0}
  .body{padding:32px 36px}
  .otp-box{background:#EDE9FE;border:2px solid #6366F1;border-radius:14px;padding:24px;text-align:center;margin:24px 0}
  .otp{font-size:44px;font-weight:900;letter-spacing:12px;color:#312E81;font-family:'Courier New',monospace}
  .note{color:#6B7280;font-size:13px;line-height:1.7}
  .footer{background:#F9F7FF;border-top:1px solid #EDE9FE;padding:16px 36px;text-align:center}
  .footer p{color:#A1A1AA;font-size:11px;margin:0}
</style></head>
<body>
<div class="card">
  <div class="hdr"><h1>Réinitialisation de mot de passe</h1><p>${schoolName}</p></div>
  <div class="body">
    <p class="note">Bonjour <strong>${user.firstName} ${user.lastName}</strong>,</p>
    <p class="note" style="margin-top:8px">Votre code de réinitialisation à usage unique est :</p>
    <div class="otp-box"><div class="otp">${otp}</div></div>
    <p class="note">⏱ Ce code est valable <strong>15 minutes</strong>.</p>
    <p class="note" style="margin-top:8px">🔒 Ne le communiquez à personne. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
  </div>
  <div class="footer"><p>${schoolName} · SGSI SchoolManager Pro · Ne répondez pas à cet email</p></div>
</div>
</body>
</html>`,
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
