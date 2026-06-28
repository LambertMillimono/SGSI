"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const client = require("@prisma/client");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const https = require("https");
const archiver = require("archiver");
const os = require("os");
const http = require("http");
const child_process = require("child_process");
const QRCode = require("qrcode");
const ExcelJS = require("exceljs");
const express = require("express");
const cors = require("cors");
const electronUpdater = require("electron-updater");
let _prisma = null;
function getDbPath() {
  const isPackaged = electron.app.isPackaged;
  const appDataDir = process.env.APPDATA ?? path.join(electron.app.getPath("home"), "AppData", "Roaming");
  return isPackaged ? path.join(appDataDir, "sgsi", "sgsi.db") : path.resolve(__dirname, "../../../../packages/db/prisma/sgsi.db");
}
function ensureDbExists(dbPath) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    const templatePath = path.join(process.resourcesPath, "template.db");
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath);
    }
  }
}
function getDb() {
  if (!_prisma) {
    const dbPath = getDbPath();
    if (electron.app.isPackaged) {
      ensureDbExists(dbPath);
    }
    _prisma = new client.PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
      log: electron.app.isPackaged ? ["error"] : ["error", "warn"]
    });
  }
  return _prisma;
}
async function closeDb() {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}
const DEFAULT_EVAL_WEIGHTS = {
  DS1: 1,
  DS2: 1,
  COMPOSITION: 2,
  INTERRO: 0.5,
  TP: 0.5,
  EXAM: 3
};
function ok$c(data) {
  return { success: true, data };
}
function fail$c(code, message) {
  return { success: false, error: { code, message } };
}
class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "ServiceError";
  }
}
function calcSubjectAverage(grades, weights) {
  if (grades.length === 0) return 0;
  const totalWeight = grades.reduce((sum, g) => sum + weights[g.evalType], 0);
  if (totalWeight === 0) return 0;
  const weightedSum = grades.reduce(
    (sum, g) => sum + g.value / g.maxValue * 20 * weights[g.evalType],
    0
  );
  return Math.round(weightedSum / totalWeight * 100) / 100;
}
function calcGeneralAverage(subjectAverages) {
  if (subjectAverages.length === 0) return 0;
  const totalCoeff = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0);
  if (totalCoeff === 0) return 0;
  const weightedSum = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0);
  return Math.round(weightedSum / totalCoeff * 100) / 100;
}
function calcRankings(averages) {
  const passing = [...averages].filter((a) => !a.isEliminated).sort((a, b) => b.generalAverage - a.generalAverage);
  const eliminated = [...averages].filter((a) => a.isEliminated).sort((a, b) => b.generalAverage - a.generalAverage);
  return [...passing, ...eliminated].map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}
function generateMatricule(params) {
  const { schoolSigle, firstName, lastName, year, sequence } = params;
  if (!firstName.trim() || !lastName.trim()) {
    throw new Error("firstName and lastName must not be empty to generate a matricule");
  }
  const initials = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toUpperCase()}`;
  const seq = String(sequence).padStart(4, "0");
  return `${schoolSigle.toUpperCase()}${initials}-${year}-${seq}`;
}
function formatReceiptNo(date, sequence) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const capped = sequence > 999 ? sequence : sequence;
  const seq = String(capped).padStart(3, "0");
  return `REC-${month}-${year}-${seq}`;
}
class AuthService {
  constructor(db, jwtSecret) {
    this.db = db;
    this.jwtSecret = jwtSecret;
  }
  async login(username, password) {
    const rows = await this.db.$queryRaw`
      SELECT id, username, password, role, firstName, lastName, isActive, mustChangePassword
      FROM "User" WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
    const user = rows[0] ?? null;
    if (!user || !user.isActive) {
      throw new ServiceError("INVALID_CREDENTIALS", "Identifiants invalides");
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new ServiceError("INVALID_CREDENTIALS", "Identifiants invalides");
    }
    await this.db.user.update({
      where: { id: user.id },
      data: { lastLogin: /* @__PURE__ */ new Date() }
    });
    await this.db.auditLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entity: "user",
        entityId: user.id
      }
    });
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: "8h" });
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: !!user.mustChangePassword
      }
    };
  }
  verifyToken(token) {
    return jwt.verify(token, this.jwtSecret);
  }
  async requestPasswordReset(userId, requestedBy) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let tempPassword = "";
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const hashed = await bcrypt.hash(tempPassword, 12);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await this.db.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        mustChangePassword: true,
        tempPasswordExpiry: expiry
      }
    });
    await this.db.auditLog.create({
      data: {
        userId: requestedBy,
        action: "PASSWORD_RESET_REQUEST",
        entity: "user",
        entityId: userId
      }
    });
    return tempPassword;
  }
  async changePassword(userId, newPassword) {
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        mustChangePassword: false,
        tempPasswordExpiry: null
      }
    });
    await this.db.auditLog.create({
      data: {
        userId,
        action: "PASSWORD_CHANGED",
        entity: "user",
        entityId: userId
      }
    });
  }
  async checkPermission(userId, module2, action) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return false;
    if (user.role === "SUPER_ADMIN") return true;
    const { ROLE_PERMISSIONS } = await Promise.resolve().then(() => require("./chunks/index-BVcwclxK.js"));
    const perms = ROLE_PERMISSIONS[user.role] ?? [];
    return perms.some(
      (p) => (p.module === module2 || p.module === "*") && p.actions.includes(action)
    );
  }
}
const CONFIG_FILE$1 = path.join(electron.app.getPath("userData"), "brevo-config.json");
function loadBrevoConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE$1)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE$1, "utf-8"));
  } catch {
    return null;
  }
}
function saveBrevoConfig(config) {
  fs.writeFileSync(CONFIG_FILE$1, JSON.stringify(config, null, 2), "utf-8");
}
async function sendEmail(opts) {
  const config = loadBrevoConfig();
  if (!config?.apiKey) throw new Error("Clé API Brevo non configurée. Allez dans Paramètres → Email.");
  if (!config?.fromEmail) throw new Error("Email expéditeur non configuré.");
  const recipients = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((email) => ({ email }));
  const body = JSON.stringify({
    sender: { name: config.fromName || "SGSI", email: config.fromEmail },
    to: recipients,
    subject: opts.subject,
    htmlContent: opts.html,
    textContent: opts.text ?? opts.subject
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ id: parsed.messageId ?? "sent" });
          } else {
            reject(new Error(parsed.message ?? `Brevo error ${res.statusCode}: ${data}`));
          }
        } catch {
          reject(new Error(`Brevo response invalid: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
async function sendSms(opts) {
  const config = loadBrevoConfig();
  if (!config?.apiKey) throw new Error("Clé API Brevo non configurée");
  const body = JSON.stringify({
    sender: opts.sender ?? "SGSI",
    recipient: opts.to.replace(/\s/g, ""),
    content: opts.message,
    type: "transactional"
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.brevo.com",
      path: "/v3/transactionalSMS/sms",
      method: "POST",
      headers: {
        "api-key": config.apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ messageId: parsed.messageId ?? "sent" });
          } else {
            reject(new Error(parsed.message ?? `Brevo SMS error ${res.statusCode}`));
          }
        } catch {
          reject(new Error(`Response invalid: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
function buildTeacherWelcomeEmail(opts) {
  const { teacherName, username, password, schoolName, schoolPhone } = opts;
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
          ${schoolPhone ? `au <strong>${schoolPhone}</strong>` : ""}.
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
</html>`;
}
let _session = null;
let _jwtSecret = "change-me-in-production";
function setJwtSecret(secret) {
  _jwtSecret = secret || "change-me-in-production";
}
function setSession(session) {
  _session = session;
}
function clearSession() {
  _session = null;
}
function getSession() {
  return _session;
}
function verifyToken(token) {
  try {
    const payload = jwt.verify(token, _jwtSecret);
    return { userId: payload.userId, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}
function getAuthenticatedRole() {
  if (!_session) return null;
  const payload = verifyToken(_session.token);
  return payload?.role ?? null;
}
const loginAttempts = /* @__PURE__ */ new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1e3;
function checkBruteForce(username) {
  const key = username.toLowerCase().trim();
  const record = loginAttempts.get(key);
  if (record?.lockedUntil && Date.now() < record.lockedUntil) {
    const mins = Math.ceil((record.lockedUntil - Date.now()) / 6e4);
    throw Object.assign(new Error(`Compte bloque. Reessayez dans ${mins} minute(s).`), { code: "LOCKED" });
  }
}
function recordFailedAttempt(username) {
  const key = username.toLowerCase().trim();
  const record = loginAttempts.get(key) ?? { count: 0 };
  record.count++;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
    record.count = 0;
  }
  loginAttempts.set(key, record);
}
function clearAttempts(username) {
  loginAttempts.delete(username.toLowerCase().trim());
}
function registerAuthIpc(db, jwtSecret) {
  const auth = new AuthService(db, jwtSecret);
  setJwtSecret(jwtSecret);
  electron.ipcMain.handle("auth:login", async (_, username, password) => {
    try {
      checkBruteForce(username);
      const result = await auth.login(username, password);
      clearAttempts(username);
      setSession({ userId: result.user.id, username: result.user.username, role: result.user.role, token: result.token });
      return ok$c(result);
    } catch (e) {
      if (e.code !== "LOCKED") recordFailedAttempt(username);
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:verifyToken", async (_, token) => {
    try {
      return ok$c(auth.verifyToken(token));
    } catch {
      return fail$c("INVALID_TOKEN", "Token invalide");
    }
  });
  electron.ipcMain.handle("auth:requestReset", async (_, userId, requestedBy) => {
    try {
      return ok$c({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) });
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:changePassword", async (_, userId, newPassword) => {
    try {
      await auth.changePassword(userId, newPassword);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:checkPermission", async (_, userId, module2, action) => {
    try {
      return ok$c(await auth.checkPermission(userId, module2, action));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:logout", async () => {
    clearSession();
    return ok$c(null);
  });
  electron.ipcMain.handle("auth:findByUsername", async (_, username) => {
    try {
      const rows = await db.$queryRaw`
        SELECT id, firstName, lastName, role, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user) return fail$c("NOT_FOUND", "Aucun compte trouvé avec cet identifiant");
      if (!user.isActive) return fail$c("DISABLED", "Ce compte est désactivé. Contactez votre administrateur.");
      return ok$c({ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role });
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:sendResetEmail", async (_, username) => {
    try {
      const rows = await db.$queryRaw`
        SELECT id, firstName, lastName, email, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user) return fail$c("NOT_FOUND", "Aucun compte trouvé avec cet identifiant");
      if (!user.isActive) return fail$c("DISABLED", "Ce compte est désactivé. Contactez votre administrateur.");
      if (!user.email) return fail$c("NO_EMAIL", "Aucune adresse email configurée pour ce compte. Demandez à votre administrateur de renseigner votre email dans Paramètres → Utilisateurs.");
      const brevoConfig = loadBrevoConfig();
      if (!brevoConfig?.apiKey) {
        return fail$c("NO_EMAIL_CONFIG", "Le service email (Brevo) n'est pas encore configuré. Demandez à l'administrateur de le configurer dans Paramètres → Email (Brevo).");
      }
      const otp = Math.floor(1e5 + Math.random() * 9e5).toString();
      const hash = crypto.createHash("sha256").update(otp).digest("hex");
      const expiry = Date.now() + 15 * 60 * 1e3;
      const tokensFile = path.join(electron.app.getPath("userData"), "sgsi-reset-tokens.json");
      let tokens = {};
      try {
        if (fs.existsSync(tokensFile)) tokens = JSON.parse(fs.readFileSync(tokensFile, "utf-8"));
      } catch {
      }
      const now = Date.now();
      Object.keys(tokens).forEach((k) => {
        if (tokens[k].expiry < now) delete tokens[k];
      });
      tokens[user.id] = { hash, expiry };
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), "utf-8");
      const schoolName = brevoConfig.fromName || "SGSI SchoolManager";
      await sendEmail({
        to: user.email,
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
</html>`
      });
      const [local, domain] = user.email.split("@");
      const [domainName, ...tldParts] = domain.split(".");
      const maskedEmail = local.slice(0, 2) + "***@" + domainName.slice(0, 2) + "***." + tldParts.join(".");
      return ok$c({ maskedEmail, userId: user.id });
    } catch (e) {
      return fail$c(e.code ?? "SMTP_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:resetByOtp", async (_, userId, otp, newPassword) => {
    try {
      const tokensFile = path.join(electron.app.getPath("userData"), "sgsi-reset-tokens.json");
      if (!fs.existsSync(tokensFile)) return fail$c("INVALID_OTP", "Code invalide ou expiré");
      const tokens = JSON.parse(fs.readFileSync(tokensFile, "utf-8"));
      const token = tokens[userId];
      if (!token) return fail$c("INVALID_OTP", "Code invalide ou expiré");
      if (token.expiry < Date.now()) {
        delete tokens[userId];
        fs.writeFileSync(tokensFile, JSON.stringify(tokens), "utf-8");
        return fail$c("OTP_EXPIRED", "Code expiré. Faites une nouvelle demande.");
      }
      const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
      if (inputHash !== token.hash) return fail$c("INVALID_OTP", "Code incorrect");
      await auth.changePassword(userId, newPassword);
      delete tokens[userId];
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), "utf-8");
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:resetByRecovery", async (_, username, recoveryCode, newPassword) => {
    try {
      const recoveryFile = path.join(electron.app.getPath("userData"), "sgsi-recovery.json");
      if (!fs.existsSync(recoveryFile)) return fail$c("NO_RECOVERY", "Aucun code de récupération configuré.");
      const stored = JSON.parse(fs.readFileSync(recoveryFile, "utf-8"));
      const inputHash = crypto.createHash("sha256").update(recoveryCode.trim()).digest("hex");
      if (inputHash !== stored.hash) return fail$c("INVALID_CODE", "Code de récupération incorrect");
      const rows = await db.$queryRaw`
        SELECT id, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user || !user.isActive) return fail$c("NOT_FOUND", "Utilisateur introuvable");
      await auth.changePassword(user.id, newPassword);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
}
class StudentService {
  constructor(db) {
    this.db = db;
  }
  /** Best-effort audit log — does not throw if userId is not a valid FK */
  async audit(userId, action, entity, entityId) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
    } catch {
    }
  }
  async list(filters) {
    return this.db.student.findMany({
      where: {
        ...filters?.search && {
          OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { matricule: { contains: filters.search } }
          ]
        },
        ...filters?.classId && {
          enrollments: { some: { classId: filters.classId } }
        }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
  }
  async findById(id) {
    const student = await this.db.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: { class: true, academicYear: true },
          orderBy: { enrolledAt: "desc" }
        },
        parents: { include: { parent: true } },
        documents: true
      }
    });
    if (!student) {
      throw new ServiceError("STUDENT_NOT_FOUND", `Élève introuvable`);
    }
    return student;
  }
  async create(data, actorId) {
    const school = await this.db.school.findFirst();
    if (!school) {
      throw new ServiceError("SCHOOL_NOT_CONFIGURED", "École non configurée");
    }
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const count = await this.db.student.count();
    const matricule = generateMatricule({
      schoolSigle: school.sigle,
      firstName: data.firstName,
      lastName: data.lastName,
      year,
      sequence: count + 1
    });
    const student = await this.db.student.create({
      data: { ...data, matricule }
    });
    await this.audit(actorId, "CREATE", "student", student.id);
    return student;
  }
  async update(id, data, actorId) {
    await this.findById(id);
    const student = await this.db.student.update({ where: { id }, data });
    await this.audit(actorId, "UPDATE", "student", id);
    return student;
  }
  async delete(id, actorId) {
    await this.findById(id);
    await this.db.student.delete({ where: { id } });
    await this.audit(actorId, "DELETE", "student", id);
  }
  async enroll(studentId, classId, academicYearId, actorId) {
    await this.findById(studentId);
    const enrollment = await this.db.enrollment.create({
      data: { studentId, classId, academicYearId }
    });
    await this.audit(actorId, "ENROLL", "enrollment", enrollment.id);
    return enrollment;
  }
}
class ClassService {
  constructor(db) {
    this.db = db;
  }
  /** Best-effort audit log — does not throw if userId is not a valid FK */
  async audit(userId, action, entity, entityId) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
    } catch {
    }
  }
  async listCycles() {
    return this.db.cycle.findMany({
      orderBy: { order: "asc" },
      include: { levels: { orderBy: { order: "asc" } } }
    });
  }
  async createCycle(data, actorId) {
    const cycle = await this.db.cycle.create({ data });
    await this.audit(actorId, "CREATE", "cycle", cycle.id);
    return cycle;
  }
  async listLevels() {
    return this.db.level.findMany({
      orderBy: { order: "asc" },
      include: { cycle: true }
    });
  }
  async createLevel(data, actorId) {
    const level = await this.db.level.create({ data });
    await this.audit(actorId, "CREATE", "level", level.id);
    return level;
  }
  async listClasses(academicYearId) {
    return this.db.class.findMany({
      where: academicYearId ? { academicYearId } : void 0,
      include: {
        level: { include: { cycle: true } },
        _count: { select: { enrollments: true } }
      },
      orderBy: { name: "asc" }
    });
  }
  async createClass(data, actorId) {
    const cls = await this.db.class.create({ data });
    await this.audit(actorId, "CREATE", "class", cls.id);
    return cls;
  }
  async findClassById(id) {
    const cls = await this.db.class.findUnique({
      where: { id },
      include: {
        level: true,
        subjects: { include: { subject: true, teacher: { include: { user: true } } } },
        _count: { select: { enrollments: true } }
      }
    });
    if (!cls) {
      throw new ServiceError("CLASS_NOT_FOUND", `Classe introuvable`);
    }
    return cls;
  }
  async updateClass(id, data, actorId) {
    await this.findClassById(id);
    const cls = await this.db.class.update({ where: { id }, data });
    await this.audit(actorId, "UPDATE", "class", id);
    return cls;
  }
}
function registerStudentsIpc(db) {
  const students = new StudentService(db);
  const classes = new ClassService(db);
  electron.ipcMain.handle("students:list", async (_, filters) => {
    try {
      return ok$c(await students.list(filters));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:findById", async (_, id) => {
    try {
      return ok$c(await students.findById(id));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:create", async (_, data, actorId) => {
    try {
      return ok$c(await students.create(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:update", async (_, id, data, actorId) => {
    try {
      return ok$c(await students.update(id, data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:delete", async (_, id, actorId) => {
    try {
      await students.delete(id, actorId);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:enroll", async (_, studentId, classId, yearId, actorId) => {
    try {
      return ok$c(await students.enroll(studentId, classId, yearId, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:list", async (_, yearId) => {
    try {
      return ok$c(await classes.listClasses(yearId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:create", async (_, data, actorId) => {
    try {
      return ok$c(await classes.createClass(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:findById", async (_, id) => {
    try {
      return ok$c(await classes.findClassById(id));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cycles:list", async () => {
    try {
      return ok$c(await classes.listCycles());
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levels:list", async () => {
    try {
      return ok$c(await classes.listLevels());
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levels:create", async (_, data, actorId) => {
    try {
      return ok$c(await classes.createLevel(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
}
class GradeService {
  constructor(db) {
    this.db = db;
  }
  async listByEnrollment(enrollmentId, period) {
    return this.db.grade.findMany({
      where: { enrollmentId, period },
      include: { subject: true },
      orderBy: { enteredAt: "asc" }
    });
  }
  async save(data, actorId) {
    const maxValue = data.maxValue ?? 20;
    if (data.value < 0 || data.value > maxValue) {
      throw new ServiceError(
        "INVALID_GRADE",
        `Note invalide : ${data.value} (doit être entre 0 et ${maxValue})`
      );
    }
    const grade = await this.db.grade.create({
      data: { ...data, maxValue }
    });
    await this.tryAudit(actorId, "GRADE_SAVED", "grade", grade.id);
    return grade;
  }
  async upsertGrade(data, actorId) {
    const maxValue = data.maxValue ?? 20;
    if (data.value < 0 || data.value > maxValue) {
      throw new ServiceError(
        "INVALID_GRADE",
        `Note invalide : ${data.value} (doit être entre 0 et ${maxValue})`
      );
    }
    const existing = await this.db.grade.findFirst({
      where: {
        enrollmentId: data.enrollmentId,
        subjectId: data.subjectId,
        period: data.period,
        evalType: data.evalType
      }
    });
    let grade;
    if (existing) {
      grade = await this.db.grade.update({
        where: { id: existing.id },
        data: { value: data.value }
      });
    } else {
      grade = await this.db.grade.create({
        data: { ...data, maxValue }
      });
    }
    await this.tryAudit(actorId, "GRADE_UPSERTED", "grade", grade.id);
    return grade;
  }
  async listByClassSubjectPeriodEvalType(classId, subjectId, period, evalType) {
    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: "ACTIVE" },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
        grades: {
          where: { subjectId, period, evalType },
          orderBy: { enteredAt: "asc" },
          take: 1
        }
      },
      orderBy: { student: { lastName: "asc" } }
    });
    return enrollments.map((e) => ({
      enrollmentId: e.id,
      studentName: `${e.student.lastName} ${e.student.firstName}`,
      matricule: e.student.matricule,
      grade: e.grades[0] ?? null
    }));
  }
  async computeAverages(enrollmentId, period, weights = DEFAULT_EVAL_WEIGHTS) {
    const enrollment = await this.db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        class: {
          include: {
            subjects: { include: { subject: true } }
          }
        }
      }
    });
    if (!enrollment) {
      throw new ServiceError("ENROLLMENT_NOT_FOUND", "Inscription introuvable");
    }
    const school = await this.db.school.findFirst();
    const eliminatoryThreshold = school?.eliminatoryThreshold ?? 5;
    const grades = await this.listByEnrollment(enrollmentId, period);
    const subjectAverages = enrollment.class.subjects.map((cs) => {
      const subjectGrades = grades.filter((g) => g.subjectId === cs.subjectId);
      const average = calcSubjectAverage(subjectGrades, weights);
      return {
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        coefficient: cs.coefficient,
        average,
        grades: subjectGrades
      };
    });
    const subjectsWithGrades = subjectAverages.filter((s) => s.grades.length > 0);
    const generalAverage = calcGeneralAverage(subjectsWithGrades);
    const isEliminated = subjectAverages.some(
      (s) => s.grades.length > 0 && s.average < eliminatoryThreshold
    );
    return { subjectAverages, generalAverage, isEliminated };
  }
  async computeClassRankings(classId, period) {
    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: "ACTIVE" },
      include: { student: true }
    });
    const averages = await Promise.all(
      enrollments.map(async (e) => {
        const { generalAverage, isEliminated } = await this.computeAverages(e.id, period);
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`,
          generalAverage,
          isEliminated
        };
      })
    );
    return calcRankings(averages);
  }
  async lockGrades(enrollmentId, period, actorId) {
    await this.db.grade.updateMany({
      where: { enrollmentId, period },
      data: { isLocked: true }
    });
    await this.tryAudit(actorId, "GRADES_LOCKED", "enrollment", enrollmentId, `period:${period}`);
  }
  async statsBySubject(classId, period) {
    const classSubjects = await this.db.classSubject.findMany({
      where: { classId },
      include: { subject: true }
    });
    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: "ACTIVE" },
      include: { grades: { where: { period } } }
    });
    return classSubjects.map((cs) => {
      const subjectGrades = [];
      for (const enrollment of enrollments) {
        const grades = enrollment.grades.filter((g) => g.subjectId === cs.subjectId);
        if (grades.length > 0) {
          const totalWeight = grades.reduce((s, g) => s + g.weight, 0);
          const avg = totalWeight > 0 ? grades.reduce((s, g) => s + g.value * g.weight, 0) / totalWeight : 0;
          subjectGrades.push(avg);
        }
      }
      const classAverage = subjectGrades.length > 0 ? Math.round(subjectGrades.reduce((s, v) => s + v, 0) / subjectGrades.length * 100) / 100 : null;
      const minAvg = subjectGrades.length > 0 ? Math.min(...subjectGrades) : null;
      const maxAvg = subjectGrades.length > 0 ? Math.max(...subjectGrades) : null;
      const passing = subjectGrades.filter((v) => v >= 10).length;
      return {
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
        coefficient: cs.coefficient,
        classAverage,
        minAvg: minAvg !== null ? Math.round(minAvg * 100) / 100 : null,
        maxAvg: maxAvg !== null ? Math.round(maxAvg * 100) / 100 : null,
        passRate: subjectGrades.length > 0 ? Math.round(passing / subjectGrades.length * 100) : null,
        count: subjectGrades.length
      };
    });
  }
  async tryAudit(userId, action, entity, entityId, details) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId, details } });
    } catch {
    }
  }
}
const CONFIG_FILE = path.join(electron.app.getPath("userData"), "appreciation-config.json");
const DEFAULT_RANGES = [
  { min: 18, max: 20, label: "Excellent", color: "#059669" },
  { min: 16, max: 17.99, label: "Très Bien", color: "#10B981" },
  { min: 14, max: 15.99, label: "Bien", color: "#3B82F6" },
  { min: 12, max: 13.99, label: "Assez Bien", color: "#6366F1" },
  { min: 10, max: 11.99, label: "Passable", color: "#F59E0B" },
  { min: 0, max: 9.99, label: "Insuffisant", color: "#DC2626" }
];
function loadRanges() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
  }
  return DEFAULT_RANGES;
}
function saveRanges(ranges) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(ranges, null, 2), "utf-8");
}
function getConfiguredAppreciation(average) {
  const ranges = loadRanges();
  const match = ranges.find((r) => average >= r.min && average <= r.max);
  return match?.label ?? "Insuffisant";
}
function registerAppreciationIpc() {
  electron.ipcMain.handle("appreciation:getRanges", () => {
    try {
      return { success: true, data: loadRanges() };
    } catch (e) {
      return { success: false, error: { message: e.message } };
    }
  });
  electron.ipcMain.handle("appreciation:saveRanges", (_, ranges) => {
    try {
      if (!Array.isArray(ranges) || ranges.length === 0) {
        return { success: false, error: { message: "Tableau de plages invalide" } };
      }
      saveRanges(ranges);
      return { success: true, data: ranges };
    } catch (e) {
      return { success: false, error: { message: e.message } };
    }
  });
  electron.ipcMain.handle("appreciation:reset", () => {
    try {
      saveRanges(DEFAULT_RANGES);
      return { success: true, data: DEFAULT_RANGES };
    } catch (e) {
      return { success: false, error: { message: e.message } };
    }
  });
}
const getAppreciation = (avg) => getConfiguredAppreciation(avg);
class BulletinService {
  constructor(db) {
    this.db = db;
    this.gradeService = new GradeService(db);
  }
  gradeService;
  async generate(enrollmentId, period, actorId) {
    const enrollment = await this.db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { class: true }
    });
    if (!enrollment) {
      throw new ServiceError("ENROLLMENT_NOT_FOUND", "Inscription introuvable");
    }
    const { generalAverage, subjectAverages, isEliminated } = await this.gradeService.computeAverages(enrollmentId, period);
    const rankings = await this.gradeService.computeClassRankings(enrollment.classId, period);
    const myRank = rankings.find((r) => r.enrollmentId === enrollmentId);
    const school = await this.db.school.findFirst();
    const passingAverage = school?.passingAverage ?? 10;
    const decision = isEliminated ? "Redouble" : generalAverage >= passingAverage ? "Admis(e)" : "Passage conditionnel";
    const bulletinId = `bulletin-${enrollmentId}-${period}`;
    const bulletin = await this.db.bulletin.upsert({
      where: { id: bulletinId },
      update: {
        generalAverage,
        rank: myRank?.rank ?? 0,
        totalStudents: rankings.length,
        appreciation: getAppreciation(generalAverage),
        decision
      },
      create: {
        id: bulletinId,
        enrollmentId,
        period,
        generalAverage,
        rank: myRank?.rank ?? 0,
        totalStudents: rankings.length,
        appreciation: getAppreciation(generalAverage),
        decision
      }
    });
    await this.tryAudit(actorId, "BULLETIN_GENERATED", "bulletin", bulletin.id);
    return { bulletin, subjectAverages, rankings };
  }
  async validate(bulletinId, directorId) {
    const bulletin = await this.db.bulletin.findUnique({ where: { id: bulletinId } });
    if (!bulletin) {
      throw new ServiceError("BULLETIN_NOT_FOUND", "Bulletin introuvable");
    }
    if (bulletin.isValidated) {
      throw new ServiceError("ALREADY_VALIDATED", "Ce bulletin est déjà validé");
    }
    const updated = await this.db.bulletin.update({
      where: { id: bulletinId },
      data: { isValidated: true, validatedAt: /* @__PURE__ */ new Date() }
    });
    await this.tryAudit(directorId, "BULLETIN_VALIDATED", "bulletin", bulletinId);
    return updated;
  }
  async findByEnrollment(enrollmentId) {
    return this.db.bulletin.findMany({
      where: { enrollmentId },
      orderBy: { period: "asc" }
    });
  }
  async findById(id) {
    const bulletin = await this.db.bulletin.findUnique({ where: { id } });
    if (!bulletin) {
      throw new ServiceError("BULLETIN_NOT_FOUND", "Bulletin introuvable");
    }
    return bulletin;
  }
  async tryAudit(userId, action, entity, entityId) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
    } catch {
    }
  }
}
function parseGrade(raw, maxValue = 20) {
  if (raw === null || raw === void 0 || raw === "") return null;
  const n = parseFloat(String(raw).replace(",", "."));
  if (isNaN(n) || n < 0 || n > maxValue) return null;
  return n;
}
function parseGradeXlsx(data) {
  if (data.length < 2) return [];
  const headerRow = data[0].map((h) => String(h ?? "").trim().toLowerCase());
  const find = (...keys) => {
    for (const k of keys) {
      const i = headerRow.findIndex((h) => h === k || h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iMat = find("matricule", "id", "n°");
  const iNom = find("nom", "lastname", "last_name");
  const iPren = find("prénom", "prenom", "firstname", "first_name");
  const iDs1 = find("ds1", "devoir1", "devoir 1", "d1", "interro1");
  const iDs2 = find("ds2", "devoir2", "devoir 2", "d2", "interro2");
  const iComp = find("composition", "compo", "examen", "exam", "final");
  const g = (row, idx, fallback) => idx >= 0 ? row[idx] : row[fallback];
  return data.slice(1).map((row) => ({
    matricule: String(g(row, iMat, 0) ?? "").trim().toUpperCase(),
    lastName: String(g(row, iNom, 1) ?? "").trim().toUpperCase(),
    firstName: String(g(row, iPren, 2) ?? "").trim(),
    ds1: parseGrade(g(row, iDs1, 3)),
    ds2: parseGrade(g(row, iDs2, 4)),
    composition: parseGrade(g(row, iComp, 5))
  })).filter((r) => r.matricule || r.lastName);
}
function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map((line) => {
    const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = cols[i] ?? "";
    });
    const noteRaw = obj["note"] ?? obj["grade"] ?? obj["valeur"] ?? "";
    const value = noteRaw ? parseFloat(noteRaw.replace(",", ".")) : null;
    return {
      lastName: (obj["nom"] ?? "").toUpperCase(),
      firstName: obj["prenom"] ?? obj["prénom"] ?? "",
      matricule: obj["matricule"] ?? "",
      value: value !== null && !isNaN(value) ? value : null
    };
  });
}
function parseXlsxData(data) {
  if (data.length < 2) return [];
  const header = data[0].map((h) => String(h ?? "").trim().toLowerCase());
  const iMat = header.findIndex((h) => h === "matricule" || h === "id");
  const iNom = header.findIndex((h) => h === "nom");
  const iPren = header.findIndex((h) => h === "prenom" || h === "prénom");
  const iNote = header.findIndex((h) => h === "note" || h === "grade" || h === "valeur");
  return data.slice(1).map((row) => {
    const noteRaw = iNote >= 0 ? row[iNote] : row[3];
    const value = noteRaw != null ? parseFloat(String(noteRaw).replace(",", ".")) : null;
    return {
      lastName: String(iNom >= 0 ? row[iNom] : row[0] ?? "").toUpperCase(),
      firstName: String(iPren >= 0 ? row[iPren] : row[1] ?? ""),
      matricule: String(iMat >= 0 ? row[iMat] : row[2] ?? "").toUpperCase(),
      value: value !== null && !isNaN(value) ? value : null
    };
  }).filter((r) => r.matricule || r.lastName);
}
function registerGradesIpc(db) {
  const grades = new GradeService(db);
  const bulletins = new BulletinService(db);
  electron.ipcMain.handle("grades:list", async (_, enrollmentId, period) => {
    try {
      return ok$c(await grades.listByEnrollment(enrollmentId, period));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:save", async (_, data, actorId) => {
    try {
      return ok$c(await grades.save(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:upsert", async (_, data, actorId) => {
    try {
      return ok$c(await grades.upsertGrade(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:listByClass", async (_, classId, subjectId, period, evalType) => {
    try {
      return ok$c(await grades.listByClassSubjectPeriodEvalType(classId, subjectId, period, evalType));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:averages", async (_, enrollmentId, period) => {
    try {
      return ok$c(await grades.computeAverages(enrollmentId, period));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:ranking", async (_, classId, period) => {
    try {
      return ok$c(await grades.computeClassRankings(classId, period));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:lock", async (_, enrollmentId, period, actorId) => {
    try {
      await grades.lockGrades(enrollmentId, period, actorId);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:statsBySubject", async (_, classId, period) => {
    try {
      return ok$c(await grades.statsBySubject(classId, period));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:downloadTemplate", async () => {
    try {
      const { canceled, filePath } = await electron.dialog.showSaveDialog({
        title: "Enregistrer le modèle d'import des notes",
        defaultPath: "modele-import-notes.xlsx",
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (canceled || !filePath) return ok$c(null);
      const ExcelJS2 = require("exceljs");
      const wb = new ExcelJS2.Workbook();
      wb.creator = "SGSI SchoolManager Pro";
      const ws = wb.addWorksheet("Notes");
      ws.columns = [
        { header: "Matricule *", key: "matricule", width: 22 },
        { header: "Nom", key: "lastName", width: 18 },
        { header: "Prénom", key: "firstName", width: 18 },
        { header: "DS1 (0-20)", key: "ds1", width: 12 },
        { header: "DS2 (0-20)", key: "ds2", width: 12 },
        { header: "Composition (0-20)", key: "composition", width: 18 }
      ];
      const hRow = ws.getRow(1);
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6366F1" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      hRow.height = 24;
      ws.addRow({ matricule: "DEMOAB-2025-0001", lastName: "BAH", firstName: "Amadou", ds1: 15, ds2: 12, composition: 14 });
      const ex = ws.getRow(2);
      ex.eachCell((cell) => {
        cell.font = { italic: true, color: { argb: "FF6B7280" } };
      });
      await wb.xlsx.writeFile(filePath);
      return ok$c({ filePath });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:importExcel", async (_, classId, subjectId, period, actorId) => {
    try {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog({
        title: "Importer les notes depuis Excel",
        filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
        properties: ["openFile"]
      });
      if (canceled || filePaths.length === 0) return ok$c(null);
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePaths[0]);
      const data = XLSX.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { header: 1, defval: "" }
      );
      const rows = parseGradeXlsx(data);
      if (rows.length === 0) return fail$c("EMPTY", "Aucune ligne trouvée dans le fichier");
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: "ACTIVE" },
        include: { student: { select: { matricule: true, firstName: true, lastName: true } } }
      });
      let imported = 0, notFound = 0, errors = 0;
      const report = [];
      const EVAL_MAP = [
        { key: "ds1", type: "DS1" },
        { key: "ds2", type: "DS2" },
        { key: "composition", type: "COMPOSITION" }
      ];
      for (const row of rows) {
        const enrollment = enrollments.find(
          (e) => e.student.matricule === row.matricule || e.student.lastName.toUpperCase() === row.lastName && e.student.firstName.toLowerCase() === row.firstName.toLowerCase()
        );
        if (!enrollment) {
          notFound++;
          report.push({ matricule: row.matricule || "?", name: `${row.lastName} ${row.firstName}`, status: "Élève introuvable" });
          continue;
        }
        try {
          for (const ev of EVAL_MAP) {
            const score = row[ev.key];
            if (score !== null) {
              await db.grade.upsert({
                where: {
                  enrollmentId_subjectId_period_type: {
                    enrollmentId: enrollment.id,
                    subjectId,
                    period,
                    type: ev.type
                  }
                },
                update: { score },
                create: { enrollmentId: enrollment.id, subjectId, period, type: ev.type, score }
              });
            }
          }
          imported++;
          report.push({
            matricule: enrollment.student.matricule,
            name: `${enrollment.student.lastName} ${enrollment.student.firstName}`,
            status: "Importé",
            ds1: row.ds1 ?? void 0,
            ds2: row.ds2 ?? void 0,
            composition: row.composition ?? void 0
          });
        } catch {
          errors++;
          report.push({ matricule: enrollment.student.matricule, name: `${enrollment.student.lastName}`, status: "Erreur DB" });
        }
      }
      return ok$c({ imported, notFound, errors, total: rows.length, report });
    } catch (e) {
      return fail$c("IMPORT_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:parseCsv", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: "Importer les notes depuis un fichier",
        filters: [
          { name: "Fichiers notes (CSV, Excel)", extensions: ["csv", "txt", "xlsx"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) return ok$c(null);
      const filePath = result.filePaths[0];
      if (filePath.endsWith(".xlsx") || filePath.endsWith(".xls")) {
        const XLSX = require("xlsx");
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
        const rows = parseXlsxData(data);
        return ok$c(rows);
      } else {
        const content = fs.readFileSync(filePath, "utf-8");
        const rows = parseCsv(content);
        return ok$c(rows);
      }
    } catch (e) {
      return fail$c("PARSE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:generate", async (_, enrollmentId, period, actorId) => {
    try {
      return ok$c(await bulletins.generate(enrollmentId, period, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:generateForClass", async (_, classId, period, actorId) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: "ACTIVE" },
        select: { id: true }
      });
      const results = await Promise.allSettled(
        enrollments.map((e) => bulletins.generate(e.id, period, actorId))
      );
      const success = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      return ok$c({ success, failed, total: enrollments.length });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:validate", async (_, bulletinId, directorId) => {
    try {
      return ok$c(await bulletins.validate(bulletinId, directorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:list", async (_, enrollmentId) => {
    try {
      return ok$c(await bulletins.findByEnrollment(enrollmentId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:countUnvalidated", async () => {
    try {
      const count = await db.bulletin.count({ where: { isValidated: false } });
      return ok$c(count);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
}
class PaymentService {
  constructor(db) {
    this.db = db;
  }
  async listByEnrollment(enrollmentId) {
    return this.db.payment.findMany({
      where: { enrollmentId },
      include: { feeType: true },
      orderBy: { paidAt: "desc" }
    });
  }
  async record(data, cashierId) {
    if (data.amount <= 0) {
      throw new ServiceError("INVALID_AMOUNT", "Le montant doit être supérieur à 0");
    }
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth } } });
    const receiptNo = formatReceiptNo(now, count + 1);
    const payment = await this.db.payment.create({
      data: { ...data, receiptNo, cashierId, paidAt: now },
      include: { feeType: true }
    });
    await this.tryAudit(cashierId, "PAYMENT_RECORDED", "payment", payment.id, `amount:${data.amount}`);
    return payment;
  }
  async listUnpaid(classId) {
    const enrollments = await this.db.enrollment.findMany({
      where: {
        status: "ACTIVE",
        ...classId ? { classId } : {}
      },
      include: {
        student: true,
        class: { include: { level: true } },
        payments: { include: { feeType: true } }
      }
    });
    const result = await Promise.all(
      enrollments.map(async (e) => {
        const feeTypes = await this.db.feeType.findMany({
          where: { OR: [{ levelId: e.class.levelId }, { levelId: null }], isRequired: true }
        });
        const totalDue = feeTypes.reduce((sum, f) => sum + f.amount, 0);
        const totalPaid = e.payments.reduce((sum, p) => sum + p.amount, 0);
        return {
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`,
          matricule: e.student.matricule,
          className: e.class.name,
          totalDue,
          totalPaid,
          balance: totalDue - totalPaid
        };
      })
    );
    return result.filter((r) => r.balance > 0);
  }
  async getById(id) {
    const payment = await this.db.payment.findUnique({
      where: { id },
      include: {
        feeType: true,
        enrollment: {
          include: {
            student: true,
            class: { include: { level: true } },
            academicYear: true
          }
        }
      }
    });
    if (!payment) throw new ServiceError("PAYMENT_NOT_FOUND", `Paiement ${id} introuvable`);
    return payment;
  }
  async listFeeTypes(levelId) {
    return this.db.feeType.findMany({
      where: levelId ? { OR: [{ levelId }, { levelId: null }] } : void 0,
      include: { level: true },
      orderBy: { name: "asc" }
    });
  }
  async createFeeType(data, actorId) {
    if (data.amount < 0) {
      throw new ServiceError("INVALID_AMOUNT", "Le montant ne peut pas être négatif");
    }
    const feeType = await this.db.feeType.create({ data });
    await this.tryAudit(actorId, "CREATE", "feeType", feeType.id);
    return feeType;
  }
  async updateFeeType(id, data, actorId) {
    const updated = await this.db.feeType.update({ where: { id }, data });
    await this.tryAudit(actorId, "UPDATE", "feeType", id);
    return updated;
  }
  async deleteFeeType(id, actorId) {
    const count = await this.db.payment.count({ where: { feeTypeId: id } });
    if (count > 0) {
      throw new ServiceError(
        "FEE_TYPE_IN_USE",
        `Ce type de frais est utilisé dans ${count} paiement(s). Suppression impossible.`
      );
    }
    await this.db.feeType.delete({ where: { id } });
    await this.tryAudit(actorId, "DELETE", "feeType", id);
  }
  /* ── REMISES ET EXONÉRATIONS ────────────────────────────────────── */
  /**
   * Record a discount/exemption for a student enrollment.
   * Stored as a special Payment with method='DISCOUNT' and a motif in `note`.
   * The amount is DEDUCTED from the student's balance just like a real payment.
   */
  async recordDiscount(data, cashierId) {
    if (data.amount <= 0) throw new ServiceError("INVALID_AMOUNT", "Le montant de la remise doit être > 0");
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth } } });
    const receiptNo = `REM-${formatReceiptNo(now, count + 1)}`;
    const discount = await this.db.payment.create({
      data: {
        enrollmentId: data.enrollmentId,
        feeTypeId: data.feeTypeId,
        amount: data.amount,
        method: "DISCOUNT",
        receiptNo,
        cashierId,
        note: data.motif,
        paidAt: now
      },
      include: { feeType: true }
    });
    await this.tryAudit(cashierId, "DISCOUNT", "payment", discount.id, `amount:${data.amount} motif:${data.motif}`);
    return discount;
  }
  /** List discounts for an enrollment. */
  async listDiscounts(enrollmentId) {
    return this.db.payment.findMany({
      where: { enrollmentId, method: "DISCOUNT" },
      include: { feeType: true },
      orderBy: { paidAt: "desc" }
    });
  }
  /* ── PRÉVISIONS DE RECETTES ─────────────────────────────────────── */
  /**
   * Calculate expected vs actual revenue for the current year.
   * Expected = sum(required feeTypes × active enrollments)
   * Actual   = sum(all real payments — excludes PLAN and DISCOUNT containers)
   */
  async forecast(year) {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59);
    const enrollments = await this.db.enrollment.findMany({
      where: { status: "ACTIVE" },
      include: {
        class: { include: { level: true } },
        payments: {
          where: { paidAt: { gte: start, lte: end }, method: { not: "PLAN" } }
        }
      }
    });
    const allFeeTypes = await this.db.feeType.findMany({
      where: { isRequired: true }
    });
    let totalExpected = 0;
    let totalPaid = 0;
    const byFeeType = {};
    for (const enrollment of enrollments) {
      const levelId = enrollment.class.levelId;
      const feesForLevel = allFeeTypes.filter(
        (f) => f.levelId === null || f.levelId === levelId
      );
      for (const fee of feesForLevel) {
        totalExpected += fee.amount;
        if (!byFeeType[fee.id]) {
          byFeeType[fee.id] = { name: fee.name, expected: 0, paid: 0 };
        }
        byFeeType[fee.id].expected += fee.amount;
      }
      const paidForEnrollment = enrollment.payments.reduce((s, p) => s + p.amount, 0);
      totalPaid += paidForEnrollment;
    }
    const actualByFeeType = await this.db.payment.groupBy({
      by: ["feeTypeId"],
      where: {
        paidAt: { gte: start, lte: end },
        method: { notIn: ["PLAN"] }
      },
      _sum: { amount: true }
    });
    for (const row of actualByFeeType) {
      if (byFeeType[row.feeTypeId]) {
        byFeeType[row.feeTypeId].paid = row._sum.amount ?? 0;
      }
    }
    const remaining = totalExpected - totalPaid;
    const rate = totalExpected > 0 ? Math.round(totalPaid / totalExpected * 100) : 0;
    return {
      year,
      totalExpected,
      totalPaid,
      remaining,
      rate,
      activeEnrollments: enrollments.length,
      byFeeType: Object.values(byFeeType).sort((a, b) => b.expected - a.expected)
    };
  }
  /* ── PAYMENT PLANS (paiement partiel / échelonné) ──────────────── */
  /**
   * Create a payment plan: parent Payment (amount=0, method='PLAN') + installments.
   * The parent acts as a container — actual payments are created when installments are paid.
   */
  async createPlan(data, cashierId) {
    if (data.installments.length < 2) {
      throw new ServiceError("INVALID_PLAN", "Un plan doit avoir au minimum 2 tranches");
    }
    const sumInstallments = data.installments.reduce((s, i) => s + i.amount, 0);
    if (Math.abs(sumInstallments - data.totalAmount) > 0.01) {
      throw new ServiceError("INVALID_PLAN", "La somme des tranches doit être égale au montant total");
    }
    const plan = await this.db.payment.create({
      data: {
        enrollmentId: data.enrollmentId,
        feeTypeId: data.feeTypeId,
        amount: 0,
        method: "PLAN",
        receiptNo: `PLAN-${Date.now()}`,
        cashierId,
        note: `Plan ${data.installments.length} tranches · Total ${data.totalAmount}`
      }
    });
    await this.db.paymentInstallment.createMany({
      data: data.installments.map((i) => ({
        paymentId: plan.id,
        dueDate: i.dueDate,
        amount: i.amount
      }))
    });
    await this.tryAudit(cashierId, "CREATE_PLAN", "payment", plan.id, `total:${data.totalAmount}`);
    return this.getPlanById(plan.id);
  }
  /**
   * List all payment plans (method='PLAN') for an enrollment, with their installments.
   */
  async listPlans(enrollmentId) {
    return this.db.payment.findMany({
      where: { enrollmentId, method: "PLAN" },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: "asc" } }
      },
      orderBy: { paidAt: "desc" }
    });
  }
  /** List ALL plans (all enrollments) with student info — for the management page. */
  async listAllPlans() {
    return this.db.payment.findMany({
      where: { method: "PLAN" },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: "asc" } },
        enrollment: {
          include: {
            student: true,
            class: true
          }
        }
      },
      orderBy: { paidAt: "desc" }
    });
  }
  async getPlanById(id) {
    return this.db.payment.findUnique({
      where: { id },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: "asc" } },
        enrollment: {
          include: { student: true, class: true }
        }
      }
    });
  }
  /**
   * Pay a single installment:
   * 1. Mark the installment as paid
   * 2. Create an actual Payment record (with receipt) for the tranche amount
   */
  async payInstallment(installmentId, method, cashierId) {
    const installment = await this.db.paymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: { enrollment: { include: { class: true } } }
        }
      }
    });
    if (!installment) throw new ServiceError("NOT_FOUND", "Tranche introuvable");
    if (installment.isPaid) throw new ServiceError("ALREADY_PAID", "Cette tranche a déjà été payée");
    const plan = installment.payment;
    await this.db.paymentInstallment.update({
      where: { id: installmentId },
      data: { isPaid: true, paidAt: /* @__PURE__ */ new Date() }
    });
    const now = /* @__PURE__ */ new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const count = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth }, method: { not: "PLAN" } } });
    const receiptNo = formatReceiptNo(now, count + 1);
    const payment = await this.db.payment.create({
      data: {
        enrollmentId: plan.enrollmentId,
        feeTypeId: plan.feeTypeId,
        amount: installment.amount,
        method,
        receiptNo,
        cashierId,
        paidAt: now,
        note: `Tranche plan — ${formatReceiptNo(new Date(plan.paidAt), 1)}`
      },
      include: { feeType: true }
    });
    await this.tryAudit(cashierId, "PAY_INSTALLMENT", "paymentInstallment", installmentId, `amount:${installment.amount}`);
    return { installment: { ...installment, isPaid: true, paidAt: now }, payment };
  }
  /** Delete an unpaid plan (cannot delete if any installment has been paid). */
  async deletePlan(planId, actorId) {
    const plan = await this.db.payment.findUnique({
      where: { id: planId },
      include: { installments: true }
    });
    if (!plan || plan.method !== "PLAN") throw new ServiceError("NOT_FOUND", "Plan introuvable");
    const anyPaid = plan.installments.some((i) => i.isPaid);
    if (anyPaid) throw new ServiceError("PLAN_HAS_PAYMENTS", "Ce plan a des tranches déjà payées. Suppression impossible.");
    await this.db.paymentInstallment.deleteMany({ where: { paymentId: planId } });
    await this.db.payment.delete({ where: { id: planId } });
    await this.tryAudit(actorId, "DELETE_PLAN", "payment", planId);
  }
  async tryAudit(userId, action, entity, entityId, details) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId, details } });
    } catch {
    }
  }
}
function registerPaymentsIpc(db) {
  const service = new PaymentService(db);
  electron.ipcMain.handle("payments:record", async (_, data, cashierId) => {
    try {
      return ok$c(await service.record(data, cashierId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:list", async (_, enrollmentId) => {
    try {
      return ok$c(await service.listByEnrollment(enrollmentId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:unpaid", async (_, classId) => {
    try {
      return ok$c(await service.listUnpaid(classId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:list", async (_, levelId) => {
    try {
      return ok$c(await service.listFeeTypes(levelId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:create", async (_, data, actorId) => {
    try {
      return ok$c(await service.createFeeType(data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:update", async (_, id, data, actorId) => {
    try {
      return ok$c(await service.updateFeeType(id, data, actorId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:delete", async (_, id, actorId) => {
    try {
      await service.deleteFeeType(id, actorId);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:receipt", async (_, id) => {
    try {
      return ok$c(await service.getById(id));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:report", async (_, year) => {
    try {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      const payments = await db.payment.findMany({
        where: { paidAt: { gte: start, lte: end } },
        include: { feeType: true },
        orderBy: { paidAt: "asc" }
      });
      const byMonth = {};
      for (let m = 1; m <= 12; m++) byMonth[m] = { total: 0, count: 0 };
      for (const p of payments) {
        const m = new Date(p.paidAt).getMonth() + 1;
        byMonth[m].total += p.amount;
        byMonth[m].count += 1;
      }
      const totalYear = payments.reduce((s, p) => s + p.amount, 0);
      return ok$c({ byMonth, totalYear, count: payments.length });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:recordDiscount", async (_, data, cashierId) => {
    try {
      return ok$c(await service.recordDiscount(data, cashierId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:listDiscounts", async (_, enrollmentId) => {
    try {
      return ok$c(await service.listDiscounts(enrollmentId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:forecast", async (_, year) => {
    try {
      return ok$c(await service.forecast(year));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:createPlan", async (_, data, cashierId) => {
    try {
      return ok$c(await service.createPlan(data, cashierId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:listPlans", async (_, enrollmentId) => {
    try {
      return ok$c(await service.listPlans(enrollmentId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:listAllPlans", async () => {
    try {
      return ok$c(await service.listAllPlans());
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:payInstallment", async (_, installmentId, method, cashierId) => {
    try {
      return ok$c(await service.payInstallment(installmentId, method, cashierId));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:deletePlan", async (_, planId, actorId) => {
    try {
      await service.deletePlan(planId, actorId);
      return ok$c(null);
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:reportByFeeType", async (_, year) => {
    try {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      const feeTypes = await db.feeType.findMany({ include: { payments: { where: { paidAt: { gte: start, lte: end } } } } });
      return ok$c(feeTypes.map((ft) => ({
        id: ft.id,
        name: ft.name,
        total: ft.payments.reduce((s, p) => s + p.amount, 0),
        count: ft.payments.length
      })).filter((ft) => ft.count > 0));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
class BackupService {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
    this.backupDir = path.join(os.homedir(), "Documents", "SGSI", "backups");
  }
  backupDir;
  ensureBackupDir() {
    fs.mkdirSync(this.backupDir, { recursive: true });
  }
  timestamp() {
    return (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }
  async createDbBackup() {
    this.ensureBackupDir();
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`);
    }
    const destPath = path.join(this.backupDir, `sgsi-${this.timestamp()}.db`);
    fs.copyFileSync(this.dbPath, destPath);
    return destPath;
  }
  async createZipBackup(photosDir) {
    this.ensureBackupDir();
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`);
    }
    const destPath = path.join(this.backupDir, `sgsi-${this.timestamp()}.zip`);
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve(destPath));
      archive.on("error", reject);
      archive.pipe(output);
      archive.file(this.dbPath, { name: "sgsi.db" });
      if (photosDir && fs.existsSync(photosDir)) {
        archive.directory(photosDir, "photos");
      }
      archive.finalize();
    });
  }
  async restore(backupPath) {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }
    await this.db.$disconnect();
    fs.copyFileSync(backupPath, this.dbPath);
  }
  listBackups() {
    this.ensureBackupDir();
    return fs.readdirSync(this.backupDir).filter((f) => f.startsWith("sgsi-") && (f.endsWith(".db") || f.endsWith(".zip"))).map((f) => {
      const fullPath = path.join(this.backupDir, f);
      const stat = fs.statSync(fullPath);
      return { name: f, path: fullPath, size: stat.size, createdAt: stat.birthtime };
    }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
function registerBackupIpc(db, dbPath) {
  const service = new BackupService(db, dbPath);
  electron.ipcMain.handle("backup:create", async (_, format) => {
    try {
      const filePath = format === "zip" ? await service.createZipBackup() : await service.createDbBackup();
      return ok$c({ filePath });
    } catch (e) {
      return fail$c("BACKUP_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("backup:restore", async (_, backupPath) => {
    try {
      await service.restore(backupPath);
      return ok$c(null);
    } catch (e) {
      return fail$c("RESTORE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("backup:list", async () => {
    try {
      return ok$c(service.listBackups());
    } catch (e) {
      return fail$c("BACKUP_LIST_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("backup:restoreDialog", async () => {
    try {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog({
        title: "Choisir un fichier de sauvegarde",
        filters: [{ name: "Sauvegardes SGSI", extensions: ["db", "zip"] }],
        properties: ["openFile"]
      });
      if (canceled || !filePaths.length) return ok$c(false);
      await service.restore(filePaths[0]);
      return ok$c(true);
    } catch (e) {
      return fail$c("RESTORE_ERROR", e.message);
    }
  });
}
const ROLE_HIERARCHY = {
  TEACHER: 1,
  SECRETARY: 2,
  ACCOUNTANT: 2,
  DIRECTOR: 3,
  SUPER_ADMIN: 4
};
function withRole(minRole, handler) {
  return async (event, ...args) => {
    const session = getSession();
    if (!session) {
      return fail$c("UNAUTHORIZED", "Non authentifie.");
    }
    const role = getAuthenticatedRole();
    if (!role) {
      return fail$c("UNAUTHORIZED", "Session invalide.");
    }
    const userLevel = ROLE_HIERARCHY[role] ?? 0;
    const minLevel = ROLE_HIERARCHY[minRole];
    if (userLevel < minLevel) {
      return fail$c("FORBIDDEN", `Acces refuse. Role requis: ${minRole}`);
    }
    return handler(event, ...args);
  };
}
const DEFAULT_MODULES = [
  "students",
  "grades",
  "payments",
  "absences",
  "schedule",
  "staff",
  "expenses",
  "reports",
  "library",
  "infirmerie",
  "transport",
  "messages"
];
function getModulesFilePath() {
  return path.join(electron.app.getPath("userData"), "sgsi-modules.json");
}
function readModulesFromFile() {
  try {
    const content = fs.readFileSync(getModulesFilePath(), "utf-8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : DEFAULT_MODULES;
  } catch {
    return DEFAULT_MODULES;
  }
}
function writeModulesToFile(modules) {
  fs.writeFileSync(getModulesFilePath(), JSON.stringify(modules), "utf-8");
}
function registerSettingsIpc(db) {
  electron.ipcMain.handle("settings:getSchool", async () => {
    try {
      let school = await db.school.findFirst();
      if (!school) {
        school = await db.school.create({
          data: { name: "Mon École", sigle: "ECO", currency: "GNF", language: "fr" }
        });
      }
      return ok$c(school);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:updateSchool", withRole("DIRECTOR", async (_, data) => {
    try {
      const sanitized = {
        ...data,
        passingAverage: data.passingAverage != null ? parseFloat(data.passingAverage) : void 0,
        eliminatoryThreshold: data.eliminatoryThreshold != null ? parseFloat(data.eliminatoryThreshold) : void 0
      };
      let school = await db.school.findFirst();
      if (!school) {
        school = await db.school.create({ data: sanitized });
      } else {
        school = await db.school.update({ where: { id: school.id }, data: sanitized });
      }
      return ok$c(school);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  }));
  electron.ipcMain.handle("settings:listUsers", withRole("DIRECTOR", async () => {
    try {
      const users = await db.user.findMany({
        select: { id: true, username: true, firstName: true, lastName: true, role: true, isActive: true, lastLogin: true, email: true, phone: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      });
      return ok$c(users);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  }));
  electron.ipcMain.handle("settings:createUser", withRole("DIRECTOR", async (_, data) => {
    try {
      const bcrypt2 = require("bcryptjs");
      const hashed = await bcrypt2.hash(data.password ?? "Temp@1234", 12);
      const user = await db.user.create({
        data: {
          username: data.username,
          password: hashed,
          role: data.role,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? null,
          phone: data.phone ?? null,
          mustChangePassword: true
        }
      });
      return ok$c({ id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName });
    } catch (e) {
      return fail$c(e.code === "P2002" ? "USERNAME_TAKEN" : "ERROR", e.code === "P2002" ? "Nom d'utilisateur déjà utilisé" : e.message);
    }
  }));
  electron.ipcMain.handle("settings:updateUser", async (_, id, data) => {
    try {
      const user = await db.user.update({
        where: { id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email ?? null,
          phone: data.phone ?? null,
          role: data.role,
          isActive: data.isActive
        }
      });
      return ok$c(user);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:resetUserPassword", async (_, userId, requestedBy) => {
    try {
      const bcrypt2 = require("bcryptjs");
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let tempPassword = "";
      for (let i = 0; i < 8; i++) tempPassword += chars[Math.floor(Math.random() * chars.length)];
      const hashed = await bcrypt2.hash(tempPassword, 12);
      await db.user.update({ where: { id: userId }, data: { password: hashed, mustChangePassword: true } });
      return ok$c({ tempPassword });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:listAcademicYears", async () => {
    try {
      const years = await db.academicYear.findMany({ orderBy: { startDate: "desc" } });
      return ok$c(years);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createAcademicYear", async (_, data) => {
    try {
      if (data.isCurrent) await db.academicYear.updateMany({ data: { isCurrent: false } });
      const year = await db.academicYear.create({ data });
      return ok$c(year);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:setCurrentYear", async (_, id) => {
    try {
      await db.academicYear.updateMany({ data: { isCurrent: false } });
      const year = await db.academicYear.update({ where: { id }, data: { isCurrent: true } });
      return ok$c(year);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createCycle", async (_, data) => {
    try {
      const count = await db.cycle.count();
      const cycle = await db.cycle.create({ data: { name: data.name, order: count + 1 } });
      return ok$c(cycle);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createClass", async (_, data) => {
    try {
      const cls = await db.class.create({
        data: { name: data.name, levelId: data.levelId, academicYearId: data.academicYearId, maxStudents: data.maxStudents ?? 40 },
        include: { level: { include: { cycle: true } } }
      });
      return ok$c(cls);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createLevel", async (_, data) => {
    try {
      const count = await db.level.count({ where: { cycleId: data.cycleId } });
      const level = await db.level.create({
        data: { name: data.name, order: count + 1, cycleId: data.cycleId },
        include: { cycle: true }
      });
      return ok$c(level);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:getModules", async () => {
    try {
      return ok$c(readModulesFromFile());
    } catch (e) {
      return ok$c(DEFAULT_MODULES);
    }
  });
  electron.ipcMain.handle("settings:setModules", async (_, modules) => {
    try {
      writeModulesToFile(modules);
      return ok$c(modules);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  const smtpFilePath = () => path.join(electron.app.getPath("userData"), "sgsi-smtp.json");
  electron.ipcMain.handle("settings:getSmtpConfig", async () => {
    try {
      const file = smtpFilePath();
      if (!fs.existsSync(file)) return ok$c(null);
      const config = JSON.parse(fs.readFileSync(file, "utf-8"));
      return ok$c({ ...config, password: config.password ? "••••••••" : "" });
    } catch {
      return ok$c(null);
    }
  });
  electron.ipcMain.handle("settings:setSmtpConfig", async (_, config) => {
    try {
      const file = smtpFilePath();
      let existing = {};
      if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, "utf-8"));
      const toSave = { ...config, password: config.password === "••••••••" ? existing.password ?? "" : config.password };
      fs.writeFileSync(file, JSON.stringify(toSave), "utf-8");
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:testSmtp", async (_, testEmail) => {
    try {
      const file = smtpFilePath();
      if (!fs.existsSync(file)) return fail$c("NO_SMTP", "Aucune configuration SMTP enregistrée");
      const smtp = JSON.parse(fs.readFileSync(file, "utf-8"));
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.password },
        tls: { rejectUnauthorized: false }
      });
      await transporter.sendMail({
        from: `"${smtp.fromName || "SGSI"}" <${smtp.fromEmail || smtp.user}>`,
        to: testEmail,
        subject: "Test SMTP — SGSI SchoolManager",
        html: "<p>Si vous recevez cet email, votre configuration SMTP est correcte !</p><p><strong>SGSI SchoolManager</strong></p>"
      });
      return ok$c(null);
    } catch (e) {
      return fail$c("SMTP_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:getResendConfig", async () => {
    try {
      const config = loadBrevoConfig();
      if (!config) return ok$c(null);
      return ok$c({
        ...config,
        apiKey: config.apiKey ? `${"•".repeat(16)}${config.apiKey.slice(-8)}` : ""
      });
    } catch {
      return ok$c(null);
    }
  });
  electron.ipcMain.handle("settings:setResendConfig", async (_, config) => {
    try {
      const existing = loadBrevoConfig();
      const isMasked = config.apiKey.startsWith("•") || config.apiKey.includes("•".repeat(8));
      const apiKey = isMasked ? existing?.apiKey ?? "" : config.apiKey.trim();
      saveBrevoConfig({ apiKey, fromName: config.fromName, fromEmail: config.fromEmail });
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:testResend", async (_, testEmail) => {
    try {
      const result = await sendEmail({
        to: testEmail,
        subject: "✅ Test email — SGSI SchoolManager Pro",
        html: `<div style="font-family:Arial,sans-serif;padding:28px;max-width:480px;background:#f0efff;border-radius:12px">
          <h2 style="color:#6366F1;margin-bottom:12px">✅ Configuration Brevo réussie !</h2>
          <p style="color:#374151">Si vous recevez cet email, votre configuration Brevo est correctement configurée.</p>
          <p style="color:#6B7280;font-size:12px;margin-top:16px">SGSI SchoolManager Pro</p>
        </div>`
      });
      return ok$c({ id: result.id });
    } catch (e) {
      return fail$c("EMAIL_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("sms:send", async (_, opts) => {
    try {
      const result = await sendSms(opts);
      return ok$c(result);
    } catch (e) {
      return fail$c("SMS_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("sms:sendAbsenceAlert", async (_, data) => {
    try {
      const msg = `SGSI - Absence signalée pour ${data.studentName} (${data.className}) le ${data.date}. Contactez l'école pour toute information.`;
      const result = await sendSms({ to: data.parentPhone, message: msg, sender: "SGSI" });
      return ok$c(result);
    } catch (e) {
      return fail$c("SMS_ERROR", e.message);
    }
  });
  const autoBackupFilePath = () => path.join(electron.app.getPath("userData"), "sgsi-autobackup.json");
  electron.ipcMain.handle("settings:getAutoBackupConfig", async () => {
    try {
      const file = autoBackupFilePath();
      if (!fs.existsSync(file)) return ok$c({ enabled: true, frequency: "daily", lastBackupAt: null });
      return ok$c(JSON.parse(fs.readFileSync(file, "utf-8")));
    } catch {
      return ok$c({ enabled: true, frequency: "daily", lastBackupAt: null });
    }
  });
  electron.ipcMain.handle("settings:setAutoBackupConfig", async (_, config) => {
    try {
      const file = autoBackupFilePath();
      const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf-8")) : {};
      fs.writeFileSync(file, JSON.stringify({ ...existing, ...config }), "utf-8");
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  const recoveryFilePath = () => path.join(electron.app.getPath("userData"), "sgsi-recovery.json");
  electron.ipcMain.handle("settings:getRecoveryCode", async () => {
    try {
      const file = recoveryFilePath();
      if (!fs.existsSync(file)) return ok$c({ isSet: false });
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return ok$c({ isSet: !!data.hash });
    } catch {
      return ok$c({ isSet: false });
    }
  });
  electron.ipcMain.handle("settings:setRecoveryCode", async (_, code) => {
    try {
      const hash = crypto.createHash("sha256").update(code.trim()).digest("hex");
      fs.writeFileSync(recoveryFilePath(), JSON.stringify({ hash }), "utf-8");
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
function registerSubjectsIpc(db) {
  electron.ipcMain.handle("subjects:list", async () => {
    try {
      return ok$c(await db.subject.findMany({ orderBy: { name: "asc" } }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("subjects:create", async (_, data) => {
    try {
      const subject = await db.subject.create({
        data: { name: data.name, code: data.code.toUpperCase().trim() }
      });
      return ok$c(subject);
    } catch (e) {
      return fail$c(
        e.code === "P2002" ? "CODE_TAKEN" : "ERROR",
        e.code === "P2002" ? "Ce code est déjà utilisé" : e.message
      );
    }
  });
  electron.ipcMain.handle("subjects:delete", async (_, id) => {
    try {
      await db.subject.delete({ where: { id } });
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classSubjects:list", async (_, classId) => {
    try {
      return ok$c(await db.classSubject.findMany({
        where: { classId },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } }
        },
        orderBy: { subject: { name: "asc" } }
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classSubjects:add", async (_, data) => {
    try {
      const cs = await db.classSubject.create({
        data: {
          classId: data.classId,
          subjectId: data.subjectId,
          coefficient: data.coefficient,
          hoursPerWeek: data.hoursPerWeek
        },
        include: { subject: true }
      });
      return ok$c(cs);
    } catch (e) {
      return fail$c(
        e.code === "P2002" ? "ALREADY_EXISTS" : "ERROR",
        e.code === "P2002" ? "Cette matière est déjà assignée à cette classe" : e.message
      );
    }
  });
  electron.ipcMain.handle("classSubjects:update", async (_, id, data) => {
    try {
      return ok$c(await db.classSubject.update({ where: { id }, data, include: { subject: true } }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classSubjects:remove", async (_, id) => {
    try {
      await db.classSubject.delete({ where: { id } });
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:list", async (_, levelId) => {
    try {
      return ok$c(await db.levelSubject.findMany({
        where: { levelId },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } }
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:upsert", async (_, data) => {
    try {
      const ls = await db.levelSubject.upsert({
        where: { levelId_subjectId: { levelId: data.levelId, subjectId: data.subjectId } },
        create: { levelId: data.levelId, subjectId: data.subjectId, coefficient: data.coefficient, hoursPerWeek: data.hoursPerWeek },
        update: { coefficient: data.coefficient, hoursPerWeek: data.hoursPerWeek },
        include: { subject: true }
      });
      return ok$c(ls);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:remove", async (_, id) => {
    try {
      await db.levelSubject.delete({ where: { id } });
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:applyToClasses", async (_, levelId) => {
    try {
      const levelSubjects = await db.levelSubject.findMany({ where: { levelId } });
      const classes = await db.class.findMany({ where: { levelId } });
      let updated = 0;
      for (const cls of classes) {
        for (const ls of levelSubjects) {
          const existing = await db.classSubject.findFirst({
            where: { classId: cls.id, subjectId: ls.subjectId }
          });
          if (existing) {
            await db.classSubject.update({
              where: { id: existing.id },
              data: { coefficient: ls.coefficient, hoursPerWeek: ls.hoursPerWeek }
            });
            updated++;
          }
        }
      }
      return ok$c({ updated, classes: classes.length, subjects: levelSubjects.length });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
function registerAbsencesIpc(db) {
  electron.ipcMain.handle("absences:getSheet", async (_, classId, date) => {
    try {
      const day = new Date(date);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: "ACTIVE" },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true, gender: true } },
          absences: { where: { date: { gte: start, lte: end } } }
        },
        orderBy: { student: { lastName: "asc" } }
      });
      return ok$c(enrollments.map((e) => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        gender: e.student.gender,
        absence: e.absences[0] ?? null
      })));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("absences:saveSheet", async (_, records, date) => {
    try {
      const day = new Date(date);
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      for (const r of records) {
        await db.absence.deleteMany({
          where: { enrollmentId: r.enrollmentId, date: { gte: start, lte: end } }
        });
        if (r.type !== "PRESENT") {
          await db.absence.create({
            data: {
              enrollmentId: r.enrollmentId,
              date: new Date(date),
              type: r.type,
              justified: r.justified ?? false,
              reason: r.reason ?? null
            }
          });
        }
      }
      return ok$c({ saved: records.length });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("absences:listByEnrollment", async (_, enrollmentId) => {
    try {
      return ok$c(await db.absence.findMany({
        where: { enrollmentId },
        orderBy: { date: "desc" }
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("absences:globalStats", async () => {
    try {
      const today = /* @__PURE__ */ new Date();
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);
      const [totalEnrollments, todayAbsences, weekAbsences, totalAbsences] = await Promise.all([
        db.enrollment.count({ where: { status: "ACTIVE" } }),
        db.absence.count({ where: { date: { gte: todayStart, lte: todayEnd }, type: { not: "LATE" } } }),
        db.absence.count({
          where: {
            date: { gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1e3) },
            type: { not: "LATE" }
          }
        }),
        db.absence.count({ where: { type: { not: "LATE" } } })
      ]);
      const todayPct = totalEnrollments > 0 ? Math.round((totalEnrollments - todayAbsences) / totalEnrollments * 100) : 100;
      const topAbsentees = await db.enrollment.findMany({
        where: { status: "ACTIVE" },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
          class: { select: { name: true } },
          _count: { select: { absences: true } }
        },
        orderBy: { absences: { _count: "desc" } },
        take: 5
      });
      return ok$c({
        totalEnrollments,
        todayAbsences,
        todayPresence: totalEnrollments - todayAbsences,
        todayRate: todayPct,
        weekAbsences,
        totalAbsences,
        topAbsentees: topAbsentees.filter((e) => e._count.absences > 0).map((e) => ({
          studentName: `${e.student.lastName} ${e.student.firstName}`,
          matricule: e.student.matricule,
          className: e.class.name,
          count: e._count.absences
        }))
      });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("absences:stats", async (_, classId) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId, status: "ACTIVE" },
        include: {
          student: { select: { firstName: true, lastName: true, matricule: true } },
          absences: true
        },
        orderBy: { student: { lastName: "asc" } }
      });
      return ok$c(enrollments.map((e) => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        total: e.absences.length,
        justified: e.absences.filter((a) => a.justified).length,
        unjustified: e.absences.filter((a) => !a.justified).length,
        late: e.absences.filter((a) => a.type === "LATE").length
      })));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
class TeacherService {
  constructor(db) {
    this.db = db;
  }
  async audit(userId, action, entity, entityId) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
    } catch {
    }
  }
  async list() {
    return this.db.teacher.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, username: true }
        },
        homeClasses: { select: { id: true, name: true } },
        subjects: {
          include: { subject: { select: { name: true, code: true } }, class: { select: { name: true } } }
        }
      },
      orderBy: { matricule: "asc" }
    });
  }
  async getById(id) {
    return this.db.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, username: true } },
        homeClasses: { select: { id: true, name: true } },
        subjects: {
          include: { subject: true, class: { select: { name: true } } }
        },
        salaries: { orderBy: [{ year: "desc" }, { month: "desc" }], take: 12 }
      }
    });
  }
  async create(data, actorId) {
    const existing = await this.db.user.findFirst({ where: { username: data.username } });
    if (existing) throw new Error("Ce nom d'utilisateur est déjà utilisé");
    const hashed = await bcrypt.hash(data.password ?? "Enseignant@1234", 12);
    const count = await this.db.teacher.count();
    const school = await this.db.school.findFirst();
    const sigle = school?.sigle ?? "ECO";
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const matricule = `${sigle}-ENS-${year}-${String(count + 1).padStart(4, "0")}`;
    const result = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          password: hashed,
          role: "TEACHER",
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          isActive: true
        }
      });
      const teacher = await tx.teacher.create({
        data: {
          matricule,
          userId: user.id,
          diploma: data.diploma,
          hireDate: data.hireDate,
          contractType: data.contractType,
          baseSalary: data.baseSalary ?? 0,
          hoursPerWeek: data.hoursPerWeek ?? 0
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true } }
        }
      });
      return teacher;
    });
    await this.audit(actorId, "CREATE", "teacher", result.id);
    const tempPassword = data.password ?? "Enseignant@1234";
    if (data.email && loadBrevoConfig()?.apiKey) {
      try {
        const html = buildTeacherWelcomeEmail({
          teacherName: `${data.firstName} ${data.lastName}`,
          username: data.username,
          password: tempPassword,
          schoolName: school?.name ?? "Notre établissement",
          schoolPhone: school?.phone ?? void 0
        });
        await sendEmail({
          to: data.email,
          subject: `Vos identifiants SGSI — ${school?.name ?? "SchoolManager Pro"}`,
          html
        });
      } catch (emailErr) {
        console.warn("[SGSI] Email non envoyé:", emailErr.message);
      }
    }
    return { ...result, emailSent: !!(data.email && loadBrevoConfig()?.apiKey) };
  }
  async update(id, data, actorId) {
    const teacher = await this.db.teacher.findUnique({ where: { id } });
    if (!teacher) throw new Error("Enseignant introuvable");
    const result = await this.db.$transaction(async (tx) => {
      if (data.firstName || data.lastName || data.email !== void 0 || data.phone !== void 0 || data.isActive !== void 0) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: {
            ...data.firstName && { firstName: data.firstName },
            ...data.lastName && { lastName: data.lastName },
            ...data.email !== void 0 && { email: data.email },
            ...data.phone !== void 0 && { phone: data.phone },
            ...data.isActive !== void 0 && { isActive: data.isActive }
          }
        });
      }
      return tx.teacher.update({
        where: { id },
        data: {
          ...data.diploma !== void 0 && { diploma: data.diploma },
          ...data.hireDate !== void 0 && { hireDate: data.hireDate },
          ...data.contractType !== void 0 && { contractType: data.contractType },
          ...data.baseSalary !== void 0 && { baseSalary: data.baseSalary },
          ...data.hoursPerWeek !== void 0 && { hoursPerWeek: data.hoursPerWeek }
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, phone: true, isActive: true } }
        }
      });
    });
    await this.audit(actorId, "UPDATE", "teacher", id);
    return result;
  }
  async delete(id, actorId) {
    const teacher = await this.db.teacher.findUnique({
      where: { id },
      include: { subjects: true, homeClasses: true }
    });
    if (!teacher) throw new Error("Enseignant introuvable");
    if (teacher.subjects.length > 0) throw new Error("Cet enseignant est affecté à des matières. Retirez-le d'abord des classes.");
    if (teacher.homeClasses.length > 0) throw new Error("Cet enseignant est professeur principal d'une classe.");
    await this.db.$transaction(async (tx) => {
      await tx.teacher.delete({ where: { id } });
      await tx.user.delete({ where: { id: teacher.userId } });
    });
    await this.audit(actorId, "DELETE", "teacher", id);
  }
  async listSalaries(teacherId) {
    return this.db.salary.findMany({
      where: { teacherId },
      orderBy: [{ year: "desc" }, { month: "desc" }]
    });
  }
  async createSalary(data, actorId) {
    const net = data.baseSalary + (data.bonuses ?? 0) - (data.advances ?? 0) - (data.deductions ?? 0);
    const salary = await this.db.salary.create({
      data: {
        teacherId: data.teacherId,
        month: data.month,
        year: data.year,
        baseSalary: data.baseSalary,
        bonuses: data.bonuses ?? 0,
        advances: data.advances ?? 0,
        deductions: data.deductions ?? 0,
        netSalary: net
      }
    });
    await this.audit(actorId, "CREATE", "salary", salary.id);
    return salary;
  }
  async markSalaryPaid(salaryId, actorId) {
    const salary = await this.db.salary.update({
      where: { id: salaryId },
      data: { paidAt: /* @__PURE__ */ new Date() }
    });
    await this.audit(actorId, "UPDATE", "salary", salaryId);
    return salary;
  }
  async getSalaryReceipt(salaryId) {
    const salary = await this.db.salary.findUnique({
      where: { id: salaryId },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } }
          }
        }
      }
    });
    if (!salary) throw new Error("Bulletin de salaire introuvable");
    return salary;
  }
}
function registerTeachersIpc(db) {
  const svc = new TeacherService(db);
  electron.ipcMain.handle("teachers:list", async () => {
    try {
      return ok$c(await svc.list());
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:getById", async (_, id) => {
    try {
      return ok$c(await svc.getById(id));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:create", async (_, data, actorId) => {
    try {
      return ok$c(await svc.create(data, actorId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:update", async (_, id, data, actorId) => {
    try {
      return ok$c(await svc.update(id, data, actorId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:delete", async (_, id, actorId) => {
    try {
      await svc.delete(id, actorId);
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:listSalaries", async (_, teacherId) => {
    try {
      return ok$c(await svc.listSalaries(teacherId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:createSalary", async (_, data, actorId) => {
    try {
      return ok$c(await svc.createSalary(data, actorId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:markSalaryPaid", async (_, salaryId, actorId) => {
    try {
      return ok$c(await svc.markSalaryPaid(salaryId, actorId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:getSalaryReceipt", async (_, salaryId) => {
    try {
      return ok$c(await svc.getSalaryReceipt(salaryId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
class ScheduleService {
  constructor(db) {
    this.db = db;
  }
  async listByClass(classId) {
    return this.db.schedule.findMany({
      where: { classId },
      include: {
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } }
        },
        room: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });
  }
  async listByTeacher(teacherId) {
    return this.db.schedule.findMany({
      where: { teacherId },
      include: {
        class: { select: { name: true } },
        room: true
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
    });
  }
  async create(data) {
    const teacherConflict = await this.db.schedule.findFirst({
      where: {
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        OR: [
          { startTime: { lte: data.startTime }, endTime: { gt: data.startTime } },
          { startTime: { lt: data.endTime }, endTime: { gte: data.endTime } },
          { startTime: { gte: data.startTime }, endTime: { lte: data.endTime } }
        ]
      }
    });
    if (teacherConflict) throw new Error(`Conflit horaire : l'enseignant est déjà occupé à ce créneau (${teacherConflict.subjectName})`);
    const classConflict = await this.db.schedule.findFirst({
      where: {
        classId: data.classId,
        dayOfWeek: data.dayOfWeek,
        OR: [
          { startTime: { lte: data.startTime }, endTime: { gt: data.startTime } },
          { startTime: { lt: data.endTime }, endTime: { gte: data.endTime } },
          { startTime: { gte: data.startTime }, endTime: { lte: data.endTime } }
        ]
      }
    });
    if (classConflict) throw new Error(`Conflit horaire : la classe a déjà un cours à ce créneau (${classConflict.subjectName})`);
    return this.db.schedule.create({
      data,
      include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        room: true
      }
    });
  }
  async delete(id) {
    return this.db.schedule.delete({ where: { id } });
  }
  async listRooms() {
    return this.db.room.findMany({ orderBy: { name: "asc" } });
  }
  async createRoom(data) {
    return this.db.room.create({ data });
  }
}
function registerSchedulesIpc(db) {
  const svc = new ScheduleService(db);
  electron.ipcMain.handle("schedules:listByClass", async (_, classId) => {
    try {
      return ok$c(await svc.listByClass(classId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:listByTeacher", async (_, teacherId) => {
    try {
      return ok$c(await svc.listByTeacher(teacherId));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:create", async (_, data) => {
    try {
      return ok$c(await svc.create(data));
    } catch (e) {
      return fail$c("CONFLICT", e.message);
    }
  });
  electron.ipcMain.handle("schedules:delete", async (_, id) => {
    try {
      await svc.delete(id);
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:listRooms", async () => {
    try {
      return ok$c(await svc.listRooms());
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:createRoom", async (_, data) => {
    try {
      return ok$c(await svc.createRoom(data));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
class ExpenseService {
  constructor(db) {
    this.db = db;
  }
  async list(filters) {
    const where = {};
    if (filters?.year || filters?.month) {
      const y = filters.year ?? (/* @__PURE__ */ new Date()).getFullYear();
      const m = filters.month;
      if (m) {
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0, 23, 59, 59);
        where.doneAt = { gte: start, lte: end };
      } else {
        where.doneAt = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) };
      }
    }
    if (filters?.category) where.category = filters.category;
    return this.db.expense.findMany({ where, orderBy: { doneAt: "desc" } });
  }
  async create(data) {
    return this.db.expense.create({
      data: {
        label: data.label,
        amount: data.amount,
        category: data.category,
        recordedBy: data.recordedBy,
        doneAt: data.doneAt ?? /* @__PURE__ */ new Date()
      }
    });
  }
  async delete(id) {
    return this.db.expense.delete({ where: { id } });
  }
  async monthlySummary(year) {
    const expenses = await this.db.expense.findMany({
      where: { doneAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } }
    });
    const byMonth = {};
    const byCategory = {};
    let total = 0;
    for (const e of expenses) {
      const m = new Date(e.doneAt).getMonth() + 1;
      byMonth[m] = (byMonth[m] ?? 0) + e.amount;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      total += e.amount;
    }
    return { byMonth, byCategory, total, count: expenses.length };
  }
  // Cash register
  async getTodayCash() {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    return this.db.cashRegister.findFirst({ where: { date: today } });
  }
  async openCash(openBalance, openedBy) {
    const today = /* @__PURE__ */ new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await this.db.cashRegister.findFirst({ where: { date: today } });
    if (existing) throw new Error("La caisse est déjà ouverte aujourd'hui");
    return this.db.cashRegister.create({
      data: { date: today, openBalance, openedBy, isClosed: false }
    });
  }
  async closeCash(id, closeBalance, closedBy) {
    return this.db.cashRegister.update({
      where: { id },
      data: { closeBalance, closedBy, isClosed: true }
    });
  }
}
function registerExpensesIpc(db) {
  const svc = new ExpenseService(db);
  electron.ipcMain.handle("expenses:list", async (_, filters) => {
    try {
      return ok$c(await svc.list(filters));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:create", async (_, data) => {
    try {
      return ok$c(await svc.create(data));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:delete", async (_, id) => {
    try {
      await svc.delete(id);
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:summary", async (_, year) => {
    try {
      return ok$c(await svc.monthlySummary(year));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:today", async () => {
    try {
      return ok$c(await svc.getTodayCash());
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:open", async (_, openBalance, openedBy) => {
    try {
      return ok$c(await svc.openCash(openBalance, openedBy));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:close", async (_, id, closeBalance, closedBy) => {
    try {
      return ok$c(await svc.closeCash(id, closeBalance, closedBy));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
class ParentService {
  constructor(db) {
    this.db = db;
  }
  async listByStudent(studentId) {
    const links = await this.db.studentParent.findMany({
      where: { studentId },
      include: { parent: true }
    });
    return links.map((l) => l.parent);
  }
  async create(data, studentId) {
    return this.db.$transaction(async (tx) => {
      const parent = await tx.parent.create({ data });
      await tx.studentParent.create({ data: { studentId, parentId: parent.id } });
      return parent;
    });
  }
  async update(id, data) {
    return this.db.parent.update({ where: { id }, data });
  }
  async unlink(parentId, studentId) {
    await this.db.studentParent.delete({
      where: { studentId_parentId: { studentId, parentId } }
    });
  }
  async generateAccessCode(parentId) {
    const code = `PAR-${randomCode()}`;
    await this.db.parent.update({ where: { id: parentId }, data: { accessCode: code } });
    return code;
  }
}
function ok$b(data) {
  return { success: true, data };
}
function fail$b(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerParentsIpc(db) {
  const svc = new ParentService(db);
  electron.ipcMain.handle("parents:listByStudent", async (_, studentId) => {
    try {
      return ok$b(await svc.listByStudent(studentId));
    } catch (e) {
      return fail$b(e.message);
    }
  });
  electron.ipcMain.handle("parents:create", async (_, data, studentId) => {
    try {
      return ok$b(await svc.create(data, studentId));
    } catch (e) {
      return fail$b(e.message);
    }
  });
  electron.ipcMain.handle("parents:update", async (_, id, data) => {
    try {
      return ok$b(await svc.update(id, data));
    } catch (e) {
      return fail$b(e.message);
    }
  });
  electron.ipcMain.handle("parents:unlink", async (_, parentId, studentId) => {
    try {
      return ok$b(await svc.unlink(parentId, studentId));
    } catch (e) {
      return fail$b(e.message);
    }
  });
  electron.ipcMain.handle("parents:generateCode", async (_, parentId) => {
    try {
      return ok$b(await svc.generateAccessCode(parentId));
    } catch (e) {
      return fail$b(e.message);
    }
  });
}
class AuditLogService {
  constructor(db) {
    this.db = db;
  }
  async list(filters) {
    return this.db.auditLog.findMany({
      where: {
        ...filters?.userId && { userId: filters.userId },
        ...filters?.entity && { entity: filters.entity }
      },
      include: { user: { select: { firstName: true, lastName: true, username: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: filters?.limit ?? 200
    });
  }
  async listEntities() {
    const rows = await this.db.auditLog.findMany({
      select: { entity: true },
      distinct: ["entity"],
      orderBy: { entity: "asc" }
    });
    return rows.map((r) => r.entity);
  }
}
function ok$a(data) {
  return { success: true, data };
}
function fail$a(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerAuditLogIpc(db) {
  const svc = new AuditLogService(db);
  electron.ipcMain.handle("auditlog:list", async (_, filters) => {
    try {
      return ok$a(await svc.list(filters));
    } catch (e) {
      return fail$a(e.message);
    }
  });
  electron.ipcMain.handle("auditlog:entities", async () => {
    try {
      return ok$a(await svc.listEntities());
    } catch (e) {
      return fail$a(e.message);
    }
  });
}
class LibraryService {
  constructor(db) {
    this.db = db;
  }
  async listBooks(search) {
    return this.db.book.findMany({
      where: search ? {
        OR: [
          { title: { contains: search } },
          { author: { contains: search } },
          { isbn: { contains: search } }
        ]
      } : void 0,
      include: { _count: { select: { loans: true } } },
      orderBy: { title: "asc" }
    });
  }
  async createBook(data) {
    return this.db.book.create({ data: { ...data, available: data.copies } });
  }
  async updateBook(id, data) {
    return this.db.book.update({ where: { id }, data });
  }
  async deleteBook(id) {
    const loans = await this.db.bookLoan.count({ where: { bookId: id, returnedAt: null } });
    if (loans > 0) throw new Error("Ce livre a des emprunts en cours");
    return this.db.book.delete({ where: { id } });
  }
  async listLoans(filters) {
    return this.db.bookLoan.findMany({
      where: {
        ...filters?.bookId && { bookId: filters.bookId },
        ...filters?.studentId && { studentId: filters.studentId },
        ...filters?.returned === false && { returnedAt: null },
        ...filters?.returned === true && { returnedAt: { not: null } }
      },
      include: {
        book: { select: { title: true, author: true } },
        student: { select: { firstName: true, lastName: true, matricule: true } }
      },
      orderBy: { borrowedAt: "desc" }
    });
  }
  async createLoan(data) {
    const book = await this.db.book.findUnique({ where: { id: data.bookId } });
    if (!book) throw new Error("Livre introuvable");
    if (book.available <= 0) throw new Error("Aucun exemplaire disponible");
    const [loan] = await this.db.$transaction([
      this.db.bookLoan.create({ data }),
      this.db.book.update({ where: { id: data.bookId }, data: { available: book.available - 1 } })
    ]);
    return loan;
  }
  async returnLoan(loanId, fine) {
    const loan = await this.db.bookLoan.findUnique({ where: { id: loanId }, include: { book: true } });
    if (!loan) throw new Error("Emprunt introuvable");
    if (loan.returnedAt) throw new Error("Ce livre a déjà été retourné");
    const [updated] = await this.db.$transaction([
      this.db.bookLoan.update({
        where: { id: loanId },
        data: { returnedAt: /* @__PURE__ */ new Date(), fine: fine ?? 0 }
      }),
      this.db.book.update({
        where: { id: loan.bookId },
        data: { available: loan.book.available + 1 }
      })
    ]);
    return updated;
  }
  async stats() {
    const [totalBooks, totalLoans, activeLoans, overdueLoans] = await Promise.all([
      this.db.book.aggregate({ _sum: { copies: true }, _count: true }),
      this.db.bookLoan.count(),
      this.db.bookLoan.count({ where: { returnedAt: null } }),
      this.db.bookLoan.count({ where: { returnedAt: null, dueDate: { lt: /* @__PURE__ */ new Date() } } })
    ]);
    return { totalBooks: totalBooks._count, totalCopies: totalBooks._sum.copies ?? 0, totalLoans, activeLoans, overdueLoans };
  }
}
function ok$9(data) {
  return { success: true, data };
}
function fail$9(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerLibraryIpc(db) {
  const svc = new LibraryService(db);
  electron.ipcMain.handle("library:listBooks", async (_, search) => {
    try {
      return ok$9(await svc.listBooks(search));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:createBook", async (_, data) => {
    try {
      return ok$9(await svc.createBook(data));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:updateBook", async (_, id, data) => {
    try {
      return ok$9(await svc.updateBook(id, data));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:deleteBook", async (_, id) => {
    try {
      return ok$9(await svc.deleteBook(id));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:listLoans", async (_, filters) => {
    try {
      return ok$9(await svc.listLoans(filters));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:createLoan", async (_, data) => {
    try {
      return ok$9(await svc.createLoan({ ...data, dueDate: new Date(data.dueDate) }));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:returnLoan", async (_, loanId, fine) => {
    try {
      return ok$9(await svc.returnLoan(loanId, fine));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("library:stats", async () => {
    try {
      return ok$9(await svc.stats());
    } catch (e) {
      return fail$9(e.message);
    }
  });
}
class MedicalService {
  constructor(db) {
    this.db = db;
  }
  async getRecord(studentId) {
    const existing = await this.db.medicalRecord.findUnique({
      where: { studentId },
      include: {
        consultations: { orderBy: { date: "desc" } },
        student: { select: { firstName: true, lastName: true, matricule: true } }
      }
    });
    if (existing) return existing;
    return this.db.medicalRecord.create({
      data: { studentId },
      include: {
        consultations: { orderBy: { date: "desc" } },
        student: { select: { firstName: true, lastName: true, matricule: true } }
      }
    });
  }
  async updateRecord(id, data) {
    return this.db.medicalRecord.update({
      where: { id },
      data,
      include: {
        consultations: { orderBy: { date: "desc" } },
        student: { select: { firstName: true, lastName: true, matricule: true } }
      }
    });
  }
  async addConsultation(medicalRecordId, data) {
    return this.db.consultation.create({
      data: {
        medicalRecordId,
        reason: data.reason,
        treatment: data.treatment ?? null,
        notes: data.notes ?? null,
        date: data.date ?? /* @__PURE__ */ new Date()
      }
    });
  }
  async deleteConsultation(id) {
    return this.db.consultation.delete({ where: { id } });
  }
  async listRecent(limit = 60) {
    return this.db.consultation.findMany({
      orderBy: { date: "desc" },
      take: limit,
      include: {
        medicalRecord: {
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } }
          }
        }
      }
    });
  }
}
function ok$8(data) {
  return { success: true, data };
}
function fail$8(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerMedicalIpc(db) {
  const svc = new MedicalService(db);
  electron.ipcMain.handle("medical:getRecord", async (_, studentId) => {
    try {
      return ok$8(await svc.getRecord(studentId));
    } catch (e) {
      return fail$8(e.message);
    }
  });
  electron.ipcMain.handle("medical:updateRecord", async (_, id, data) => {
    try {
      return ok$8(await svc.updateRecord(id, data));
    } catch (e) {
      return fail$8(e.message);
    }
  });
  electron.ipcMain.handle("medical:addConsultation", async (_, medicalRecordId, data) => {
    try {
      return ok$8(await svc.addConsultation(medicalRecordId, { ...data, date: data.date ? new Date(data.date) : void 0 }));
    } catch (e) {
      return fail$8(e.message);
    }
  });
  electron.ipcMain.handle("medical:deleteConsultation", async (_, id) => {
    try {
      return ok$8(await svc.deleteConsultation(id));
    } catch (e) {
      return fail$8(e.message);
    }
  });
  electron.ipcMain.handle("medical:listRecent", async (_, limit) => {
    try {
      return ok$8(await svc.listRecent(limit));
    } catch (e) {
      return fail$8(e.message);
    }
  });
}
class TransportService {
  constructor(db) {
    this.db = db;
  }
  async listBuses() {
    return this.db.bus.findMany({
      include: { routes: true },
      orderBy: { plate: "asc" }
    });
  }
  async createBus(data) {
    return this.db.bus.create({
      data,
      include: { routes: true }
    });
  }
  async updateBus(id, data) {
    return this.db.bus.update({
      where: { id },
      data,
      include: { routes: true }
    });
  }
  async deleteBus(id) {
    const routeCount = await this.db.route.count({ where: { busId: id } });
    if (routeCount > 0) throw new Error("Supprimez d'abord les circuits de ce bus");
    return this.db.bus.delete({ where: { id } });
  }
  async createRoute(data) {
    return this.db.route.create({ data });
  }
  async updateRoute(id, data) {
    return this.db.route.update({ where: { id }, data });
  }
  async deleteRoute(id) {
    return this.db.route.delete({ where: { id } });
  }
  async stats() {
    const [busCount, routeCount] = await Promise.all([
      this.db.bus.count(),
      this.db.route.count()
    ]);
    const buses = await this.db.bus.findMany({ select: { capacity: true } });
    const totalCapacity = buses.reduce((s, b) => s + b.capacity, 0);
    return { busCount, routeCount, totalCapacity };
  }
}
function ok$7(data) {
  return { success: true, data };
}
function fail$7(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerTransportIpc(db) {
  const svc = new TransportService(db);
  electron.ipcMain.handle("transport:listBuses", async () => {
    try {
      return ok$7(await svc.listBuses());
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:createBus", async (_, data) => {
    try {
      return ok$7(await svc.createBus(data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:updateBus", async (_, id, data) => {
    try {
      return ok$7(await svc.updateBus(id, data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:deleteBus", async (_, id) => {
    try {
      return ok$7(await svc.deleteBus(id));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:createRoute", async (_, data) => {
    try {
      return ok$7(await svc.createRoute(data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:updateRoute", async (_, id, data) => {
    try {
      return ok$7(await svc.updateRoute(id, data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:deleteRoute", async (_, id) => {
    try {
      return ok$7(await svc.deleteRoute(id));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("transport:stats", async () => {
    try {
      return ok$7(await svc.stats());
    } catch (e) {
      return fail$7(e.message);
    }
  });
}
class NotificationService {
  constructor(db) {
    this.db = db;
  }
  async list(limit = 50) {
    return this.db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
  async countUnread() {
    return this.db.notification.count({ where: { isRead: false } });
  }
  async markRead(id) {
    return this.db.notification.update({ where: { id }, data: { isRead: true } });
  }
  async markAllRead() {
    return this.db.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
  }
  async create(data) {
    return this.db.notification.create({ data });
  }
  async delete(id) {
    return this.db.notification.delete({ where: { id } });
  }
}
function ok$6(data) {
  return { success: true, data };
}
function fail$6(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerNotificationsIpc(db) {
  const svc = new NotificationService(db);
  electron.ipcMain.handle("notifications:list", async (_, limit) => {
    try {
      return ok$6(await svc.list(limit));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("notifications:countUnread", async () => {
    try {
      return ok$6(await svc.countUnread());
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("notifications:markRead", async (_, id) => {
    try {
      return ok$6(await svc.markRead(id));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("notifications:markAllRead", async () => {
    try {
      return ok$6(await svc.markAllRead());
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("notifications:create", async (_, data) => {
    try {
      return ok$6(await svc.create(data));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("notifications:delete", async (_, id) => {
    try {
      return ok$6(await svc.delete(id));
    } catch (e) {
      return fail$6(e.message);
    }
  });
}
function ok$5(data) {
  return { success: true, data };
}
function fail$5(message) {
  return { success: false, error: { code: "ERROR", message } };
}
function registerDialogIpc() {
  electron.ipcMain.handle("dialog:openImage", async () => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: "Sélectionner une photo",
        filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "gif", "webp"] }],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) return ok$5(null);
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
      const data = fs.readFileSync(filePath);
      return ok$5(`data:${mime};base64,${data.toString("base64")}`);
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("dialog:openAndCopyFile", async (_, destDir, extensions) => {
    try {
      const filters = extensions?.length ? [{ name: "Fichiers", extensions }] : [{ name: "Tous les fichiers", extensions: ["*"] }];
      const result = await electron.dialog.showOpenDialog({
        title: "Sélectionner un fichier",
        filters,
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) return ok$5(null);
      const src = result.filePaths[0];
      const filename = path.basename(src);
      const dest = path.join(destDir, `${Date.now()}_${filename}`);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      return ok$5({ filename, destPath: dest });
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("shell:openPath", async (_, filePath) => {
    try {
      await electron.shell.openPath(filePath);
      return ok$5(null);
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("dialog:openPrintWindow", async (_, html, _filename) => {
    try {
      const win = new electron.BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        title: _filename ?? "Impression SGSI",
        webPreferences: { contextIsolation: true, nodeIntegration: false }
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.once("ready-to-show", () => win.show());
      return ok$5(null);
    } catch (e) {
      return fail$5(e.message);
    }
  });
}
function ok$4(data) {
  return { success: true, data };
}
function fail$4(message) {
  return { success: false, error: { code: "ERROR", message } };
}
const DOCS_ROOT = path.join(electron.app.getPath("userData"), "student-docs");
const DOC_TYPES = [
  "Extrait de naissance",
  "Certificat de transfert",
  "Photo d'identité",
  "Certificat médical",
  "Diplôme / Attestation",
  "Autre"
];
function registerStudentDocumentIpc(db) {
  electron.ipcMain.handle("studentdocs:list", async (_, studentId) => {
    try {
      const docs = await db.studentDocument.findMany({
        where: { studentId },
        orderBy: { uploadedAt: "desc" }
      });
      return ok$4(docs);
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:add", async (_, studentId, type) => {
    try {
      const result = await electron.dialog.showOpenDialog({
        title: `Joindre : ${type}`,
        filters: [
          { name: "Documents", extensions: ["pdf", "jpg", "jpeg", "png", "doc", "docx"] }
        ],
        properties: ["openFile"]
      });
      if (result.canceled || result.filePaths.length === 0) return ok$4(null);
      const src = result.filePaths[0];
      const filename = path.basename(src);
      const destDir = path.join(DOCS_ROOT, studentId);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${Date.now()}_${filename}`);
      fs.copyFileSync(src, dest);
      const doc = await db.studentDocument.create({
        data: { studentId, type, filePath: dest }
      });
      return ok$4(doc);
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:open", async (_, id) => {
    try {
      const doc = await db.studentDocument.findUnique({ where: { id } });
      if (!doc) return fail$4("Document introuvable");
      if (!fs.existsSync(doc.filePath)) return fail$4("Fichier introuvable sur le disque");
      await electron.shell.openPath(doc.filePath);
      return ok$4(null);
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:delete", async (_, id) => {
    try {
      const doc = await db.studentDocument.findUnique({ where: { id } });
      if (doc) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch {
        }
      }
      await db.studentDocument.delete({ where: { id } });
      return ok$4(null);
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:types", async () => ok$4(DOC_TYPES));
}
function getWindowsMachineGuid() {
  try {
    const result = child_process.execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: "utf8", timeout: 3e3, windowsHide: true }
    );
    const match = result.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
function getWindowsProductId() {
  try {
    const result = child_process.execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductId',
      { encoding: "utf8", timeout: 3e3, windowsHide: true }
    );
    const match = result.match(/ProductId\s+REG_SZ\s+([^\r\n]+)/);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}
function getPhysicalMacs() {
  const SKIP_PREFIXES = [
    "00:00:00",
    "ff:ff:ff",
    "02:00:00",
    "00:50:56",
    "00:0c:29",
    "00:1c:42"
    // VMware, VirtualBox, Parallels
  ];
  return Object.values(os.networkInterfaces()).flat().filter(
    (ni) => !!ni && !ni.internal && ni.family === "IPv4" && !!ni.mac && ni.mac !== "00:00:00:00:00:00"
  ).map((ni) => ni.mac.toLowerCase()).filter((mac) => !SKIP_PREFIXES.some((p) => mac.startsWith(p))).sort().slice(0, 3);
}
function getCpuId() {
  const cpus = os.cpus();
  if (!cpus.length) return "unknown-cpu";
  return cpus[0].model.trim();
}
function generateHardwareId() {
  const components = [
    getWindowsMachineGuid(),
    getWindowsProductId(),
    getCpuId(),
    os.hostname(),
    ...getPhysicalMacs()
  ].filter(Boolean);
  if (components.length === 0) {
    components.push(os.hostname(), os.userInfo().username, os.homedir());
  }
  const raw = components.join("|");
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}
function getShortHardwareId() {
  return generateHardwareId().slice(0, 16).toUpperCase();
}
const STORAGE_VERSION = 1;
const _APPDATA = process.env.APPDATA ?? path.join(electron.app.getPath("home"), "AppData", "Roaming");
const _LIC_DIR = path.join(_APPDATA, "sgsi");
const CACHE_FILE = path.join(_LIC_DIR, ".sgsi_lic");
const HMAC_SECRET = "sgsi-hmac-secret-v1-do-not-share";
function deriveKey() {
  const hwId = generateHardwareId();
  return crypto.createHash("sha256").update(hwId + HMAC_SECRET).digest();
}
function encrypt(plaintext) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    tag: cipher.getAuthTag().toString("hex"),
    data: enc.toString("hex")
  };
}
function decrypt(iv, tag, data) {
  const key = deriveKey();
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(data, "hex")),
    decipher.final()
  ]);
  return dec.toString("utf8");
}
function sign(payload) {
  return crypto.createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
}
function verify(payload, sig) {
  const expected = sign(payload);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}
function saveLicense(data) {
  const plaintext = JSON.stringify(data);
  const { iv, tag, enc_data } = (() => {
    const e = encrypt(plaintext);
    return { iv: e.iv, tag: e.tag, enc_data: e.data };
  })();
  const sigPayload = `${STORAGE_VERSION}:${iv}:${tag}:${enc_data}`;
  const sig = sign(sigPayload);
  const envelope = {
    v: STORAGE_VERSION,
    iv,
    tag,
    data: enc_data,
    sig
  };
  if (!fs.existsSync(_LIC_DIR)) fs.mkdirSync(_LIC_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(envelope), { encoding: "utf8", mode: 384 });
}
function loadLicense() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    if (!raw || raw.v !== STORAGE_VERSION) return null;
    const sigPayload = `${raw.v}:${raw.iv}:${raw.tag}:${raw.data}`;
    if (!verify(sigPayload, raw.sig)) {
      console.warn("[SGSI License] Tampered license cache detected. Clearing.");
      clearLicense();
      return null;
    }
    const plaintext = decrypt(raw.iv, raw.tag, raw.data);
    const data = JSON.parse(plaintext);
    const currentHwId = generateHardwareId();
    if (data.hardwareId && data.hardwareId !== currentHwId) {
      console.warn("[SGSI License] Hardware ID mismatch. License not valid on this machine.");
      return null;
    }
    return data;
  } catch (e) {
    console.error("[SGSI License] Failed to load license cache:", e);
    return null;
  }
}
function clearLicense() {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE);
  } catch {
  }
}
function hasValidLocalLicense() {
  const cache = loadLicense();
  if (!cache) return false;
  if (!cache.expiresAt) return true;
  return /* @__PURE__ */ new Date() < new Date(cache.expiresAt);
}
function daysSinceValidation() {
  const cache = loadLicense();
  if (!cache?.validatedAt) return Infinity;
  const ms = Date.now() - new Date(cache.validatedAt).getTime();
  return Math.floor(ms / (1e3 * 60 * 60 * 24));
}
const GRACE_DAYS$1 = 30;
function validateCachedLicense(cache) {
  if (!cache) {
    return { valid: false, source: "none", reason: "Aucune licence trouvée sur cet appareil." };
  }
  if (cache.expiresAt && /* @__PURE__ */ new Date() > new Date(cache.expiresAt)) {
    return {
      valid: false,
      source: "cache",
      reason: `Licence expirée le ${new Date(cache.expiresAt).toLocaleDateString("fr-FR")}.`,
      expiresAt: cache.expiresAt
    };
  }
  const lastVal = new Date(cache.validatedAt).getTime();
  const elapsedDays = (Date.now() - lastVal) / (1e3 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(GRACE_DAYS$1 - elapsedDays));
  const daysUntilExpiry = cache.expiresAt ? Math.max(0, Math.ceil((new Date(cache.expiresAt).getTime() - Date.now()) / (1e3 * 60 * 60 * 24))) : void 0;
  const baseResult = {
    plan: cache.plan,
    planName: cache.planName,
    maxStudents: cache.maxStudents,
    schoolName: cache.schoolName,
    expiresAt: cache.expiresAt,
    daysUntilExpiry,
    serverValidated: cache.serverValidated
  };
  if (elapsedDays > GRACE_DAYS$1) {
    return {
      ...baseResult,
      valid: false,
      source: "grace",
      reason: `Validation serveur requise. Dernière validation il y a ${Math.floor(elapsedDays)} jours (limite: ${GRACE_DAYS$1} jours). Connectez-vous à Internet.`
    };
  }
  const source = elapsedDays > 0 ? "grace" : "cache";
  return {
    ...baseResult,
    valid: true,
    source,
    daysLeft: source === "grace" ? daysLeft : void 0
  };
}
const LICENSE_SERVER$1 = process.env.LICENSE_SERVER ?? "https://sgsi-license-server.onrender.com";
const REQUEST_TIMEOUT = 8e3;
const GRACE_DAYS = 30;
function httpPost(url, body, timeoutMs = REQUEST_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isTls = parsed.protocol === "https:";
    const mod = isTls ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : isTls ? 443 : 80,
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "User-Agent": "SGSI-Desktop/2.0",
        "X-Client-ID": generateHardwareId().slice(0, 8)
      },
      timeout: timeoutMs
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
async function activateLicense(licenseKey, db) {
  const key = licenseKey.trim().toUpperCase();
  const hardwareId = generateHardwareId();
  let schoolName = "";
  try {
    const school = await db.school?.findFirst();
    schoolName = school?.name ?? "";
  } catch {
  }
  function parseKeyLocally(k) {
    const parts = k.split("-");
    if (parts.length < 4 || parts[0] !== "SGSI") return null;
    const planCode = parts[1];
    const PLANS = {
      STD: { name: "Standard", maxStudents: 500 },
      PRO: { name: "Professional", maxStudents: 2e3 },
      ULT: { name: "Ultimate", maxStudents: 9999 }
    };
    const plan = PLANS[planCode];
    if (!plan) return null;
    const yearPart = parts[parts.length - 1];
    const year = parseInt(yearPart, 10);
    if (isNaN(year) || year < 2024 || year > 2099) return null;
    return {
      plan: planCode,
      planName: plan.name,
      maxStudents: plan.maxStudents,
      expiresAt: year === 2099 ? null : new Date(year, 11, 31, 23, 59, 59).toISOString(),
      issuedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  let serverResp = null;
  try {
    const resp = await httpPost(`${LICENSE_SERVER$1}/api/license/activate`, {
      licenseKey: key,
      hardwareId,
      schoolName
    });
    if (resp.status === 200 && resp.body?.success) {
      serverResp = resp.body;
    } else if (resp.status === 404 || resp.status === 0) {
      const local = parseKeyLocally(key);
      if (local) {
        serverResp = {
          success: true,
          plan: local.plan,
          planName: local.planName,
          maxStudents: local.maxStudents,
          schoolName,
          expiresAt: local.expiresAt,
          issuedAt: local.issuedAt
        };
      } else {
        throw new Error("Clé de licence invalide. Format attendu : SGSI-PRO-XXXXXXXX-2027");
      }
    } else {
      const msg = resp.body?.error ?? `Erreur (HTTP ${resp.status})`;
      throw new Error(msg);
    }
  } catch (e) {
    if (e.code === "TIMEOUT" || e.code === "ENOTFOUND" || e.code === "ECONNREFUSED" || e.message?.includes("TIMEOUT") || e.message?.includes("ENOTFOUND") || e.message?.includes("ECONNREFUSED")) {
      const local = parseKeyLocally(key);
      if (local) {
        serverResp = {
          success: true,
          plan: local.plan,
          planName: local.planName,
          maxStudents: local.maxStudents,
          schoolName,
          expiresAt: local.expiresAt,
          issuedAt: local.issuedAt
        };
      } else {
        throw new Error("Clé de licence invalide. Format attendu : SGSI-PRO-XXXXXXXX-2027");
      }
    } else if (!serverResp) {
      throw e;
    }
  }
  const cache = {
    version: 1,
    key,
    plan: serverResp.plan,
    planName: serverResp.planName,
    maxStudents: serverResp.maxStudents,
    schoolName: serverResp.schoolName,
    hardwareId,
    expiresAt: serverResp.expiresAt,
    issuedAt: serverResp.issuedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
    activatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    validatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    serverValidated: true
  };
  saveLicense(cache);
  try {
    await db.license.upsert({
      where: { key },
      update: { isActive: true, expiresAt: serverResp.expiresAt ? new Date(serverResp.expiresAt) : null, plan: serverResp.plan, maxStudents: serverResp.maxStudents },
      create: { key, schoolName, plan: serverResp.plan, maxStudents: serverResp.maxStudents, isActive: true, expiresAt: serverResp.expiresAt ? new Date(serverResp.expiresAt) : null }
    });
  } catch {
  }
  return serverResp;
}
async function validateLicense() {
  const cache = loadLicense();
  if (!cache) {
    return { valid: false, source: "none", reason: "Aucune licence activée sur cet appareil." };
  }
  if (cache.expiresAt && /* @__PURE__ */ new Date() > new Date(cache.expiresAt)) {
    clearLicense();
    return { valid: false, source: "cache", reason: "Licence expirée. Veuillez renouveler." };
  }
  try {
    const hardwareId = generateHardwareId();
    const resp = await httpPost(`${LICENSE_SERVER$1}/api/license/validate`, {
      licenseKey: cache.key,
      hardwareId
    }, 4e3);
    if (resp.status === 200 && resp.body?.valid) {
      saveLicense({ ...cache, validatedAt: (/* @__PURE__ */ new Date()).toISOString(), serverValidated: true });
      const daysUntilExpiry = cache.expiresAt ? Math.max(0, Math.ceil((new Date(cache.expiresAt).getTime() - Date.now()) / 864e5)) : void 0;
      return {
        valid: true,
        source: "server",
        plan: cache.plan,
        planName: cache.planName,
        maxStudents: cache.maxStudents,
        schoolName: cache.schoolName,
        expiresAt: cache.expiresAt,
        daysUntilExpiry,
        serverValidated: true
      };
    }
    if (resp.status === 403) {
      const reason = resp.body?.error ?? "Licence invalide selon le serveur";
      clearLicense();
      return { valid: false, source: "server", reason };
    }
  } catch {
  }
  return validateCachedLicense(cache);
}
function deactivateLicense() {
  clearLicense();
}
async function getLicenseInfo() {
  const hardwareId = generateHardwareId();
  const shortHardwareId = getShortHardwareId();
  const validation = await validateLicense();
  const cache = loadLicense();
  const needsOnlineValidation = cache ? daysSinceValidation() >= Math.floor(GRACE_DAYS * 0.7) : false;
  return {
    isActivated: !!cache,
    validation,
    hardwareId,
    shortHardwareId,
    needsOnlineValidation
  };
}
function isLicenseValidSync() {
  return hasValidLocalLicense();
}
const LICENSE_SERVER = process.env.LICENSE_SERVER ?? "http://localhost:3500";
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "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";
const ADMIN_EMAIL = "lambertmillimono8@gmail.com";
function mainPost(url, body, timeoutMs = 1e4) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isTls = parsed.protocol === "https:";
    const mod = isTls ? https : http;
    const data = JSON.stringify(body);
    const req = mod.request({
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : isTls ? 443 : 80,
      path: parsed.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      timeout: timeoutMs
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: raw });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
async function sendRequestEmailDirect(data) {
  const planNames = { STD: "Standard (500 élèves)", PRO: "Professional (2 000 élèves)", ULT: "Ultimate (Illimité)" };
  const planName = planNames[data.plan] ?? data.plan;
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
      <tr><td style="color:#6B7280;padding:6px 0">Responsable</td><td>${data.contactName || "—"}</td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Email contact</td><td><strong>${data.contactEmail}</strong></td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Plan demandé</td><td><strong>${planName}</strong></td></tr>
      <tr><td style="color:#6B7280;padding:6px 0">Message</td><td>${data.message || "(aucun)"}</td></tr>
    </table>
    <div style="background:#EEF2FF;border:1px solid #C7D2FE;border-radius:8px;padding:12px;margin:16px 0">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#6366F1;margin-bottom:6px">ID Machine</div>
      <div style="font-family:monospace;color:#312E81;word-break:break-all">${data.hardwareId || "(non fourni)"}</div>
    </div>
    <div style="background:#F3F4F6;border-radius:8px;padding:12px;font-size:12px;color:#374151">
      <strong>Commande pour générer la clé :</strong><br/>
      <code>node src/admin.js generate --plan ${data.plan} --year ${(/* @__PURE__ */ new Date()).getFullYear() + 1} --school "${data.schoolName}" --email "${data.contactEmail}"</code>
    </div>
  </div>`;
  const brevoBody = JSON.stringify({
    sender: { name: "SGSI License System", email: ADMIN_EMAIL },
    to: [{ email: ADMIN_EMAIL }],
    subject: `🔑 [SGSI] Demande de licence — ${data.schoolName} (${data.plan})`,
    htmlContent: html
  });
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "api.brevo.com",
      path: "/v3/smtp/email",
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(brevoBody)
      }
    }, (res) => {
      let d = "";
      res.on("data", (c) => d += c);
      res.on("end", () => {
        if ((res.statusCode ?? 0) < 300) resolve();
        else reject(new Error(`Brevo ${res.statusCode}: ${d}`));
      });
    });
    req.on("error", reject);
    req.write(brevoBody);
    req.end();
  });
}
function ok$3(data) {
  return { success: true, data };
}
function fail$3(code, message) {
  return { success: false, error: { code, message } };
}
function registerLicenseIpc(db) {
  electron.ipcMain.handle("license:activate", async (_, key) => {
    try {
      if (!key?.trim()) return fail$3("INVALID_KEY", "Clé de licence manquante");
      const result = await activateLicense(key.trim().toUpperCase(), db);
      return ok$3(result);
    } catch (e) {
      return fail$3("ACTIVATION_FAILED", e.message ?? "Erreur d'activation");
    }
  });
  electron.ipcMain.handle("license:get", async () => {
    try {
      const info = await getLicenseInfo();
      return ok$3({
        ...info,
        hardwareId: info.hardwareId.slice(0, 8) + "..." + info.hardwareId.slice(-4)
      });
    } catch (e) {
      return fail$3("LICENSE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("license:validate", async () => {
    try {
      const result = await validateLicense();
      return ok$3(result);
    } catch (e) {
      return ok$3({ valid: false, source: "error", reason: e.message });
    }
  });
  electron.ipcMain.handle("license:isValid", async () => {
    return ok$3(isLicenseValidSync());
  });
  electron.ipcMain.handle("license:request", async (_, data) => {
    if (!data.schoolName?.trim()) return fail$3("MISSING", "Nom de l'école requis");
    if (!data.contactEmail?.trim()) return fail$3("MISSING", "Email de contact requis");
    try {
      await sendRequestEmailDirect(data);
      const requestId = Math.random().toString(36).slice(2, 8).toUpperCase();
      return ok$3({
        success: true,
        requestId,
        message: `Demande envoyée ! L'administrateur SGSI vous contactera à ${data.contactEmail} dans les prochaines heures.`
      });
    } catch (e) {
      const errMsg = e.message ?? "";
      if (errMsg.includes("Brevo") || errMsg.includes("401") || errMsg.includes("403")) {
        return fail$3("EMAIL_ERROR", "Erreur de configuration email. Contactez directement : lambertmillimono8@gmail.com");
      }
      if (errMsg.includes("ENOTFOUND") || errMsg.includes("ECONNREFUSED") || errMsg.includes("TIMEOUT")) {
        return fail$3("NETWORK_ERROR", "Pas de connexion Internet. Vérifiez votre connexion et réessayez.");
      }
      return fail$3("EMAIL_ERROR", `Erreur : ${errMsg}. Contactez directement lambertmillimono8@gmail.com`);
    }
  });
  electron.ipcMain.handle("license:adminGenerate", async (_, data) => {
    try {
      const PLANS = {
        STD: { name: "Standard", maxStudents: 500 },
        PRO: { name: "Professional", maxStudents: 2e3 },
        ULT: { name: "Ultimate", maxStudents: 9999 }
      };
      const planUp = (data.plan ?? "STD").toUpperCase();
      const planInfo = PLANS[planUp] ?? PLANS.STD;
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = "";
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const key = `SGSI-${planUp}-${code}-${data.expiryYear}`;
      const expiresAt = new Date(data.expiryYear, 11, 31, 23, 59, 59).toISOString();
      try {
        await mainPost(`${LICENSE_SERVER}/api/license/generate`, {
          adminSecret: process.env.ADMIN_SECRET ?? "sgsi-admin-secret-change-me",
          plan: planUp,
          expiryYear: data.expiryYear,
          schoolName: data.schoolName,
          customerEmail: data.customerEmail,
          maxMachines: data.maxMachines ?? 1
        }, 4e3);
      } catch {
      }
      return ok$3({ key, plan: planUp, planName: planInfo.name, maxStudents: planInfo.maxStudents, expiresAt });
    } catch (e) {
      return fail$3("GEN_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("license:sendKey", async (_, data) => {
    if (!data.licenseKey || !data.clientEmail) return fail$3("MISSING", "licenseKey et clientEmail requis");
    const keyParts = data.licenseKey.split("-");
    const plan = keyParts[1] ?? "STD";
    const year = keyParts[keyParts.length - 1] ?? "";
    const PLAN_NAMES = { STD: "Standard", PRO: "Professional", ULT: "Ultimate" };
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
    <p>Bonjour,<br/>Voici votre clé de licence <strong>SGSI SchoolManager Pro</strong> pour <strong>${data.schoolName || "votre école"}</strong>.<br/>
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
</div></body></html>`;
    try {
      await sendRequestEmailDirect({
        schoolName: data.schoolName,
        contactEmail: data.clientEmail,
        contactName: "",
        plan,
        hardwareId: "",
        message: `CLE_ENVOYEE:${data.licenseKey}`
      });
      const brevoBody = JSON.stringify({
        sender: { name: "SGSI SchoolManager", email: ADMIN_EMAIL },
        to: [{ email: data.clientEmail }],
        subject: `🔑 Votre clé de licence SGSI — ${data.schoolName || "SchoolManager Pro"}`,
        htmlContent: html
      });
      await new Promise((resolve, reject) => {
        const https_req = require("https").request({
          hostname: "api.brevo.com",
          path: "/v3/smtp/email",
          method: "POST",
          headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(brevoBody) }
        }, (res) => {
          let d = "";
          res.on("data", (c) => d += c);
          res.on("end", () => {
            if ((res.statusCode ?? 0) < 300) resolve();
            else reject(new Error(`Brevo ${res.statusCode}: ${d}`));
          });
        });
        https_req.on("error", reject);
        https_req.write(brevoBody);
        https_req.end();
      });
      return ok$3({ success: true, message: `Clé envoyée à ${data.clientEmail}` });
    } catch (e) {
      return fail$3("SEND_ERROR", `Impossible d'envoyer l'email : ${e.message}`);
    }
  });
  electron.ipcMain.handle("license:deactivate", async () => {
    try {
      deactivateLicense();
      return ok$3(null);
    } catch (e) {
      return fail$3("DEACTIVATION_FAILED", e.message);
    }
  });
}
class MessageService {
  constructor(db) {
    this.db = db;
  }
  async listInbox(userId) {
    return this.db.message.findMany({
      where: { toUserId: userId, isDeleted: false, parentId: null },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: { where: { isDeleted: false }, orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    });
  }
  async listSent(userId) {
    return this.db.message.findMany({
      where: { fromUserId: userId, isDeleted: false, parentId: null },
      include: {
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: { where: { isDeleted: false }, orderBy: { createdAt: "asc" } }
      },
      orderBy: { createdAt: "desc" }
    });
  }
  async getThread(messageId, userId) {
    const msg = await this.db.message.findUnique({
      where: { id: messageId },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: "asc" },
          include: {
            fromUser: { select: { id: true, firstName: true, lastName: true, role: true } }
          }
        }
      }
    });
    if (!msg) throw new Error("Message introuvable");
    if (msg.toUserId === userId && !msg.isRead) {
      await this.db.message.update({
        where: { id: messageId },
        data: { isRead: true, readAt: /* @__PURE__ */ new Date() }
      });
    }
    return msg;
  }
  async send(data) {
    return this.db.message.create({
      data: {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        subject: data.subject,
        body: data.body,
        parentId: data.parentId ?? null
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } }
      }
    });
  }
  async countUnread(userId) {
    return this.db.message.count({ where: { toUserId: userId, isRead: false, isDeleted: false } });
  }
  async markRead(messageId) {
    return this.db.message.update({
      where: { id: messageId },
      data: { isRead: true, readAt: /* @__PURE__ */ new Date() }
    });
  }
  async delete(messageId, userId) {
    const msg = await this.db.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new Error("Message introuvable");
    if (msg.fromUserId !== userId && msg.toUserId !== userId) throw new Error("Non autorisé");
    return this.db.message.update({ where: { id: messageId }, data: { isDeleted: true } });
  }
}
function ok$2(data) {
  return { success: true, data };
}
function fail$2(code, message) {
  return { success: false, error: { code, message } };
}
function registerMessagesIpc(db) {
  const svc = new MessageService(db);
  electron.ipcMain.handle("messages:inbox", async (_, userId) => {
    try {
      return ok$2(await svc.listInbox(userId));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:sent", async (_, userId) => {
    try {
      return ok$2(await svc.listSent(userId));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:thread", async (_, messageId, userId) => {
    try {
      return ok$2(await svc.getThread(messageId, userId));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:send", async (_, data) => {
    try {
      return ok$2(await svc.send(data));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:countUnread", async (_, userId) => {
    try {
      return ok$2(await svc.countUnread(userId));
    } catch (e) {
      return ok$2(0);
    }
  });
  electron.ipcMain.handle("messages:markRead", async (_, messageId) => {
    try {
      return ok$2(await svc.markRead(messageId));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:delete", async (_, messageId, userId) => {
    try {
      return ok$2(await svc.delete(messageId, userId));
    } catch (e) {
      return fail$2("MSG_ERROR", e.message);
    }
  });
}
const PAY_METHODS = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  WAVE: "Wave",
  MOBILE_MONEY: "Mobile Money",
  BANK_CARD: "Carte bancaire",
  BANK_TRANSFER: "Virement",
  CHECK: "Chèque"
};
const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre"
];
function registerReportsIpc(db) {
  electron.ipcMain.handle("reports:exportFinancialExcel", async (_, year) => {
    try {
      let styleHeader = function(row) {
        row.eachCell((cell) => {
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = { vertical: "middle", horizontal: "center" };
          cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
        });
        row.height = 22;
      };
      const ExcelJS2 = require("exceljs");
      const [payments, school] = await Promise.all([
        db.payment.findMany({
          where: { paidAt: { gte: /* @__PURE__ */ new Date(`${year}-01-01`), lt: /* @__PURE__ */ new Date(`${year + 1}-01-01`) } },
          include: {
            enrollment: { include: { student: true, class: true } },
            feeType: true
          },
          orderBy: { paidAt: "desc" }
        }),
        db.school.findFirst()
      ]);
      const wb = new ExcelJS2.Workbook();
      wb.creator = "SGSI SchoolManager";
      wb.created = /* @__PURE__ */ new Date();
      const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
      const headerFont = { color: { argb: "FFFFFFFF" }, bold: true, size: 11 };
      const altFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
      const wsDetail = wb.addWorksheet("Détail paiements");
      wsDetail.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];
      wsDetail.columns = [
        { key: "receiptNo", width: 20 },
        { key: "date", width: 14 },
        { key: "student", width: 30 },
        { key: "matricule", width: 16 },
        { key: "class", width: 14 },
        { key: "feeType", width: 22 },
        { key: "amount", width: 18 },
        { key: "method", width: 16 }
      ];
      const titleRow = wsDetail.addRow([`RAPPORT FINANCIER ${year} — ${school?.name ?? "SGSI"}`]);
      titleRow.getCell(1).font = { bold: true, size: 13, color: { argb: "FF1E3A8A" } };
      wsDetail.mergeCells("A1:H1");
      wsDetail.addRow([]);
      const hRow = wsDetail.addRow([
        "N° Reçu",
        "Date",
        "Élève",
        "Matricule",
        "Classe",
        "Type de frais",
        "Montant (GNF)",
        "Mode paiement"
      ]);
      styleHeader(hRow);
      payments.forEach((p, i) => {
        const row = wsDetail.addRow({
          receiptNo: p.receiptNo,
          date: new Date(p.paidAt).toLocaleDateString("fr-FR"),
          student: `${p.enrollment.student.lastName} ${p.enrollment.student.firstName}`,
          matricule: p.enrollment.student.matricule,
          class: p.enrollment.class.name,
          feeType: p.feeType.name,
          amount: p.amount,
          method: PAY_METHODS[p.method] ?? p.method
        });
        if (i % 2 === 0) {
          row.eachCell({ includeEmpty: true }, (cell, col) => {
            if (col <= 8) cell.fill = altFill;
          });
        }
        row.getCell("amount").numFmt = "#,##0";
        row.getCell("amount").alignment = { horizontal: "right" };
      });
      const totalRow = wsDetail.addRow(["", "", "", "", "", "TOTAL", payments.reduce((s, p) => s + p.amount, 0), ""]);
      totalRow.getCell(6).font = { bold: true };
      totalRow.getCell(7).font = { bold: true, color: { argb: "FF1E3A8A" } };
      totalRow.getCell(7).numFmt = "#,##0";
      const wsMonth = wb.addWorksheet("Par mois");
      wsMonth.columns = [
        { key: "month", width: 16 },
        { key: "count", width: 14 },
        { key: "total", width: 20 }
      ];
      wsMonth.addRow([`Récapitulatif mensuel — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
      wsMonth.mergeCells("A1:C1");
      wsMonth.addRow([]);
      const mHeader = wsMonth.addRow(["Mois", "Nb paiements", "Total (GNF)"]);
      styleHeader(mHeader);
      const byMonth = {};
      payments.forEach((p) => {
        const m = new Date(p.paidAt).getMonth() + 1;
        if (!byMonth[m]) byMonth[m] = { count: 0, total: 0 };
        byMonth[m].count += 1;
        byMonth[m].total += p.amount;
      });
      let grandTotal = 0;
      for (let m = 1; m <= 12; m++) {
        const d = byMonth[m] ?? { count: 0, total: 0 };
        const row = wsMonth.addRow({ month: MONTHS[m - 1], count: d.count, total: d.total });
        row.getCell("total").numFmt = "#,##0";
        if (d.total > 0) row.getCell("total").font = { color: { argb: "FF15803D" } };
        grandTotal += d.total;
      }
      const gRow = wsMonth.addRow({ month: "TOTAL ANNÉE", count: payments.length, total: grandTotal });
      gRow.eachCell((cell) => {
        cell.font = { bold: true };
      });
      gRow.getCell("total").numFmt = "#,##0";
      gRow.getCell("total").font = { bold: true, color: { argb: "FF1E3A8A" } };
      const wsFee = wb.addWorksheet("Par type de frais");
      wsFee.columns = [
        { key: "feeType", width: 24 },
        { key: "count", width: 14 },
        { key: "total", width: 20 }
      ];
      wsFee.addRow([`Par type de frais — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
      wsFee.mergeCells("A1:C1");
      wsFee.addRow([]);
      styleHeader(wsFee.addRow(["Type de frais", "Nb paiements", "Total (GNF)"]));
      const byFee = {};
      payments.forEach((p) => {
        const k = p.feeType.name;
        if (!byFee[k]) byFee[k] = { count: 0, total: 0 };
        byFee[k].count += 1;
        byFee[k].total += p.amount;
      });
      Object.entries(byFee).sort(([, a], [, b]) => b.total - a.total).forEach(([name, d]) => {
        const row = wsFee.addRow({ feeType: name, count: d.count, total: d.total });
        row.getCell("total").numFmt = "#,##0";
      });
      const wsStudents = wb.addWorksheet("Liste élèves");
      wsStudents.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];
      wsStudents.columns = [
        { key: "matricule", width: 18 },
        { key: "lastName", width: 20 },
        { key: "firstName", width: 20 },
        { key: "gender", width: 10 },
        { key: "class", width: 14 },
        { key: "birthDate", width: 16 },
        { key: "phone", width: 16 },
        { key: "email", width: 26 }
      ];
      wsStudents.addRow([`Liste des élèves — ${school?.name ?? "SGSI"} — ${year}`]).getCell(1).font = { bold: true, size: 12, color: { argb: "FF1E3A8A" } };
      wsStudents.mergeCells("A1:H1");
      wsStudents.addRow([]);
      styleHeader(wsStudents.addRow(["Matricule", "Nom", "Prénom", "Genre", "Classe", "Date naissance", "Téléphone", "Email"]));
      const students = await db.student.findMany({
        include: { enrollments: { include: { class: true }, orderBy: { enrolledAt: "desc" }, take: 1 } },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      students.forEach((s, i) => {
        const cls = s.enrollments[0]?.class?.name ?? "—";
        const row = wsStudents.addRow({
          matricule: s.matricule,
          lastName: s.lastName,
          firstName: s.firstName,
          gender: s.gender === "MALE" ? "M" : "F",
          class: cls,
          birthDate: s.birthDate ? new Date(s.birthDate).toLocaleDateString("fr-FR") : "—",
          phone: s.phone ?? "—",
          email: s.email ?? "—"
        });
        if (i % 2 === 0) row.eachCell({ includeEmpty: true }, (cell, col) => {
          if (col <= 8) cell.fill = altFill;
        });
      });
      const defaultName = `rapport-${year}-${school?.sigle ?? "SGSI"}.xlsx`;
      const saveResult = await electron.dialog.showSaveDialog({
        title: "Enregistrer le rapport Excel",
        defaultPath: path.join(electron.app.getPath("desktop"), defaultName),
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (saveResult.canceled || !saveResult.filePath) return ok$c(null);
      await wb.xlsx.writeFile(saveResult.filePath);
      electron.shell.openPath(path.dirname(saveResult.filePath));
      return ok$c({ filePath: saveResult.filePath });
    } catch (e) {
      return fail$c("EXCEL_ERROR", e.message);
    }
  });
}
function ok$1(data) {
  return { success: true, data };
}
function fail$1(msg) {
  return { success: false, error: { code: "ERROR", message: msg } };
}
async function buildCardHtml(student, school) {
  const fullName = `${student.lastName} ${student.firstName}`;
  const enrollment = student.enrollments?.[0];
  const className = enrollment?.class?.name ?? "—";
  const yearLabel = enrollment?.academicYear?.name ?? (/* @__PURE__ */ new Date()).getFullYear().toString();
  const matricule = student.matricule ?? "—";
  const birthDate = student.birthDate ? new Date(student.birthDate).toLocaleDateString("fr-FR") : "—";
  const parentLinks = student.parents ?? [];
  const firstParent = parentLinks[0]?.parent ?? null;
  const guardian = firstParent ? `${firstParent.lastName} ${firstParent.firstName}` : "—";
  const guardianPhone = firstParent?.phone ?? "—";
  const schoolName = school?.name ?? "SGSI — SchoolManager Pro";
  const schoolSlogan = school?.address ?? "Excellence · Innovation · Réussite";
  const schoolAddress = [school?.address, school?.city].filter(Boolean).join(", ") || "—";
  const schoolPhone = school?.phone ?? "—";
  const schoolEmail = school?.email ?? "—";
  const schoolWebsite = school?.website ?? "www.sgsi.edu";
  const qrData = JSON.stringify({
    id: student.id,
    m: matricule,
    nom: fullName,
    cl: className,
    an: yearLabel
  });
  const qrDataUri = await QRCode.toDataURL(qrData, {
    width: 100,
    margin: 1,
    color: { dark: "#1565C0", light: "#FFFFFF" }
  });
  let photoSrc = "";
  if (student.photo) {
    if (student.photo.startsWith("data:")) {
      photoSrc = student.photo;
    } else if (fs.existsSync(student.photo)) {
      const ext = path.extname(student.photo).slice(1) || "jpeg";
      const data = fs.readFileSync(student.photo);
      photoSrc = `data:image/${ext};base64,${data.toString("base64")}`;
    }
  }
  const joinedDate = enrollment?.enrolledAt ? new Date(enrollment.enrolledAt).toLocaleDateString("fr-FR") : (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR");
  const expireYear = ((/* @__PURE__ */ new Date()).getFullYear() + 1).toString();
  const expireDate = `31/08/${expireYear}`;
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>Carte scolaire — ${fullName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #E8EEF5;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 30px 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-title {
      font-size: 12px;
      font-weight: 700;
      color: #546E8A;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      margin-bottom: 20px;
      text-align: center;
    }

    .cards-wrapper {
      display: flex;
      flex-direction: column;
      gap: 28px;
      align-items: center;
      width: 100%;
    }

    .card-label {
      font-size: 10px;
      font-weight: 700;
      color: #78909C;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 6px;
      text-align: center;
    }

    /* ── Card shell — BOTH cards identical size ─────────── */
    .card {
      width: 640px;
      min-height: 280px;
      border-radius: 10px;
      overflow: hidden;
      box-shadow:
        0 4px 6px rgba(0,0,0,0.08),
        0 12px 28px rgba(0,0,0,0.14),
        0 0 0 1px rgba(0,0,0,0.06);
      background: #FFFFFF;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* Make both cards the exact same rendered height */
    .card.card-front { height: 320px; }
    .card.card-back  { height: 320px; }

    /* ════════════════════════════════════════════════════════
       FRONT CARD
       ════════════════════════════════════════════════════════ */

    /* Top header bar */
    .front-header {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 40%, #1976D2 100%);
      display: flex;
      align-items: center;
      padding: 12px 18px;
      gap: 14px;
      position: relative;
    }

    /* Light blue accent stripe at very top */
    .front-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #40C4FF, #00B0FF, #40C4FF);
    }

    .header-logo-box {
      width: 52px; height: 52px;
      background: rgba(255,255,255,0.15);
      border: 1.5px solid rgba(255,255,255,0.35);
      border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.7);
      text-align: center; line-height: 1.3;
      flex-shrink: 0;
    }
    .header-title {
      flex: 1;
    }
    .header-school-name {
      font-size: 17px;
      font-weight: 800;
      color: #FFFFFF;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      line-height: 1.2;
    }
    .header-slogan {
      font-size: 9px;
      color: #90CAF9;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .header-badge {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.25);
      border-radius: 4px;
      padding: 4px 10px;
      font-size: 9px;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }

    /* Card body — flex-grow fills the space between header and footer */
    .front-body {
      display: flex;
      padding: 16px 18px 14px;
      gap: 18px;
      background: #FFFFFF;
      flex: 1;
    }

    /* Photo section */
    .photo-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .photo-wrap {
      width: 108px;
      height: 132px;
      border: 2px solid #1565C0;
      border-radius: 4px;
      overflow: hidden;
      background: #ECF4FE;
      position: relative;
    }
    .photo-wrap img {
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .photo-placeholder {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 4px;
    }
    .photo-placeholder-icon {
      width: 48px; height: 48px;
      border: 2px dashed #90CAF9;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
    }
    .photo-placeholder-icon svg { fill: #90CAF9; }
    .photo-placeholder-text {
      font-size: 8px; color: #90CAF9;
      text-transform: uppercase; letter-spacing: 0.06em;
    }

    /* Blue diagonal accent left of photo */
    .photo-accent {
      position: absolute;
      top: 0; left: 0;
      width: 0; height: 0;
      border-style: solid;
      border-width: 22px 22px 0 0;
      border-color: #1565C0 transparent transparent transparent;
    }

    /* Fields */
    .fields-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0;
    }

    .field-row {
      display: flex;
      align-items: baseline;
      padding: 5px 0;
      border-bottom: 1px dashed #E3F0FC;
    }
    .field-row:last-child { border-bottom: none; }

    .field-label {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      width: 112px;
      flex-shrink: 0;
    }
    .field-colon {
      font-size: 10px;
      color: #1565C0;
      margin: 0 6px;
      font-weight: 700;
    }
    .field-value {
      font-size: 11px;
      color: #1A237E;
      font-weight: 600;
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .field-value.large {
      font-size: 12px;
      font-weight: 700;
    }
    .field-value.mono {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      color: #0D47A1;
      letter-spacing: 0.05em;
    }

    /* Front footer */
    .front-footer {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 18px;
    }
    .footer-address {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .footer-address span {
      font-size: 8.5px;
      color: #BBDEFB;
      letter-spacing: 0.02em;
    }
    .footer-address span strong {
      color: #FFFFFF;
    }
    .signature-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
    }
    .signature-line {
      width: 100px;
      height: 1px;
      background: rgba(255,255,255,0.5);
    }
    .signature-title {
      font-size: 8.5px;
      color: #90CAF9;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Blue accent decorative right of footer */
    .footer-accent {
      width: 18px;
      height: 100%;
      background: rgba(255,255,255,0.08);
      position: absolute;
      right: 0; top: 0;
      clip-path: polygon(100% 0, 0% 100%, 100% 100%);
    }

    /* ════════════════════════════════════════════════════════
       BACK CARD
       ════════════════════════════════════════════════════════ */

    .back-header {
      background: linear-gradient(90deg, #0D47A1 0%, #1565C0 50%, #1976D2 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      position: relative;
    }
    .back-header::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, #40C4FF, #00B0FF, #40C4FF);
    }
    .back-header-title {
      font-size: 13px;
      font-weight: 800;
      color: #FFFFFF;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .back-dates {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .back-date-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .back-date-label {
      font-size: 8px;
      color: #90CAF9;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-weight: 600;
    }
    .back-date-value {
      font-size: 9px;
      color: #FFFFFF;
      font-weight: 700;
    }

    /* Back body — flex-grow to fill remaining space like the front */
    .back-body {
      padding: 14px 18px;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }

    .terms-title {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 2px;
    }
    .terms-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .terms-list li {
      font-size: 9px;
      color: #546E8A;
      line-height: 1.5;
      padding-left: 12px;
      position: relative;
    }
    .terms-list li::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #1565C0;
      font-weight: 700;
    }

    /* Back footer */
    .back-footer {
      background: #F5F8FF;
      border-top: 2px solid #1565C0;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .contact-col {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .contact-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .contact-label {
      font-size: 9px;
      font-weight: 700;
      color: #1565C0;
      width: 50px;
      flex-shrink: 0;
    }
    .contact-value {
      font-size: 9px;
      color: #37474F;
      font-weight: 500;
    }
    .back-logo-qr {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
    }
    .back-logo-box {
      font-size: 9px;
      font-weight: 800;
      color: #1565C0;
      text-align: center;
      line-height: 1.3;
    }
    .qr-box {
      width: 68px; height: 68px;
      border: 1.5px solid #1565C0;
      border-radius: 4px;
      padding: 3px;
      background: white;
    }
    .qr-box img { width: 100%; }

    /* Print hint */
    .no-print {
      margin-top: 28px;
      text-align: center;
      font-size: 12px;
      color: #90A4AE;
    }
    .no-print kbd {
      background: #ECEFF1;
      border: 1px solid #CFD8DC;
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 11px;
    }
  </style>
</head>
<body>
  <div class="page-title">Carte scolaire — Année ${yearLabel}</div>

  <div class="cards-wrapper">

    <!-- ═══════ RECTO ═══════ -->
    <div>
      <div class="card-label">Recto</div>
      <div class="card card-front">

        <!-- Header -->
        <div class="front-header">
          <div class="header-logo-box">LOGO<br/>HERE</div>
          <div class="header-title">
            <div class="header-school-name">${schoolName}</div>
            <div class="header-slogan">${schoolSlogan}</div>
          </div>
          <div class="header-badge">Carte Scolaire</div>
        </div>

        <!-- Body -->
        <div class="front-body">

          <!-- Photo -->
          <div class="photo-col">
            <div class="photo-wrap">
              <div class="photo-accent"></div>
              ${photoSrc ? `<img src="${photoSrc}" alt="Photo"/>` : `<div class="photo-placeholder">
                    <div class="photo-placeholder-icon">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                    <div class="photo-placeholder-text">Photo</div>
                  </div>`}
            </div>
          </div>

          <!-- Fields -->
          <div class="fields-col">
            <div class="field-row">
              <span class="field-label">Matricule</span>
              <span class="field-colon">:</span>
              <span class="field-value mono">${matricule}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Nom complet</span>
              <span class="field-colon">:</span>
              <span class="field-value large">${fullName}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Date de naissance</span>
              <span class="field-colon">:</span>
              <span class="field-value">${birthDate}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Père / Tuteur</span>
              <span class="field-colon">:</span>
              <span class="field-value">${guardian}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Classe</span>
              <span class="field-colon">:</span>
              <span class="field-value large">${className}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Urgence</span>
              <span class="field-colon">:</span>
              <span class="field-value">${guardianPhone}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="front-footer" style="position:relative">
          <div class="footer-address">
            <span><strong>Adresse :</strong> ${schoolAddress}</span>
            <span><strong>Tél :</strong> ${schoolPhone}</span>
          </div>
          <div class="signature-area">
            <div style="height:18px"></div>
            <div class="signature-line"></div>
            <div class="signature-title">Le Directeur</div>
          </div>
        </div>

      </div>
    </div>

    <!-- ═══════ VERSO ═══════ -->
    <div>
      <div class="card-label">Verso</div>
      <div class="card card-back">

        <!-- Header -->
        <div class="back-header">
          <div class="back-header-title">Termes et Conditions</div>
          <div class="back-dates">
            <div class="back-date-row">
              <span class="back-date-label">Date d'entrée :</span>
              <span class="back-date-value">${joinedDate}</span>
            </div>
            <div class="back-date-row">
              <span class="back-date-label">Expire le :</span>
              <span class="back-date-value">${expireDate}</span>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="back-body">
          <ul class="terms-list">
            <li>Cette carte est strictement personnelle et non transférable. Elle doit être présentée à toute demande d'un membre du personnel de l'établissement.</li>
            <li>En cas de perte ou de vol, le titulaire est tenu d'en informer immédiatement la direction. Des frais de remplacement pourront être appliqués.</li>
            <li>Toute falsification ou utilisation frauduleuse de cette carte entraînera des sanctions disciplinaires et pourra faire l'objet de poursuites.</li>
          </ul>
        </div>

        <!-- Footer -->
        <div class="back-footer">
          <div class="contact-col">
            <div class="contact-row">
              <span class="contact-label">Téléphone</span>
              <span class="contact-value">${schoolPhone}</span>
            </div>
            <div class="contact-row">
              <span class="contact-label">Email</span>
              <span class="contact-value">${schoolEmail}</span>
            </div>
            <div class="contact-row">
              <span class="contact-label">Site web</span>
              <span class="contact-value">${schoolWebsite}</span>
            </div>
          </div>
          <div class="back-logo-qr">
            <div class="back-logo-box">${schoolName}</div>
            <div class="qr-box">
              <img src="${qrDataUri}" alt="QR Code de vérification"/>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>

  <div class="no-print">
    Appuyez sur <kbd>Ctrl+P</kbd> pour imprimer · Choisissez "Enregistrer en PDF" pour sauvegarder
  </div>
</body>
</html>`;
}
function registerPrintCardIpc(db) {
  electron.ipcMain.handle("students:printCard", async (_, studentId) => {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            orderBy: { enrolledAt: "desc" },
            take: 1,
            include: {
              class: { include: { level: true } },
              academicYear: true
            }
          },
          parents: { include: { parent: true }, take: 1 }
        }
      });
      if (!student) return fail$1("Élève introuvable");
      const school = await db.school.findFirst();
      const html = await buildCardHtml(student, school);
      const win = new electron.BrowserWindow({
        width: 720,
        height: 820,
        title: `Carte scolaire — ${student.lastName} ${student.firstName}`,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false
        }
      });
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      win.once("ready-to-show", () => {
        win.show();
        setTimeout(() => win.focus(), 150);
      });
      return ok$1({ opened: true });
    } catch (e) {
      return fail$1(e.message);
    }
  });
  electron.ipcMain.handle("students:saveCardPdf", async (_, studentId) => {
    try {
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: {
          enrollments: {
            orderBy: { enrolledAt: "desc" },
            take: 1,
            include: { class: true, academicYear: true }
          },
          parents: { include: { parent: true }, take: 1 }
        }
      });
      if (!student) return fail$1("Élève introuvable");
      const { canceled, filePath } = await electron.dialog.showSaveDialog({
        title: "Enregistrer la carte scolaire en PDF",
        defaultPath: `carte-scolaire-${student.matricule ?? student.id}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (canceled || !filePath) return ok$1(null);
      const school = await db.school.findFirst();
      const html = await buildCardHtml(student, school);
      const win = new electron.BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false }
      });
      await new Promise((resolve, reject) => {
        win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        win.webContents.once("did-finish-load", async () => {
          try {
            const pdfBuffer = await win.webContents.printToPDF({
              printBackground: true,
              pageSize: "A4",
              landscape: false
            });
            require("fs").writeFileSync(filePath, pdfBuffer);
            win.destroy();
            resolve();
          } catch (err) {
            win.destroy();
            reject(err);
          }
        });
      });
      return ok$1({ filePath });
    } catch (e) {
      return fail$1(e.message);
    }
  });
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var dayjs_min = { exports: {} };
(function(module2, exports2) {
  !function(t, e) {
    module2.exports = e();
  }(commonjsGlobal, function() {
    var t = 1e3, e = 6e4, n = 36e5, r = "millisecond", i = "second", s = "minute", u = "hour", a = "day", o = "week", c = "month", f = "quarter", h = "year", d = "date", l = "Invalid Date", $ = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/, y = /\[([^\]]+)]|YYYY|YY|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, M = { name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_"), ordinal: function(t2) {
      var e2 = ["th", "st", "nd", "rd"], n2 = t2 % 100;
      return "[" + t2 + (e2[(n2 - 20) % 10] || e2[n2] || e2[0]) + "]";
    } }, m = function(t2, e2, n2) {
      var r2 = String(t2);
      return !r2 || r2.length >= e2 ? t2 : "" + Array(e2 + 1 - r2.length).join(n2) + t2;
    }, v = { s: m, z: function(t2) {
      var e2 = -t2.utcOffset(), n2 = Math.abs(e2), r2 = Math.floor(n2 / 60), i2 = n2 % 60;
      return (e2 <= 0 ? "+" : "-") + m(r2, 2, "0") + ":" + m(i2, 2, "0");
    }, m: function t2(e2, n2) {
      if (e2.date() < n2.date()) return -t2(n2, e2);
      var r2 = 12 * (n2.year() - e2.year()) + (n2.month() - e2.month()), i2 = e2.clone().add(r2, c), s2 = n2 - i2 < 0, u2 = e2.clone().add(r2 + (s2 ? -1 : 1), c);
      return +(-(r2 + (n2 - i2) / (s2 ? i2 - u2 : u2 - i2)) || 0);
    }, a: function(t2) {
      return t2 < 0 ? Math.ceil(t2) || 0 : Math.floor(t2);
    }, p: function(t2) {
      return { M: c, y: h, w: o, d: a, D: d, h: u, m: s, s: i, ms: r, Q: f }[t2] || String(t2 || "").toLowerCase().replace(/s$/, "");
    }, u: function(t2) {
      return void 0 === t2;
    } }, g = "en", D = {};
    D[g] = M;
    var p = "$isDayjsObject", S = function(t2) {
      return t2 instanceof _ || !(!t2 || !t2[p]);
    }, w = function t2(e2, n2, r2) {
      var i2;
      if (!e2) return g;
      if ("string" == typeof e2) {
        var s2 = e2.toLowerCase();
        D[s2] && (i2 = s2), n2 && (D[s2] = n2, i2 = s2);
        var u2 = e2.split("-");
        if (!i2 && u2.length > 1) return t2(u2[0]);
      } else {
        var a2 = e2.name;
        D[a2] = e2, i2 = a2;
      }
      return !r2 && i2 && (g = i2), i2 || !r2 && g;
    }, O = function(t2, e2) {
      if (S(t2)) return t2.clone();
      var n2 = "object" == typeof e2 ? e2 : {};
      return n2.date = t2, n2.args = arguments, new _(n2);
    }, b = v;
    b.l = w, b.i = S, b.w = function(t2, e2) {
      return O(t2, { locale: e2.$L, utc: e2.$u, x: e2.$x, $offset: e2.$offset });
    };
    var _ = function() {
      function M2(t2) {
        this.$L = w(t2.locale, null, true), this.parse(t2), this.$x = this.$x || t2.x || {}, this[p] = true;
      }
      var m2 = M2.prototype;
      return m2.parse = function(t2) {
        this.$d = function(t3) {
          var e2 = t3.date, n2 = t3.utc;
          if (null === e2) return /* @__PURE__ */ new Date(NaN);
          if (b.u(e2)) return /* @__PURE__ */ new Date();
          if (e2 instanceof Date) return new Date(e2);
          if ("string" == typeof e2 && !/Z$/i.test(e2)) {
            var r2 = e2.match($);
            if (r2) {
              var i2 = r2[2] - 1 || 0, s2 = (r2[7] || "0").substring(0, 3);
              return n2 ? new Date(Date.UTC(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2)) : new Date(r2[1], i2, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, s2);
            }
          }
          return new Date(e2);
        }(t2), this.init();
      }, m2.init = function() {
        var t2 = this.$d;
        this.$y = t2.getFullYear(), this.$M = t2.getMonth(), this.$D = t2.getDate(), this.$W = t2.getDay(), this.$H = t2.getHours(), this.$m = t2.getMinutes(), this.$s = t2.getSeconds(), this.$ms = t2.getMilliseconds();
      }, m2.$utils = function() {
        return b;
      }, m2.isValid = function() {
        return !(this.$d.toString() === l);
      }, m2.isSame = function(t2, e2) {
        var n2 = O(t2);
        return this.startOf(e2) <= n2 && n2 <= this.endOf(e2);
      }, m2.isAfter = function(t2, e2) {
        return O(t2) < this.startOf(e2);
      }, m2.isBefore = function(t2, e2) {
        return this.endOf(e2) < O(t2);
      }, m2.$g = function(t2, e2, n2) {
        return b.u(t2) ? this[e2] : this.set(n2, t2);
      }, m2.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, m2.valueOf = function() {
        return this.$d.getTime();
      }, m2.startOf = function(t2, e2) {
        var n2 = this, r2 = !!b.u(e2) || e2, f2 = b.p(t2), l2 = function(t3, e3) {
          var i2 = b.w(n2.$u ? Date.UTC(n2.$y, e3, t3) : new Date(n2.$y, e3, t3), n2);
          return r2 ? i2 : i2.endOf(a);
        }, $2 = function(t3, e3) {
          return b.w(n2.toDate()[t3].apply(n2.toDate("s"), (r2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(e3)), n2);
        }, y2 = this.$W, M3 = this.$M, m3 = this.$D, v2 = "set" + (this.$u ? "UTC" : "");
        switch (f2) {
          case h:
            return r2 ? l2(1, 0) : l2(31, 11);
          case c:
            return r2 ? l2(1, M3) : l2(0, M3 + 1);
          case o:
            var g2 = this.$locale().weekStart || 0, D2 = (y2 < g2 ? y2 + 7 : y2) - g2;
            return l2(r2 ? m3 - D2 : m3 + (6 - D2), M3);
          case a:
          case d:
            return $2(v2 + "Hours", 0);
          case u:
            return $2(v2 + "Minutes", 1);
          case s:
            return $2(v2 + "Seconds", 2);
          case i:
            return $2(v2 + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, m2.endOf = function(t2) {
        return this.startOf(t2, false);
      }, m2.$set = function(t2, e2) {
        var n2, o2 = b.p(t2), f2 = "set" + (this.$u ? "UTC" : ""), l2 = (n2 = {}, n2[a] = f2 + "Date", n2[d] = f2 + "Date", n2[c] = f2 + "Month", n2[h] = f2 + "FullYear", n2[u] = f2 + "Hours", n2[s] = f2 + "Minutes", n2[i] = f2 + "Seconds", n2[r] = f2 + "Milliseconds", n2)[o2], $2 = o2 === a ? this.$D + (e2 - this.$W) : e2;
        if (o2 === c || o2 === h) {
          var y2 = this.clone().set(d, 1);
          y2.$d[l2]($2), y2.init(), this.$d = y2.set(d, Math.min(this.$D, y2.daysInMonth())).$d;
        } else l2 && this.$d[l2]($2);
        return this.init(), this;
      }, m2.set = function(t2, e2) {
        return this.clone().$set(t2, e2);
      }, m2.get = function(t2) {
        return this[b.p(t2)]();
      }, m2.add = function(r2, f2) {
        var d2, l2 = this;
        r2 = Number(r2);
        var $2 = b.p(f2), y2 = function(t2) {
          var e2 = O(l2);
          return b.w(e2.date(e2.date() + Math.round(t2 * r2)), l2);
        };
        if ($2 === c) return this.set(c, this.$M + r2);
        if ($2 === h) return this.set(h, this.$y + r2);
        if ($2 === a) return y2(1);
        if ($2 === o) return y2(7);
        var M3 = (d2 = {}, d2[s] = e, d2[u] = n, d2[i] = t, d2)[$2] || 1, m3 = this.$d.getTime() + r2 * M3;
        return b.w(m3, this);
      }, m2.subtract = function(t2, e2) {
        return this.add(-1 * t2, e2);
      }, m2.format = function(t2) {
        var e2 = this, n2 = this.$locale();
        if (!this.isValid()) return n2.invalidDate || l;
        var r2 = t2 || "YYYY-MM-DDTHH:mm:ssZ", i2 = b.z(this), s2 = this.$H, u2 = this.$m, a2 = this.$M, o2 = n2.weekdays, c2 = n2.months, f2 = n2.meridiem, h2 = function(t3, n3, i3, s3) {
          return t3 && (t3[n3] || t3(e2, r2)) || i3[n3].slice(0, s3);
        }, d2 = function(t3) {
          return b.s(s2 % 12 || 12, t3, "0");
        }, $2 = f2 || function(t3, e3, n3) {
          var r3 = t3 < 12 ? "AM" : "PM";
          return n3 ? r3.toLowerCase() : r3;
        };
        return r2.replace(y, function(t3, r3) {
          return r3 || function(t4) {
            switch (t4) {
              case "YY":
                return String(e2.$y).slice(-2);
              case "YYYY":
                return b.s(e2.$y, 4, "0");
              case "M":
                return a2 + 1;
              case "MM":
                return b.s(a2 + 1, 2, "0");
              case "MMM":
                return h2(n2.monthsShort, a2, c2, 3);
              case "MMMM":
                return h2(c2, a2);
              case "D":
                return e2.$D;
              case "DD":
                return b.s(e2.$D, 2, "0");
              case "d":
                return String(e2.$W);
              case "dd":
                return h2(n2.weekdaysMin, e2.$W, o2, 2);
              case "ddd":
                return h2(n2.weekdaysShort, e2.$W, o2, 3);
              case "dddd":
                return o2[e2.$W];
              case "H":
                return String(s2);
              case "HH":
                return b.s(s2, 2, "0");
              case "h":
                return d2(1);
              case "hh":
                return d2(2);
              case "a":
                return $2(s2, u2, true);
              case "A":
                return $2(s2, u2, false);
              case "m":
                return String(u2);
              case "mm":
                return b.s(u2, 2, "0");
              case "s":
                return String(e2.$s);
              case "ss":
                return b.s(e2.$s, 2, "0");
              case "SSS":
                return b.s(e2.$ms, 3, "0");
              case "Z":
                return i2;
            }
            return null;
          }(t3) || i2.replace(":", "");
        });
      }, m2.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, m2.diff = function(r2, d2, l2) {
        var $2, y2 = this, M3 = b.p(d2), m3 = O(r2), v2 = (m3.utcOffset() - this.utcOffset()) * e, g2 = this - m3, D2 = function() {
          return b.m(y2, m3);
        };
        switch (M3) {
          case h:
            $2 = D2() / 12;
            break;
          case c:
            $2 = D2();
            break;
          case f:
            $2 = D2() / 3;
            break;
          case o:
            $2 = (g2 - v2) / 6048e5;
            break;
          case a:
            $2 = (g2 - v2) / 864e5;
            break;
          case u:
            $2 = g2 / n;
            break;
          case s:
            $2 = g2 / e;
            break;
          case i:
            $2 = g2 / t;
            break;
          default:
            $2 = g2;
        }
        return l2 ? $2 : b.a($2);
      }, m2.daysInMonth = function() {
        return this.endOf(c).$D;
      }, m2.$locale = function() {
        return D[this.$L];
      }, m2.locale = function(t2, e2) {
        if (!t2) return this.$L;
        var n2 = this.clone(), r2 = w(t2, e2, true);
        return r2 && (n2.$L = r2), n2;
      }, m2.clone = function() {
        return b.w(this.$d, this);
      }, m2.toDate = function() {
        return new Date(this.valueOf());
      }, m2.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, m2.toISOString = function() {
        return this.$d.toISOString();
      }, m2.toString = function() {
        return this.$d.toUTCString();
      }, M2;
    }(), Y = _.prototype;
    return O.prototype = Y, [["$ms", r], ["$s", i], ["$m", s], ["$H", u], ["$W", a], ["$M", c], ["$y", h], ["$D", d]].forEach(function(t2) {
      Y[t2[1]] = function(e2) {
        return this.$g(e2, t2[0], t2[1]);
      };
    }), O.extend = function(t2, e2) {
      return t2.$i || (t2(e2, _, O), t2.$i = true), O;
    }, O.locale = w, O.isDayjs = S, O.unix = function(t2) {
      return O(1e3 * t2);
    }, O.en = D[g], O.Ls = D, O.p = {}, O;
  });
})(dayjs_min);
var dayjs_minExports = dayjs_min.exports;
const dayjs = /* @__PURE__ */ getDefaultExportFromCjs(dayjs_minExports);
var customParseFormat$1 = { exports: {} };
(function(module2, exports2) {
  !function(e, t) {
    module2.exports = t();
  }(commonjsGlobal, function() {
    var e = { LTS: "h:mm:ss A", LT: "h:mm A", L: "MM/DD/YYYY", LL: "MMMM D, YYYY", LLL: "MMMM D, YYYY h:mm A", LLLL: "dddd, MMMM D, YYYY h:mm A" }, t = /(\[[^[]*\])|([-_:/.,()\s]+)|(A|a|Q|YYYY|YY?|ww?|MM?M?M?|Do|DD?|hh?|HH?|mm?|ss?|S{1,3}|z|ZZ?)/g, n = /\d/, r = /\d\d/, i = /\d\d?/, o = /\d*[^-_:/,()\s\d]+/, s = {}, a = function(e2) {
      return (e2 = +e2) + (e2 > 68 ? 1900 : 2e3);
    };
    var f = function(e2) {
      return function(t2) {
        this[e2] = +t2;
      };
    }, h = [/[+-]\d\d:?(\d\d)?|Z/, function(e2) {
      (this.zone || (this.zone = {})).offset = function(e3) {
        if (!e3) return 0;
        if ("Z" === e3) return 0;
        var t2 = e3.match(/([+-]|\d\d)/g), n2 = 60 * t2[1] + (+t2[2] || 0);
        return 0 === n2 ? 0 : "+" === t2[0] ? -n2 : n2;
      }(e2);
    }], u = function(e2) {
      var t2 = s[e2];
      return t2 && (t2.indexOf ? t2 : t2.s.concat(t2.f));
    }, d = function(e2, t2) {
      var n2, r2 = s.meridiem;
      if (r2) {
        for (var i2 = 1; i2 <= 24; i2 += 1) if (e2.indexOf(r2(i2, 0, t2)) > -1) {
          n2 = i2 > 12;
          break;
        }
      } else n2 = e2 === (t2 ? "pm" : "PM");
      return n2;
    }, c = { A: [o, function(e2) {
      this.afternoon = d(e2, false);
    }], a: [o, function(e2) {
      this.afternoon = d(e2, true);
    }], Q: [n, function(e2) {
      this.month = 3 * (e2 - 1) + 1;
    }], S: [n, function(e2) {
      this.milliseconds = 100 * +e2;
    }], SS: [r, function(e2) {
      this.milliseconds = 10 * +e2;
    }], SSS: [/\d{3}/, function(e2) {
      this.milliseconds = +e2;
    }], s: [i, f("seconds")], ss: [i, f("seconds")], m: [i, f("minutes")], mm: [i, f("minutes")], H: [i, f("hours")], h: [i, f("hours")], HH: [i, f("hours")], hh: [i, f("hours")], D: [i, f("day")], DD: [r, f("day")], Do: [o, function(e2) {
      var t2 = s.ordinal, n2 = e2.match(/\d+/);
      if (this.day = n2[0], t2) for (var r2 = 1; r2 <= 31; r2 += 1) t2(r2).replace(/\[|\]/g, "") === e2 && (this.day = r2);
    }], w: [i, f("week")], ww: [r, f("week")], M: [i, f("month")], MM: [r, f("month")], MMM: [o, function(e2) {
      var t2 = u("months"), n2 = (u("monthsShort") || t2.map(function(e3) {
        return e3.slice(0, 3);
      })).indexOf(e2) + 1;
      if (n2 < 1) throw new Error();
      this.month = n2 % 12 || n2;
    }], MMMM: [o, function(e2) {
      var t2 = u("months").indexOf(e2) + 1;
      if (t2 < 1) throw new Error();
      this.month = t2 % 12 || t2;
    }], Y: [/[+-]?\d+/, f("year")], YY: [r, function(e2) {
      this.year = a(e2);
    }], YYYY: [/\d{4}/, f("year")], Z: h, ZZ: h };
    function l(n2) {
      var r2, i2;
      r2 = n2, i2 = s && s.formats;
      for (var o2 = (n2 = r2.replace(/(\[[^\]]+])|(LTS?|l{1,4}|L{1,4})/g, function(t2, n3, r3) {
        var o3 = r3 && r3.toUpperCase();
        return n3 || i2[r3] || e[r3] || i2[o3].replace(/(\[[^\]]+])|(MMMM|MM|DD|dddd)/g, function(e2, t3, n4) {
          return t3 || n4.slice(1);
        });
      })).match(t), a2 = o2.length, f2 = 0; f2 < a2; f2 += 1) {
        var h2 = o2[f2], u2 = c[h2], d2 = u2 && u2[0], l2 = u2 && u2[1];
        o2[f2] = l2 ? { regex: d2, parser: l2 } : h2.replace(/^\[|\]$/g, "");
      }
      return function(e2) {
        for (var t2 = {}, n3 = 0, r3 = 0; n3 < a2; n3 += 1) {
          var i3 = o2[n3];
          if ("string" == typeof i3) r3 += i3.length;
          else {
            var s2 = i3.regex, f3 = i3.parser, h3 = e2.slice(r3), u3 = s2.exec(h3)[0];
            f3.call(t2, u3), e2 = e2.replace(u3, "");
          }
        }
        return function(e3) {
          var t3 = e3.afternoon;
          if (void 0 !== t3) {
            var n4 = e3.hours;
            t3 ? n4 < 12 && (e3.hours += 12) : 12 === n4 && (e3.hours = 0), delete e3.afternoon;
          }
        }(t2), t2;
      };
    }
    return function(e2, t2, n2) {
      n2.p.customParseFormat = true, e2 && e2.parseTwoDigitYear && (a = e2.parseTwoDigitYear);
      var r2 = t2.prototype, i2 = r2.parse;
      r2.parse = function(e3) {
        var t3 = e3.date, r3 = e3.utc, o2 = e3.args;
        this.$u = r3;
        var a2 = o2[1];
        if ("string" == typeof a2) {
          var f2 = true === o2[2], h2 = true === o2[3], u2 = f2 || h2, d2 = o2[2];
          h2 && (d2 = o2[2]), s = this.$locale(), !f2 && d2 && (s = n2.Ls[d2]), this.$d = function(e4, t4, n3, r4) {
            try {
              if (["x", "X"].indexOf(t4) > -1) return new Date(("X" === t4 ? 1e3 : 1) * e4);
              var i3 = l(t4)(e4), o3 = i3.year, s2 = i3.month, a3 = i3.day, f3 = i3.hours, h3 = i3.minutes, u3 = i3.seconds, d3 = i3.milliseconds, c3 = i3.zone, m2 = i3.week, M2 = /* @__PURE__ */ new Date(), Y = a3 || (o3 || s2 ? 1 : M2.getDate()), p = o3 || M2.getFullYear(), v = 0;
              o3 && !s2 || (v = s2 > 0 ? s2 - 1 : M2.getMonth());
              var D, w = f3 || 0, g = h3 || 0, y = u3 || 0, L = d3 || 0;
              return c3 ? new Date(Date.UTC(p, v, Y, w, g, y, L + 60 * c3.offset * 1e3)) : n3 ? new Date(Date.UTC(p, v, Y, w, g, y, L)) : (D = new Date(p, v, Y, w, g, y, L), m2 && (D = r4(D).week(m2).toDate()), D);
            } catch (e5) {
              return /* @__PURE__ */ new Date("");
            }
          }(t3, a2, r3, n2), this.init(), d2 && true !== d2 && (this.$L = this.locale(d2).$L), u2 && t3 != this.format(a2) && (this.$d = /* @__PURE__ */ new Date("")), s = {};
        } else if (a2 instanceof Array) for (var c2 = a2.length, m = 1; m <= c2; m += 1) {
          o2[1] = a2[m - 1];
          var M = n2.apply(this, o2);
          if (M.isValid()) {
            this.$d = M.$d, this.$L = M.$L, this.init();
            break;
          }
          m === c2 && (this.$d = /* @__PURE__ */ new Date(""));
        }
        else i2.call(this, e3);
      };
    };
  });
})(customParseFormat$1);
var customParseFormatExports = customParseFormat$1.exports;
const customParseFormat = /* @__PURE__ */ getDefaultExportFromCjs(customParseFormatExports);
dayjs.extend(customParseFormat);
function ok(d) {
  return { success: true, data: d };
}
function fail(msg) {
  return { success: false, error: { code: "ERROR", message: msg } };
}
const COLUMNS = [
  { key: "lastName", header: "Nom *", width: 20 },
  { key: "firstName", header: "Prénom *", width: 20 },
  { key: "gender", header: "Sexe * (MASCULIN/FÉMININ)", width: 24 },
  { key: "birthDate", header: "Date de naissance (JJ/MM/AAAA)", width: 26 },
  { key: "birthPlace", header: "Lieu de naissance", width: 20 },
  { key: "nationality", header: "Nationalité", width: 16 },
  { key: "phone", header: "Téléphone", width: 18 },
  { key: "address", header: "Adresse", width: 28 },
  { key: "email", header: "Email", width: 26 }
];
function parseDate(raw) {
  if (!raw) return void 0;
  if (raw instanceof Date) return dayjs(raw).format("YYYY-MM-DD");
  const s = String(raw).trim();
  const parsed = dayjs(s, ["DD/MM/YYYY", "D/M/YYYY", "YYYY-MM-DD"], true);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : void 0;
}
function parseGender(raw) {
  if (!raw) return void 0;
  const s = String(raw).trim().toUpperCase();
  if (s === "MASCULIN" || s === "M" || s === "MALE") return "MALE";
  if (s === "FÉMININ" || s === "FEMININ" || s === "F" || s === "FEMALE") return "FEMALE";
  return void 0;
}
function registerExcelIpc(db) {
  electron.ipcMain.handle("students:downloadTemplate", async () => {
    try {
      const { canceled, filePath } = await electron.dialog.showSaveDialog({
        title: "Enregistrer le modèle d'import",
        defaultPath: "modele-import-eleves.xlsx",
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (canceled || !filePath) return ok(null);
      const wb = new ExcelJS.Workbook();
      wb.creator = "SGSI SchoolManager Pro";
      const ws = wb.addWorksheet("Élèves");
      ws.columns = COLUMNS.map((c) => ({
        header: c.header,
        key: c.key,
        width: c.width
      }));
      const headerRow = ws.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FF0D47A1" } }
        };
      });
      headerRow.height = 26;
      ws.addRow({
        lastName: "BAH",
        firstName: "Amadou",
        gender: "MASCULIN",
        birthDate: "15/08/2010",
        birthPlace: "Conakry",
        nationality: "Guinéenne",
        phone: "+224 620 000 000",
        address: "Quartier Madina",
        email: ""
      });
      const exRow = ws.getRow(2);
      exRow.eachCell((cell) => {
        cell.font = { italic: true, color: { argb: "FF546E8A" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF4FE" } };
      });
      ws.getColumn("A").note = "Obligatoire";
      ws.getColumn("B").note = "Obligatoire";
      ws.getColumn("C").note = "Obligatoire — écrire exactement MASCULIN ou FÉMININ";
      await wb.xlsx.writeFile(filePath);
      return ok({ filePath });
    } catch (e) {
      return fail(e.message);
    }
  });
  electron.ipcMain.handle("students:importExcel", async () => {
    try {
      const { canceled, filePaths } = await electron.dialog.showOpenDialog({
        title: "Sélectionner le fichier Excel des élèves",
        filters: [{ name: "Excel", extensions: ["xlsx", "xls"] }],
        properties: ["openFile"]
      });
      if (canceled || filePaths.length === 0) return ok(null);
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePaths[0]);
      const ws = wb.worksheets[0];
      if (!ws) return fail("Feuille introuvable dans le fichier Excel");
      const rows = [];
      let skipped = 0;
      ws.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const vals = row.values;
        const lastName = String(vals[1] ?? "").trim();
        const firstName = String(vals[2] ?? "").trim();
        const genderRaw = vals[3];
        const gender = parseGender(genderRaw);
        if (!lastName || !firstName) {
          skipped++;
          return;
        }
        rows.push({
          rowNum,
          lastName,
          firstName,
          gender: gender ?? null,
          genderRaw: String(genderRaw ?? "").trim(),
          birthDate: parseDate(vals[4]) ?? null,
          birthPlace: String(vals[5] ?? "").trim() || null,
          nationality: String(vals[6] ?? "").trim() || null,
          phone: String(vals[7] ?? "").trim() || null,
          address: String(vals[8] ?? "").trim() || null,
          email: String(vals[9] ?? "").trim() || null,
          // Validation flags
          valid: !!lastName && !!firstName && !!gender,
          errors: [
            !lastName && "Nom manquant",
            !firstName && "Prénom manquant",
            !gender && `Sexe invalide (reçu: "${String(genderRaw ?? "")}") — écrire MASCULIN ou FÉMININ`
          ].filter(Boolean)
        });
      });
      return ok({ rows, skipped, file: path.basename(filePaths[0]) });
    } catch (e) {
      return fail(e.message);
    }
  });
  electron.ipcMain.handle("students:confirmImport", async (_, rows, actorId) => {
    const validRows = rows.filter((r) => r.valid);
    if (validRows.length === 0) return fail("Aucune ligne valide à importer");
    let created = 0, duplicates = 0, errors = 0;
    const results = [];
    for (const row of validRows) {
      try {
        const existing = await db.student.findFirst({
          where: {
            lastName: { equals: row.lastName, mode: "insensitive" },
            firstName: { equals: row.firstName, mode: "insensitive" },
            ...row.birthDate ? { birthDate: new Date(row.birthDate) } : {}
          }
        });
        if (existing) {
          duplicates++;
          results.push({ ...row, status: "duplicate", message: "Élève déjà existant" });
          continue;
        }
        const school = await db.school.findFirst();
        const sigle = school?.sigle ?? "ECO";
        const year = (/* @__PURE__ */ new Date()).getFullYear();
        const count = await db.student.count();
        const matricule = `${sigle}-${year}-${String(count + 1).padStart(4, "0")}`;
        await db.student.create({
          data: {
            lastName: row.lastName,
            firstName: row.firstName,
            gender: row.gender,
            birthDate: row.birthDate ? new Date(row.birthDate) : void 0,
            birthPlace: row.birthPlace || void 0,
            nationality: row.nationality || void 0,
            phone: row.phone || void 0,
            address: row.address || void 0,
            email: row.email || void 0,
            matricule
          }
        });
        try {
          await db.auditLog.create({ data: { userId: actorId, action: "IMPORT_CREATE", entity: "student", details: matricule } });
        } catch {
        }
        created++;
        results.push({ ...row, status: "created", matricule });
      } catch (e) {
        errors++;
        results.push({ ...row, status: "error", message: e.message });
      }
    }
    return ok({ created, duplicates, errors, results });
  });
  electron.ipcMain.handle("students:exportExcel", async (_, classId) => {
    try {
      const students = await db.student.findMany({
        where: classId ? { enrollments: { some: { classId } } } : void 0,
        include: {
          enrollments: {
            orderBy: { enrolledAt: "desc" },
            take: 1,
            include: { class: true, academicYear: true }
          }
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
      });
      const school = await db.school.findFirst();
      const className = classId ? students[0]?.enrollments[0]?.class?.name ?? "classe" : "tous-les-eleves";
      const defaultName = `eleves-${className}-${dayjs().format("YYYY-MM-DD")}.xlsx`;
      const { canceled, filePath } = await electron.dialog.showSaveDialog({
        title: "Exporter la liste des élèves",
        defaultPath: defaultName,
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (canceled || !filePath) return ok(null);
      const wb = new ExcelJS.Workbook();
      wb.creator = "SGSI SchoolManager Pro";
      const ws = wb.addWorksheet("Élèves");
      ws.columns = [
        { header: "N°", key: "num", width: 6 },
        { header: "Matricule", key: "matricule", width: 20 },
        { header: "Nom", key: "lastName", width: 18 },
        { header: "Prénom", key: "firstName", width: 18 },
        { header: "Sexe", key: "gender", width: 12 },
        { header: "Date naissance", key: "birthDate", width: 16 },
        { header: "Classe", key: "class", width: 14 },
        { header: "Année scolaire", key: "year", width: 16 },
        { header: "Téléphone", key: "phone", width: 18 },
        { header: "Adresse", key: "address", width: 28 }
      ];
      const hRow = ws.getRow(1);
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      hRow.height = 24;
      students.forEach((s, i) => {
        const enroll = s.enrollments[0];
        const row = ws.addRow({
          num: i + 1,
          matricule: s.matricule,
          lastName: s.lastName,
          firstName: s.firstName,
          gender: s.gender === "MALE" ? "MASCULIN" : "FÉMININ",
          birthDate: s.birthDate ? dayjs(s.birthDate).format("DD/MM/YYYY") : "—",
          class: enroll?.class?.name ?? "—",
          year: enroll?.academicYear?.name ?? "—",
          phone: s.phone ?? "—",
          address: s.address ?? "—"
        });
        if (i % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF4FE" } };
          });
        }
      });
      ws.addRow({});
      const totalRow = ws.addRow({ num: "", matricule: `Total : ${students.length} élève(s)` });
      totalRow.getCell("matricule").font = { bold: true, color: { argb: "FF1565C0" } };
      await wb.xlsx.writeFile(filePath);
      return ok({ filePath, count: students.length });
    } catch (e) {
      return fail(e.message);
    }
  });
  electron.ipcMain.handle("payments:exportExcel", async (_, year) => {
    try {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      const payments = await db.payment.findMany({
        where: {
          paidAt: { gte: start, lte: end },
          method: { not: "PLAN" }
          // exclude plan containers
        },
        include: {
          feeType: true,
          enrollment: {
            include: {
              student: true,
              class: true
            }
          }
        },
        orderBy: { paidAt: "asc" }
      });
      const { canceled, filePath } = await electron.dialog.showSaveDialog({
        title: "Exporter les paiements",
        defaultPath: `paiements-${year}.xlsx`,
        filters: [{ name: "Excel", extensions: ["xlsx"] }]
      });
      if (canceled || !filePath) return ok(null);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(`Paiements ${year}`);
      ws.columns = [
        { header: "N°", key: "num", width: 6 },
        { header: "Date", key: "date", width: 14 },
        { header: "N° Reçu", key: "receipt", width: 18 },
        { header: "Élève", key: "student", width: 24 },
        { header: "Matricule", key: "matricule", width: 18 },
        { header: "Classe", key: "class", width: 14 },
        { header: "Motif", key: "feeType", width: 22 },
        { header: "Montant (GNF)", key: "amount", width: 18 },
        { header: "Mode", key: "method", width: 16 },
        { header: "Remarque", key: "note", width: 24 }
      ];
      const hRow = ws.getRow(1);
      hRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1565C0" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
      hRow.height = 24;
      const METHODS = {
        CASH: "Espèces",
        ORANGE_MONEY: "Orange Money",
        WAVE: "Wave",
        MOBILE_MONEY: "Mobile Money",
        BANK_TRANSFER: "Virement"
      };
      let total = 0;
      payments.forEach((p, i) => {
        total += p.amount;
        const row = ws.addRow({
          num: i + 1,
          date: dayjs(p.paidAt).format("DD/MM/YYYY HH:mm"),
          receipt: p.receiptNo,
          student: `${p.enrollment?.student?.lastName} ${p.enrollment?.student?.firstName}`,
          matricule: p.enrollment?.student?.matricule ?? "—",
          class: p.enrollment?.class?.name ?? "—",
          feeType: p.feeType?.name ?? "—",
          amount: p.amount,
          method: METHODS[p.method] ?? p.method,
          note: p.note ?? ""
        });
        if (i % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECF4FE" } };
          });
        }
        row.getCell("amount").numFmt = "#,##0";
      });
      ws.addRow({});
      const totRow = ws.addRow({ num: "", date: "TOTAL", amount: total });
      totRow.getCell("date").font = { bold: true, color: { argb: "FF1565C0" } };
      totRow.getCell("amount").font = { bold: true, color: { argb: "FF1565C0" } };
      totRow.getCell("amount").numFmt = "#,##0";
      await wb.xlsx.writeFile(filePath);
      return ok({ filePath, count: payments.length, total });
    } catch (e) {
      return fail(e.message);
    }
  });
}
function registerDisciplineIpc(db) {
  electron.ipcMain.handle("discipline:listByStudent", async (_, studentId) => {
    try {
      return ok$c(await db.disciplinaryRecord.findMany({
        where: { studentId },
        include: { student: { select: { firstName: true, lastName: true, matricule: true } } },
        orderBy: { date: "desc" }
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:listAll", async (_, filters) => {
    try {
      return ok$c(await db.disciplinaryRecord.findMany({
        where: {
          ...filters?.resolved !== void 0 ? { resolved: filters.resolved } : {},
          ...filters?.type ? { type: filters.type } : {}
        },
        include: {
          student: {
            select: { firstName: true, lastName: true, matricule: true },
            include: { enrollments: { where: { status: "ACTIVE" }, include: { class: { select: { name: true } } }, take: 1 } }
          }
        },
        orderBy: { date: "desc" },
        take: filters?.limit ?? 100
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:create", async (_, data, issuedBy) => {
    try {
      const rec = await db.disciplinaryRecord.create({
        data: {
          studentId: data.studentId,
          type: data.type,
          description: data.description,
          sanction: data.sanction ?? null,
          note: data.note ?? null,
          issuedBy,
          date: data.date ? new Date(data.date) : /* @__PURE__ */ new Date()
        },
        include: { student: { select: { firstName: true, lastName: true } } }
      });
      try {
        await db.auditLog.create({
          data: { userId: issuedBy, action: "CREATE", entity: "discipline", entityId: rec.id, details: `type:${data.type}` }
        });
      } catch {
      }
      return ok$c(rec);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:resolve", async (_, id, note) => {
    try {
      return ok$c(await db.disciplinaryRecord.update({
        where: { id },
        data: { resolved: true, resolvedAt: /* @__PURE__ */ new Date(), note: note ?? null }
      }));
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:delete", async (_, id) => {
    try {
      await db.disciplinaryRecord.delete({ where: { id } });
      return ok$c(null);
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:stats", async (_, studentId) => {
    try {
      const records = await db.disciplinaryRecord.findMany({ where: { studentId } });
      const byType = {};
      records.forEach((r) => {
        byType[r.type] = (byType[r.type] ?? 0) + 1;
      });
      return ok$c({ total: records.length, active: records.filter((r) => !r.resolved).length, byType });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("discipline:globalStats", async () => {
    try {
      const [total, active, recent] = await Promise.all([
        db.disciplinaryRecord.count(),
        db.disciplinaryRecord.count({ where: { resolved: false } }),
        db.disciplinaryRecord.findMany({
          where: { resolved: false },
          include: {
            student: {
              select: { firstName: true, lastName: true, matricule: true },
              include: { enrollments: { where: { status: "ACTIVE" }, include: { class: { select: { name: true } } }, take: 1 } }
            }
          },
          orderBy: { date: "desc" },
          take: 5
        })
      ]);
      return ok$c({ total, active, recent });
    } catch (e) {
      return fail$c("ERROR", e.message);
    }
  });
}
class RelanceService {
  constructor(db) {
    this.db = db;
  }
  async getOverdueParents(thresholdDays = 30) {
    const enrollments = await this.db.enrollment.findMany({
      where: { status: "ACTIVE" },
      include: {
        student: {
          include: {
            parents: { include: { parent: true } }
          }
        },
        class: { include: { level: true } },
        payments: true
      }
    });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
    const results = [];
    for (const e of enrollments) {
      const feeTypes = await this.db.feeType.findMany({
        where: { OR: [{ levelId: e.class.levelId }, { levelId: null }], isRequired: true }
      });
      const totalDue = feeTypes.reduce((s, f) => s + f.amount, 0);
      const totalPaid = e.payments.reduce((s, p) => s + p.amount, 0);
      const balance = totalDue - totalPaid;
      if (balance <= 0) continue;
      const enrolledAt = e.createdAt ?? /* @__PURE__ */ new Date();
      const daysOverdue = Math.floor((Date.now() - new Date(enrolledAt).getTime()) / (1e3 * 60 * 60 * 24));
      if (daysOverdue < thresholdDays) continue;
      const link = e.student.parents?.[0];
      const parent = link?.parent ?? null;
      const lastLog = parent ? await this.db.reminderLog.findFirst({
        where: { studentId: e.studentId, parentId: parent.id },
        orderBy: { sentAt: "desc" }
      }) : null;
      const alreadyReminded = lastLog ? new Date(lastLog.sentAt) > sevenDaysAgo : false;
      const hasPhone = !!parent?.phone;
      const hasEmail = !!parent?.email;
      const channel = hasPhone && hasEmail ? "BOTH" : hasPhone ? "SMS" : hasEmail ? "EMAIL" : "NONE";
      results.push({
        studentId: e.studentId,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        className: e.class.name,
        amountDue: totalDue,
        amountPaid: totalPaid,
        balance,
        daysOverdue,
        parentId: parent?.id ?? "",
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : "Inconnu",
        phone: parent?.phone ?? null,
        email: parent?.email ?? null,
        channel,
        lastRemindedAt: lastLog ? new Date(lastLog.sentAt) : null,
        alreadyReminded
      });
    }
    return results;
  }
  async sendReminders(parentIds) {
    const config = loadBrevoConfig();
    if (!config?.apiKey) throw new Error("Brevo non configure. Allez dans Parametres > Email.");
    const school = await this.db.school.findFirst();
    const schoolName = school?.name ?? "Notre etablissement";
    const schoolPhone = school?.phone ?? "";
    const currency = school?.currency ?? "GNF";
    const overdueList = await this.getOverdueParents(0);
    const targets = overdueList.filter((o) => parentIds.includes(o.parentId));
    let sent = 0, failed = 0, skipped = 0;
    for (const target of targets) {
      if (target.channel === "NONE") {
        skipped++;
        continue;
      }
      const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toLocaleDateString("fr-FR");
      const smsText = `Bonjour ${target.parentName}, votre enfant ${target.studentName} a un impaye de ${target.balance.toLocaleString("fr-FR")} ${currency}. Merci de regulariser avant le ${deadlineDate}. ${schoolName} - ${schoolPhone}`;
      const emailHtml = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px"><h2 style="color:#1e3a8a">${schoolName}</h2><p>Bonjour <strong>${target.parentName}</strong>,</p><p>Votre enfant <strong>${target.studentName}</strong> (Classe : ${target.className}) a un solde impaye de <strong style="color:#dc2626">${target.balance.toLocaleString("fr-FR")} ${currency}</strong>.</p><p>Merci de regulariser avant le <strong>${deadlineDate}</strong>.</p><p>Contact : <strong>${schoolPhone}</strong></p><p style="color:#6b7280;font-size:12px">-- ${schoolName}</p></div>`;
      let status = "SENT";
      let errorMsg;
      try {
        if (target.channel === "SMS" || target.channel === "BOTH") {
          await sendSms({ to: target.phone, message: smsText, sender: "SGSI" });
        }
        if ((target.channel === "EMAIL" || target.channel === "BOTH") && target.email) {
          await sendEmail({
            to: target.email,
            subject: `Rappel de paiement - ${target.studentName}`,
            html: emailHtml,
            text: smsText
          });
        }
        sent++;
      } catch (e) {
        status = "FAILED";
        errorMsg = e.message;
        failed++;
      }
      await this.db.reminderLog.create({
        data: {
          parentId: target.parentId,
          studentId: target.studentId,
          amountDue: target.balance,
          channel: target.channel,
          status,
          errorMsg,
          schoolYear: (/* @__PURE__ */ new Date()).getFullYear().toString()
        }
      });
    }
    return { sent, failed, skipped };
  }
  async getReminderHistory() {
    return this.db.reminderLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 200,
      include: {
        parent: { select: { firstName: true, lastName: true } },
        student: { select: { firstName: true, lastName: true } }
      }
    });
  }
  async generateLettersHtml(parentIds) {
    const school = await this.db.school.findFirst();
    const schoolName = school?.name ?? "Notre Etablissement";
    const schoolAddr = school?.address ?? "";
    const schoolPhone = school?.phone ?? "";
    const dirName = school?.directorName ?? "Le Directeur";
    const currency = school?.currency ?? "GNF";
    const today = (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toLocaleDateString("fr-FR");
    const overdueList = await this.getOverdueParents(0);
    const targets = overdueList.filter((o) => parentIds.includes(o.parentId));
    const pageStyle = `<style>
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
    </style>`;
    const letters = targets.map(
      (t) => `<div class="letter">
        <div class="header">
          <div class="school-info">
            <div style="font-size:16pt">${schoolName}</div>
            <div>${schoolAddr}</div>
            <div>Tel : ${schoolPhone}</div>
            <hr/>
          </div>
          <div class="date-loc">Conakry, le ${today}</div>
        </div>
        <div style="margin-bottom:24px">
          <strong>A l'attention de :</strong><br/>
          ${t.parentName}<br/>
          <em>Parent/Tuteur de ${t.studentName}</em>
        </div>
        <div class="object">Objet : Rappel de paiement - ${t.studentName} (${t.className})</div>
        <div class="body-text">
          <p>Monsieur / Madame ${t.parentName},</p>
          <p>Nous vous informons que le compte de votre enfant <strong>${t.studentName}</strong>,
          inscrit en classe de <strong>${t.className}</strong>, presente un solde impaye de
          <strong>${t.balance.toLocaleString("fr-FR")} ${currency}</strong> a la date du ${today}.</p>
          <p>Nous vous prions de bien vouloir regulariser votre situation dans un delai de
          <strong>7 jours</strong> a compter de la reception de ce courrier,
          soit au plus tard le <strong>${deadline}</strong>.</p>
          <p>Pour tout renseignement, veuillez contacter notre service de comptabilite
          au <strong>${schoolPhone}</strong>.</p>
          <p>Nous vous remercions de votre comprehension.</p>
        </div>
        <div class="signature">
          <p>${dirName}</p>
          <div class="sig-line"></div>
          <p><em>(Signature et cachet)</em></p>
        </div>
      </div>`
    );
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>${pageStyle}</head><body>${letters.join("")}</body></html>`;
  }
}
function registerRelancesIpc(db) {
  const service = new RelanceService(db);
  electron.ipcMain.handle("relances:list", async (_, thresholdDays = 30) => {
    try {
      return ok$c(await service.getOverdueParents(thresholdDays));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("relances:send", async (_, parentIds) => {
    try {
      return ok$c(await service.sendReminders(parentIds));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("relances:history", async () => {
    try {
      return ok$c(await service.getReminderHistory());
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("relances:printLetters", async (_, parentIds) => {
    try {
      return ok$c(await service.generateLettersHtml(parentIds));
    } catch (e) {
      return fail$c(e.code ?? "ERROR", e.message);
    }
  });
}
async function checkOverdueAtStartup(db, win) {
  try {
    const service = new RelanceService(db);
    const overdue = await service.getOverdueParents(30);
    if (overdue.length === 0) return;
    const totalBalance = overdue.reduce((s, o) => s + o.balance, 0);
    win.webContents.send("relances:startup-alert", {
      count: overdue.length,
      total: totalBalance,
      currency: "GNF"
    });
  } catch {
  }
}
function registerIpcHandlers(db) {
  const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";
  const dbPath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "../../packages/db/prisma/sgsi.db") : path.join(process.env.APPDATA ?? "", "sgsi", "sgsi.db");
  registerAuthIpc(db, jwtSecret);
  registerStudentsIpc(db);
  registerGradesIpc(db);
  registerPaymentsIpc(db);
  registerBackupIpc(db, dbPath);
  registerSettingsIpc(db);
  registerSubjectsIpc(db);
  registerAbsencesIpc(db);
  registerTeachersIpc(db);
  registerSchedulesIpc(db);
  registerExpensesIpc(db);
  registerParentsIpc(db);
  registerAuditLogIpc(db);
  registerLibraryIpc(db);
  registerMedicalIpc(db);
  registerTransportIpc(db);
  registerNotificationsIpc(db);
  registerDialogIpc();
  registerStudentDocumentIpc(db);
  registerLicenseIpc(db);
  registerMessagesIpc(db);
  registerReportsIpc(db);
  registerPrintCardIpc(db);
  registerExcelIpc(db);
  registerAppreciationIpc();
  registerDisciplineIpc(db);
  registerRelancesIpc(db);
}
const corsMiddleware = cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
});
function authMiddleware(jwtSecret) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token manquant" });
      return;
    }
    try {
      req.user = jwt.verify(header.slice(7), jwtSecret);
      next();
    } catch {
      res.status(401).json({ error: "Token invalide ou expiré" });
    }
  };
}
function authRoutes(db, jwtSecret) {
  const router = express.Router();
  const auth = new AuthService(db, jwtSecret);
  router.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: "username et password requis" });
        return;
      }
      const result = await auth.login(username, password);
      res.json(result);
    } catch (e) {
      res.status(401).json({ error: e.message });
    }
  });
  return router;
}
class AbsenceService {
  constructor(db) {
    this.db = db;
  }
  async record(data, actorId) {
    if (!["ABSENCE", "LATE", "EARLY_LEAVE"].includes(data.type)) {
      throw new ServiceError("INVALID_ABSENCE_TYPE", `Type d'absence invalide: ${data.type}`);
    }
    const absence = await this.db.absence.create({ data });
    await this.tryAudit(actorId, "ABSENCE_RECORDED", "absence", absence.id);
    return absence;
  }
  async listByEnrollment(enrollmentId) {
    return this.db.absence.findMany({
      where: { enrollmentId },
      orderBy: { date: "desc" }
    });
  }
  async listByClass(classId, date) {
    const where = {
      enrollment: { classId }
    };
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }
    return this.db.absence.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true } }
          }
        }
      },
      orderBy: { date: "desc" }
    });
  }
  async justify(absenceId, reason, actorId) {
    const absence = await this.db.absence.findUnique({ where: { id: absenceId } });
    if (!absence) {
      throw new ServiceError("ABSENCE_NOT_FOUND", "Absence introuvable");
    }
    const updated = await this.db.absence.update({
      where: { id: absenceId },
      data: { justified: true, reason }
    });
    await this.tryAudit(actorId, "ABSENCE_JUSTIFIED", "absence", absenceId);
    return updated;
  }
  async countByEnrollment(enrollmentId) {
    const absences = await this.db.absence.findMany({
      where: { enrollmentId, type: "ABSENCE" }
    });
    const justified = absences.filter((a) => a.justified).length;
    return {
      total: absences.length,
      justified,
      unjustified: absences.length - justified
    };
  }
  async tryAudit(userId, action, entity, entityId) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
    } catch {
    }
  }
}
function studentRoutes(db) {
  const router = express.Router();
  const gradeService = new GradeService(db);
  const absenceService = new AbsenceService(db);
  const bulletinService = new BulletinService(db);
  router.get("/:id/grades", async (req, res) => {
    try {
      const period = Number(req.query.period ?? 1);
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: "ACTIVE" }
      });
      if (!enrollment) {
        res.status(404).json({ error: "Inscription introuvable" });
        return;
      }
      const { subjectAverages, generalAverage, isEliminated } = await gradeService.computeAverages(enrollment.id, period);
      res.json({ subjectAverages, generalAverage, isEliminated, period });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id/absences", async (req, res) => {
    try {
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: "ACTIVE" }
      });
      if (!enrollment) {
        res.status(404).json({ error: "Inscription introuvable" });
        return;
      }
      const [absences, counts] = await Promise.all([
        absenceService.listByEnrollment(enrollment.id),
        absenceService.countByEnrollment(enrollment.id)
      ]);
      res.json({ absences, counts });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id/bulletin/:period", async (req, res) => {
    try {
      const period = Number(req.params.period);
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: "ACTIVE" }
      });
      if (!enrollment) {
        res.status(404).json({ error: "Inscription introuvable" });
        return;
      }
      const actorId = req.user?.userId ?? "mobile";
      const result = await bulletinService.generate(enrollment.id, period, actorId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/:id/payments", async (req, res) => {
    try {
      const enrollment = await db.enrollment.findFirst({
        where: { studentId: req.params.id, status: "ACTIVE" },
        include: { payments: { include: { feeType: true } } }
      });
      if (!enrollment) {
        res.status(404).json({ error: "Inscription introuvable" });
        return;
      }
      res.json({ payments: enrollment.payments });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}
function teacherRoutes(db) {
  const router = express.Router();
  const gradeService = new GradeService(db);
  const absenceService = new AbsenceService(db);
  router.get("/schedule", async (req, res) => {
    try {
      const teacherId = req.user?.userId;
      const teacher = await db.teacher.findFirst({ where: { userId: teacherId } });
      if (!teacher) {
        res.status(404).json({ error: "Enseignant introuvable" });
        return;
      }
      const slots = await db.scheduleSlot.findMany({
        where: { teacherId: teacher.id },
        include: {
          class: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } }
        },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }]
      });
      res.json({ slots });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/classes", async (req, res) => {
    try {
      const teacherId = req.user?.userId;
      const teacher = await db.teacher.findFirst({ where: { userId: teacherId } });
      if (!teacher) {
        res.status(404).json({ error: "Enseignant introuvable" });
        return;
      }
      const classes = await db.class.findMany({
        where: {
          subjects: { some: { teacherId: teacher.id } }
        },
        include: {
          _count: { select: { enrollments: true } },
          level: { select: { name: true } }
        }
      });
      res.json({ classes });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.get("/classes/:classId/students", async (req, res) => {
    try {
      const enrollments = await db.enrollment.findMany({
        where: { classId: req.params.classId, status: "ACTIVE" },
        include: { student: { select: { id: true, firstName: true, lastName: true, matricule: true } } },
        orderBy: { student: { lastName: "asc" } }
      });
      res.json({ students: enrollments.map((e) => ({ ...e.student, enrollmentId: e.id })) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/grades", async (req, res) => {
    try {
      const { grades } = req.body;
      if (!Array.isArray(grades)) {
        res.status(400).json({ error: "grades doit être un tableau" });
        return;
      }
      const actorId = req.user?.userId ?? "mobile";
      const saved = await Promise.allSettled(grades.map((g) => gradeService.save(g, actorId)));
      res.json({ saved: saved.filter((r) => r.status === "fulfilled").length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/absences", async (req, res) => {
    try {
      const { absences } = req.body;
      if (!Array.isArray(absences)) {
        res.status(400).json({ error: "absences doit être un tableau" });
        return;
      }
      const actorId = req.user?.userId ?? "mobile";
      const saved = await Promise.allSettled(absences.map((a) => absenceService.record(a, actorId)));
      res.json({ saved: saved.filter((r) => r.status === "fulfilled").length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/grades", async (req, res) => {
    try {
      const { grades } = req.body;
      if (!Array.isArray(grades)) {
        res.status(400).json({ error: "grades doit être un tableau" });
        return;
      }
      const actorId = req.user?.userId ?? req.params.id;
      const saved = await Promise.allSettled(
        grades.map((g) => gradeService.save(g, actorId))
      );
      const succeeded = saved.filter((r) => r.status === "fulfilled").length;
      const failed = saved.filter((r) => r.status === "rejected").map((r) => r.reason?.message);
      res.json({ saved: succeeded, failed });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  router.post("/:id/absences", async (req, res) => {
    try {
      const { absences } = req.body;
      if (!Array.isArray(absences)) {
        res.status(400).json({ error: "absences doit être un tableau" });
        return;
      }
      const actorId = req.user?.userId ?? req.params.id;
      const saved = await Promise.allSettled(
        absences.map((a) => absenceService.record(a, actorId))
      );
      const succeeded = saved.filter((r) => r.status === "fulfilled").length;
      const failed = saved.filter((r) => r.status === "rejected").map((r) => r.reason?.message);
      res.json({ saved: succeeded, failed });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}
function paymentRoutes(db) {
  const router = express.Router();
  router.get("/student/:enrollmentId", async (req, res) => {
    try {
      const payments = await db.payment.findMany({
        where: { enrollmentId: req.params.enrollmentId },
        include: { feeType: true },
        orderBy: { paidAt: "desc" }
      });
      res.json({ payments });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  return router;
}
let server = null;
async function startExpressServer(db) {
  const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";
  const port = Number(process.env.EXPRESS_PORT ?? 3721);
  const app = express();
  app.use(corsMiddleware);
  app.use(express.json({ limit: "10mb" }));
  app.get("/api/status", (_, res) => {
    res.json({
      status: "ok",
      name: "SGSI",
      version: "1.0.0",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.use("/api/auth", authRoutes(db, jwtSecret));
  const auth = authMiddleware(jwtSecret);
  app.use("/api/student", auth, studentRoutes(db));
  app.use("/api/teacher", auth, teacherRoutes(db));
  app.use("/api/payments", auth, paymentRoutes(db));
  app.get("/api/info", auth, async (_, res) => {
    try {
      const school = await db.school.findFirst();
      res.json({ school: { name: school?.name, city: school?.city } });
    } catch {
      res.json({ school: null });
    }
  });
  app.use((_, res) => {
    res.status(404).json({ error: "Route introuvable" });
  });
  server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`[SGSI] Serveur mobile demarre sur le port ${port}`);
      resolve();
    });
    server.on("error", reject);
  });
}
function stopExpressServer() {
  if (server) {
    server.close();
    server = null;
    console.log("[SGSI] Serveur mobile arrete");
  }
}
electronUpdater.autoUpdater.autoDownload = false;
electronUpdater.autoUpdater.autoInstallOnAppQuit = true;
function initAutoUpdater(win) {
  if (process.env.NODE_ENV === "development") return;
  const send = (channel, data) => {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  };
  electronUpdater.autoUpdater.on("checking-for-update", () => send("update:checking"));
  electronUpdater.autoUpdater.on("update-not-available", () => send("update:not-available"));
  electronUpdater.autoUpdater.on("error", (err) => send("update:error", err.message));
  electronUpdater.autoUpdater.on("update-available", (info) => {
    send("update:available", {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes
    });
  });
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    send("update:progress", {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });
  electronUpdater.autoUpdater.on("update-downloaded", (info) => {
    send("update:ready", { version: info.version });
  });
  electron.ipcMain.handle("update:download", async () => {
    await electronUpdater.autoUpdater.downloadUpdate();
  });
  electron.ipcMain.handle("update:install", () => {
    electronUpdater.autoUpdater.quitAndInstall(false, true);
  });
  electron.ipcMain.handle("update:check", async () => {
    await electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  });
  setTimeout(() => {
    electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  }, 5e3);
  setInterval(() => {
    electronUpdater.autoUpdater.checkForUpdates().catch(() => {
    });
  }, 4 * 60 * 60 * 1e3);
}
electron.app.commandLine.appendSwitch("disk-cache-size", "0");
electron.app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
electron.app.commandLine.appendSwitch("disable-features", "AutofillServerCommunication");
electron.app.commandLine.appendSwitch("disable-background-networking");
electron.app.commandLine.appendSwitch("disable-component-update");
electron.app.commandLine.appendSwitch("disable-domain-reliability");
electron.app.commandLine.appendSwitch("disable-sync");
electron.app.commandLine.appendSwitch("metrics-recording-only");
electron.app.commandLine.appendSwitch("no-report-upload");
let mainWindow = null;
async function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "SGSI — Le numérique au service de l'éducation",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function scheduleAutoBackup(db, dbPath) {
  const svc = new BackupService(db, dbPath);
  const run = async () => {
    try {
      const last = parseInt(global.__sgsiLastBackup ?? "0", 10);
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1e3;
      if (now - last >= ONE_DAY) {
        await svc.createDbBackup();
        global.__sgsiLastBackup = String(now);
        console.log("[SGSI] Sauvegarde automatique effectuée");
      }
    } catch (e) {
      console.error("[SGSI] Erreur sauvegarde automatique:", e);
    }
  };
  setTimeout(run, 6e4);
  setInterval(run, 60 * 60 * 1e3);
}
electron.app.whenReady().then(async () => {
  await electron.session.defaultSession.clearCache();
  const db = getDb();
  registerIpcHandlers(db);
  await startExpressServer(db);
  await createWindow();
  if (mainWindow) {
    mainWindow.webContents.once("did-finish-load", () => {
      checkOverdueAtStartup(db, mainWindow);
    });
    initAutoUpdater(mainWindow);
  }
  const dbPath = process.env.NODE_ENV === "development" ? path.resolve(process.cwd(), "../../packages/db/prisma/sgsi.db") : path.join(process.env.APPDATA ?? "", "sgsi", "sgsi.db");
  scheduleAutoBackup(db, dbPath);
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", async () => {
  stopExpressServer();
  await closeDb();
  if (process.platform !== "darwin") electron.app.quit();
});
exports.DEFAULT_EVAL_WEIGHTS = DEFAULT_EVAL_WEIGHTS;
exports.ServiceError = ServiceError;
exports.calcGeneralAverage = calcGeneralAverage;
exports.calcRankings = calcRankings;
exports.calcSubjectAverage = calcSubjectAverage;
exports.fail = fail$c;
exports.formatReceiptNo = formatReceiptNo;
exports.generateMatricule = generateMatricule;
exports.ok = ok$c;
