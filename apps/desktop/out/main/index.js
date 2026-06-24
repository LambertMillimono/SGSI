"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const electron = require("electron");
const path = require("path");
const client = require("@prisma/client");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const archiver = require("archiver");
const os = require("os");
const express = require("express");
const http = require("http");
const cors = require("cors");
let _prisma = null;
function getDb() {
  if (!_prisma) {
    const isPackaged = process.env.NODE_ENV === "production";
    const dbPath = isPackaged ? path.join(process.env.APPDATA ?? "", "sgsi", "sgsi.db") : path.resolve(__dirname, "../../../../packages/db/prisma/sgsi.db");
    _prisma = new client.PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
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
function ok$a(data) {
  return { success: true, data };
}
function fail$a(code, message) {
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
function getAppreciation(average) {
  if (average >= 18) return "Excellent";
  if (average >= 16) return "Très Bien";
  if (average >= 14) return "Bien";
  if (average >= 12) return "Assez Bien";
  if (average >= 10) return "Passable";
  return "Insuffisant";
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
    const { ROLE_PERMISSIONS } = await Promise.resolve().then(() => require("./chunks/index-ixNbRTbY.js"));
    const perms = ROLE_PERMISSIONS[user.role] ?? [];
    return perms.some(
      (p) => (p.module === module2 || p.module === "*") && p.actions.includes(action)
    );
  }
}
function registerAuthIpc(db, jwtSecret) {
  const auth = new AuthService(db, jwtSecret);
  electron.ipcMain.handle("auth:login", async (_, username, password) => {
    try {
      return ok$a(await auth.login(username, password));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:verifyToken", async (_, token) => {
    try {
      return ok$a(auth.verifyToken(token));
    } catch {
      return fail$a("INVALID_TOKEN", "Token invalide");
    }
  });
  electron.ipcMain.handle("auth:requestReset", async (_, userId, requestedBy) => {
    try {
      return ok$a({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) });
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:changePassword", async (_, userId, newPassword) => {
    try {
      await auth.changePassword(userId, newPassword);
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:checkPermission", async (_, userId, module2, action) => {
    try {
      return ok$a(await auth.checkPermission(userId, module2, action));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:logout", async () => ok$a(null));
  electron.ipcMain.handle("auth:findByUsername", async (_, username) => {
    try {
      const rows = await db.$queryRaw`
        SELECT id, firstName, lastName, role, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user) return fail$a("NOT_FOUND", "Aucun compte trouvé avec cet identifiant");
      if (!user.isActive) return fail$a("DISABLED", "Ce compte est désactivé. Contactez votre administrateur.");
      return ok$a({ id: user.id, firstName: user.firstName, lastName: user.lastName, role: user.role });
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:sendResetEmail", async (_, username) => {
    try {
      const rows = await db.$queryRaw`
        SELECT id, firstName, lastName, email, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user) return fail$a("NOT_FOUND", "Aucun compte trouvé avec cet identifiant");
      if (!user.isActive) return fail$a("DISABLED", "Ce compte est désactivé. Contactez votre administrateur.");
      if (!user.email) return fail$a("NO_EMAIL", "Aucune adresse email configurée pour ce compte. Demandez à votre administrateur de renseigner votre email dans Paramètres → Utilisateurs.");
      const smtpFile = path.join(electron.app.getPath("userData"), "sgsi-smtp.json");
      if (!fs.existsSync(smtpFile)) return fail$a("NO_SMTP", "Le serveur email n'est pas encore configuré. Demandez à l'administrateur de le configurer dans Paramètres → Établissement.");
      const smtp = JSON.parse(fs.readFileSync(smtpFile, "utf-8"));
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
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port),
        secure: smtp.secure === true || Number(smtp.port) === 465,
        auth: { user: smtp.user, pass: smtp.password },
        tls: { rejectUnauthorized: false }
      });
      const fromName = smtp.fromName || "SGSI SchoolManager";
      const fromEmail = smtp.fromEmail || smtp.user;
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
        `
      });
      const [local, domain] = user.email.split("@");
      const [domainName, ...tldParts] = domain.split(".");
      const maskedEmail = local.slice(0, 2) + "***@" + domainName.slice(0, 2) + "***." + tldParts.join(".");
      return ok$a({ maskedEmail, userId: user.id });
    } catch (e) {
      return fail$a(e.code ?? "SMTP_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:resetByOtp", async (_, userId, otp, newPassword) => {
    try {
      const tokensFile = path.join(electron.app.getPath("userData"), "sgsi-reset-tokens.json");
      if (!fs.existsSync(tokensFile)) return fail$a("INVALID_OTP", "Code invalide ou expiré");
      const tokens = JSON.parse(fs.readFileSync(tokensFile, "utf-8"));
      const token = tokens[userId];
      if (!token) return fail$a("INVALID_OTP", "Code invalide ou expiré");
      if (token.expiry < Date.now()) {
        delete tokens[userId];
        fs.writeFileSync(tokensFile, JSON.stringify(tokens), "utf-8");
        return fail$a("OTP_EXPIRED", "Code expiré. Faites une nouvelle demande.");
      }
      const inputHash = crypto.createHash("sha256").update(otp.trim()).digest("hex");
      if (inputHash !== token.hash) return fail$a("INVALID_OTP", "Code incorrect");
      await auth.changePassword(userId, newPassword);
      delete tokens[userId];
      fs.writeFileSync(tokensFile, JSON.stringify(tokens), "utf-8");
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("auth:resetByRecovery", async (_, username, recoveryCode, newPassword) => {
    try {
      const recoveryFile = path.join(electron.app.getPath("userData"), "sgsi-recovery.json");
      if (!fs.existsSync(recoveryFile)) return fail$a("NO_RECOVERY", "Aucun code de récupération configuré.");
      const stored = JSON.parse(fs.readFileSync(recoveryFile, "utf-8"));
      const inputHash = crypto.createHash("sha256").update(recoveryCode.trim()).digest("hex");
      if (inputHash !== stored.hash) return fail$a("INVALID_CODE", "Code de récupération incorrect");
      const rows = await db.$queryRaw`
        SELECT id, isActive FROM "User"
        WHERE LOWER(username) = LOWER(${username.trim()}) LIMIT 1`;
      const user = rows[0] ?? null;
      if (!user || !user.isActive) return fail$a("NOT_FOUND", "Utilisateur introuvable");
      await auth.changePassword(user.id, newPassword);
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
      return ok$a(await students.list(filters));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:findById", async (_, id) => {
    try {
      return ok$a(await students.findById(id));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:create", async (_, data, actorId) => {
    try {
      return ok$a(await students.create(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:update", async (_, id, data, actorId) => {
    try {
      return ok$a(await students.update(id, data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:delete", async (_, id, actorId) => {
    try {
      await students.delete(id, actorId);
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("students:enroll", async (_, studentId, classId, yearId, actorId) => {
    try {
      return ok$a(await students.enroll(studentId, classId, yearId, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:list", async (_, yearId) => {
    try {
      return ok$a(await classes.listClasses(yearId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:create", async (_, data, actorId) => {
    try {
      return ok$a(await classes.createClass(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classes:findById", async (_, id) => {
    try {
      return ok$a(await classes.findClassById(id));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cycles:list", async () => {
    try {
      return ok$a(await classes.listCycles());
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levels:list", async () => {
    try {
      return ok$a(await classes.listLevels());
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levels:create", async (_, data, actorId) => {
    try {
      return ok$a(await classes.createLevel(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
function parseCsv(content) {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    const noteRaw = obj["note"] ?? obj["grade"] ?? obj["valeur"] ?? obj["value"] ?? "";
    const value = noteRaw !== "" ? parseFloat(noteRaw.replace(",", ".")) : null;
    rows.push({
      lastName: (obj["nom"] ?? obj["lastname"] ?? obj["last_name"] ?? "").toUpperCase(),
      firstName: obj["prenom"] ?? obj["prénom"] ?? obj["firstname"] ?? obj["first_name"] ?? "",
      matricule: obj["matricule"] ?? "",
      value: value !== null && !isNaN(value) ? value : null
    });
  }
  return rows;
}
function parseXlsxData(data) {
  if (data.length < 2) return [];
  const header = data[0].map((h) => String(h ?? "").trim().toLowerCase());
  const idxNom = header.findIndex((h) => h === "nom" || h === "lastname" || h === "last_name");
  const idxPrenom = header.findIndex((h) => h === "prenom" || h === "prénom" || h === "firstname" || h === "first_name");
  const idxMatricule = header.findIndex((h) => h === "matricule" || h === "id");
  const idxNote = header.findIndex((h) => h === "note" || h === "grade" || h === "valeur" || h === "value");
  const getNom = (r) => idxNom >= 0 ? String(r[idxNom] ?? "").trim() : String(r[0] ?? "").trim();
  const getPrenom = (r) => idxPrenom >= 0 ? String(r[idxPrenom] ?? "").trim() : String(r[1] ?? "").trim();
  const getMatric = (r) => idxMatricule >= 0 ? String(r[idxMatricule] ?? "").trim() : String(r[2] ?? "").trim();
  const getNote = (r) => idxNote >= 0 ? r[idxNote] : r[3];
  return data.slice(1).map((row) => {
    const noteRaw = getNote(row);
    const value = noteRaw !== "" && noteRaw != null ? parseFloat(String(noteRaw).replace(",", ".")) : null;
    return {
      lastName: getNom(row).toUpperCase(),
      firstName: getPrenom(row),
      matricule: getMatric(row),
      value: value !== null && !isNaN(value) ? value : null
    };
  }).filter((r) => r.matricule || r.lastName);
}
function registerGradesIpc(db) {
  const grades = new GradeService(db);
  const bulletins = new BulletinService(db);
  electron.ipcMain.handle("grades:list", async (_, enrollmentId, period) => {
    try {
      return ok$a(await grades.listByEnrollment(enrollmentId, period));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:save", async (_, data, actorId) => {
    try {
      return ok$a(await grades.save(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:upsert", async (_, data, actorId) => {
    try {
      return ok$a(await grades.upsertGrade(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:listByClass", async (_, classId, subjectId, period, evalType) => {
    try {
      return ok$a(await grades.listByClassSubjectPeriodEvalType(classId, subjectId, period, evalType));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:averages", async (_, enrollmentId, period) => {
    try {
      return ok$a(await grades.computeAverages(enrollmentId, period));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:ranking", async (_, classId, period) => {
    try {
      return ok$a(await grades.computeClassRankings(classId, period));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:lock", async (_, enrollmentId, period, actorId) => {
    try {
      await grades.lockGrades(enrollmentId, period, actorId);
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("grades:statsBySubject", async (_, classId, period) => {
    try {
      return ok$a(await grades.statsBySubject(classId, period));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
      if (result.canceled || result.filePaths.length === 0) return ok$a(null);
      const filePath = result.filePaths[0];
      if (filePath.endsWith(".xlsx") || filePath.endsWith(".xls")) {
        const XLSX = require("xlsx");
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
        const rows = parseXlsxData(data);
        return ok$a(rows);
      } else {
        const content = fs.readFileSync(filePath, "utf-8");
        const rows = parseCsv(content);
        return ok$a(rows);
      }
    } catch (e) {
      return fail$a("PARSE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:generate", async (_, enrollmentId, period, actorId) => {
    try {
      return ok$a(await bulletins.generate(enrollmentId, period, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
      return ok$a({ success, failed, total: enrollments.length });
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:validate", async (_, bulletinId, directorId) => {
    try {
      return ok$a(await bulletins.validate(bulletinId, directorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:list", async (_, enrollmentId) => {
    try {
      return ok$a(await bulletins.findByEnrollment(enrollmentId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("bulletins:countUnvalidated", async () => {
    try {
      const count = await db.bulletin.count({ where: { isValidated: false } });
      return ok$a(count);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
      return ok$a(await service.record(data, cashierId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:list", async (_, enrollmentId) => {
    try {
      return ok$a(await service.listByEnrollment(enrollmentId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:unpaid", async (_, classId) => {
    try {
      return ok$a(await service.listUnpaid(classId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:list", async (_, levelId) => {
    try {
      return ok$a(await service.listFeeTypes(levelId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:create", async (_, data, actorId) => {
    try {
      return ok$a(await service.createFeeType(data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:update", async (_, id, data, actorId) => {
    try {
      return ok$a(await service.updateFeeType(id, data, actorId));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("feetypes:delete", async (_, id, actorId) => {
    try {
      await service.deleteFeeType(id, actorId);
      return ok$a(null);
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:receipt", async (_, id) => {
    try {
      return ok$a(await service.getById(id));
    } catch (e) {
      return fail$a(e.code ?? "ERROR", e.message);
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
      return ok$a({ byMonth, totalYear, count: payments.length });
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("payments:reportByFeeType", async (_, year) => {
    try {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31, 23, 59, 59);
      const feeTypes = await db.feeType.findMany({ include: { payments: { where: { paidAt: { gte: start, lte: end } } } } });
      return ok$a(feeTypes.map((ft) => ({
        id: ft.id,
        name: ft.name,
        total: ft.payments.reduce((s, p) => s + p.amount, 0),
        count: ft.payments.length
      })).filter((ft) => ft.count > 0));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a({ filePath });
    } catch (e) {
      return fail$a("BACKUP_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("backup:restore", async (_, backupPath) => {
    try {
      await service.restore(backupPath);
      return ok$a(null);
    } catch (e) {
      return fail$a("RESTORE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("backup:list", async () => {
    try {
      return ok$a(service.listBackups());
    } catch (e) {
      return fail$a("BACKUP_LIST_ERROR", e.message);
    }
  });
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
      return ok$a(school);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:updateSchool", async (_, data) => {
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
      return ok$a(school);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:listUsers", async () => {
    try {
      const users = await db.user.findMany({
        select: { id: true, username: true, firstName: true, lastName: true, role: true, isActive: true, lastLogin: true, email: true, phone: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      });
      return ok$a(users);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createUser", async (_, data) => {
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
      return ok$a({ id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName });
    } catch (e) {
      return fail$a(e.code === "P2002" ? "USERNAME_TAKEN" : "ERROR", e.code === "P2002" ? "Nom d'utilisateur déjà utilisé" : e.message);
    }
  });
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
      return ok$a(user);
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a({ tempPassword });
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:listAcademicYears", async () => {
    try {
      const years = await db.academicYear.findMany({ orderBy: { startDate: "desc" } });
      return ok$a(years);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createAcademicYear", async (_, data) => {
    try {
      if (data.isCurrent) await db.academicYear.updateMany({ data: { isCurrent: false } });
      const year = await db.academicYear.create({ data });
      return ok$a(year);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:setCurrentYear", async (_, id) => {
    try {
      await db.academicYear.updateMany({ data: { isCurrent: false } });
      const year = await db.academicYear.update({ where: { id }, data: { isCurrent: true } });
      return ok$a(year);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createCycle", async (_, data) => {
    try {
      const count = await db.cycle.count();
      const cycle = await db.cycle.create({ data: { name: data.name, order: count + 1 } });
      return ok$a(cycle);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createClass", async (_, data) => {
    try {
      const cls = await db.class.create({
        data: { name: data.name, levelId: data.levelId, academicYearId: data.academicYearId, maxStudents: data.maxStudents ?? 40 },
        include: { level: { include: { cycle: true } } }
      });
      return ok$a(cls);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:createLevel", async (_, data) => {
    try {
      const count = await db.level.count({ where: { cycleId: data.cycleId } });
      const level = await db.level.create({
        data: { name: data.name, order: count + 1, cycleId: data.cycleId },
        include: { cycle: true }
      });
      return ok$a(level);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:getModules", async () => {
    try {
      return ok$a(readModulesFromFile());
    } catch (e) {
      return ok$a(DEFAULT_MODULES);
    }
  });
  electron.ipcMain.handle("settings:setModules", async (_, modules) => {
    try {
      writeModulesToFile(modules);
      return ok$a(modules);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  const smtpFilePath = () => path.join(electron.app.getPath("userData"), "sgsi-smtp.json");
  electron.ipcMain.handle("settings:getSmtpConfig", async () => {
    try {
      const file = smtpFilePath();
      if (!fs.existsSync(file)) return ok$a(null);
      const config = JSON.parse(fs.readFileSync(file, "utf-8"));
      return ok$a({ ...config, password: config.password ? "••••••••" : "" });
    } catch {
      return ok$a(null);
    }
  });
  electron.ipcMain.handle("settings:setSmtpConfig", async (_, config) => {
    try {
      const file = smtpFilePath();
      let existing = {};
      if (fs.existsSync(file)) existing = JSON.parse(fs.readFileSync(file, "utf-8"));
      const toSave = { ...config, password: config.password === "••••••••" ? existing.password ?? "" : config.password };
      fs.writeFileSync(file, JSON.stringify(toSave), "utf-8");
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("settings:testSmtp", async (_, testEmail) => {
    try {
      const file = smtpFilePath();
      if (!fs.existsSync(file)) return fail$a("NO_SMTP", "Aucune configuration SMTP enregistrée");
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
      return ok$a(null);
    } catch (e) {
      return fail$a("SMTP_ERROR", e.message);
    }
  });
  const recoveryFilePath = () => path.join(electron.app.getPath("userData"), "sgsi-recovery.json");
  electron.ipcMain.handle("settings:getRecoveryCode", async () => {
    try {
      const file = recoveryFilePath();
      if (!fs.existsSync(file)) return ok$a({ isSet: false });
      const data = JSON.parse(fs.readFileSync(file, "utf-8"));
      return ok$a({ isSet: !!data.hash });
    } catch {
      return ok$a({ isSet: false });
    }
  });
  electron.ipcMain.handle("settings:setRecoveryCode", async (_, code) => {
    try {
      const hash = crypto.createHash("sha256").update(code.trim()).digest("hex");
      fs.writeFileSync(recoveryFilePath(), JSON.stringify({ hash }), "utf-8");
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
}
function registerSubjectsIpc(db) {
  electron.ipcMain.handle("subjects:list", async () => {
    try {
      return ok$a(await db.subject.findMany({ orderBy: { name: "asc" } }));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("subjects:create", async (_, data) => {
    try {
      const subject = await db.subject.create({
        data: { name: data.name, code: data.code.toUpperCase().trim() }
      });
      return ok$a(subject);
    } catch (e) {
      return fail$a(
        e.code === "P2002" ? "CODE_TAKEN" : "ERROR",
        e.code === "P2002" ? "Ce code est déjà utilisé" : e.message
      );
    }
  });
  electron.ipcMain.handle("subjects:delete", async (_, id) => {
    try {
      await db.subject.delete({ where: { id } });
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classSubjects:list", async (_, classId) => {
    try {
      return ok$a(await db.classSubject.findMany({
        where: { classId },
        include: {
          subject: true,
          teacher: { include: { user: { select: { firstName: true, lastName: true } } } }
        },
        orderBy: { subject: { name: "asc" } }
      }));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(cs);
    } catch (e) {
      return fail$a(
        e.code === "P2002" ? "ALREADY_EXISTS" : "ERROR",
        e.code === "P2002" ? "Cette matière est déjà assignée à cette classe" : e.message
      );
    }
  });
  electron.ipcMain.handle("classSubjects:update", async (_, id, data) => {
    try {
      return ok$a(await db.classSubject.update({ where: { id }, data, include: { subject: true } }));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("classSubjects:remove", async (_, id) => {
    try {
      await db.classSubject.delete({ where: { id } });
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:list", async (_, levelId) => {
    try {
      return ok$a(await db.levelSubject.findMany({
        where: { levelId },
        include: { subject: true },
        orderBy: { subject: { name: "asc" } }
      }));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(ls);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("levelSubjects:remove", async (_, id) => {
    try {
      await db.levelSubject.delete({ where: { id } });
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a({ updated, classes: classes.length, subjects: levelSubjects.length });
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(enrollments.map((e) => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        gender: e.student.gender,
        absence: e.absences[0] ?? null
      })));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a({ saved: records.length });
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("absences:listByEnrollment", async (_, enrollmentId) => {
    try {
      return ok$a(await db.absence.findMany({
        where: { enrollmentId },
        orderBy: { date: "desc" }
      }));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(enrollments.map((e) => ({
        enrollmentId: e.id,
        studentName: `${e.student.lastName} ${e.student.firstName}`,
        matricule: e.student.matricule,
        total: e.absences.length,
        justified: e.absences.filter((a) => a.justified).length,
        unjustified: e.absences.filter((a) => !a.justified).length,
        late: e.absences.filter((a) => a.type === "LATE").length
      })));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
    return result;
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
}
function registerTeachersIpc(db) {
  const svc = new TeacherService(db);
  electron.ipcMain.handle("teachers:list", async () => {
    try {
      return ok$a(await svc.list());
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:getById", async (_, id) => {
    try {
      return ok$a(await svc.getById(id));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:create", async (_, data, actorId) => {
    try {
      return ok$a(await svc.create(data, actorId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:update", async (_, id, data, actorId) => {
    try {
      return ok$a(await svc.update(id, data, actorId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:delete", async (_, id, actorId) => {
    try {
      await svc.delete(id, actorId);
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:listSalaries", async (_, teacherId) => {
    try {
      return ok$a(await svc.listSalaries(teacherId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:createSalary", async (_, data, actorId) => {
    try {
      return ok$a(await svc.createSalary(data, actorId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("teachers:markSalaryPaid", async (_, salaryId, actorId) => {
    try {
      return ok$a(await svc.markSalaryPaid(salaryId, actorId));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(await svc.listByClass(classId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:listByTeacher", async (_, teacherId) => {
    try {
      return ok$a(await svc.listByTeacher(teacherId));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:create", async (_, data) => {
    try {
      return ok$a(await svc.create(data));
    } catch (e) {
      return fail$a("CONFLICT", e.message);
    }
  });
  electron.ipcMain.handle("schedules:delete", async (_, id) => {
    try {
      await svc.delete(id);
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:listRooms", async () => {
    try {
      return ok$a(await svc.listRooms());
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("schedules:createRoom", async (_, data) => {
    try {
      return ok$a(await svc.createRoom(data));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
      return ok$a(await svc.list(filters));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:create", async (_, data) => {
    try {
      return ok$a(await svc.create(data));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:delete", async (_, id) => {
    try {
      await svc.delete(id);
      return ok$a(null);
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("expenses:summary", async (_, year) => {
    try {
      return ok$a(await svc.monthlySummary(year));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:today", async () => {
    try {
      return ok$a(await svc.getTodayCash());
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:open", async (_, openBalance, openedBy) => {
    try {
      return ok$a(await svc.openCash(openBalance, openedBy));
    } catch (e) {
      return fail$a("ERROR", e.message);
    }
  });
  electron.ipcMain.handle("cash:close", async (_, id, closeBalance, closedBy) => {
    try {
      return ok$a(await svc.closeCash(id, closeBalance, closedBy));
    } catch (e) {
      return fail$a("ERROR", e.message);
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
function ok$9(data) {
  return { success: true, data };
}
function fail$9(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerParentsIpc(db) {
  const svc = new ParentService(db);
  electron.ipcMain.handle("parents:listByStudent", async (_, studentId) => {
    try {
      return ok$9(await svc.listByStudent(studentId));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("parents:create", async (_, data, studentId) => {
    try {
      return ok$9(await svc.create(data, studentId));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("parents:update", async (_, id, data) => {
    try {
      return ok$9(await svc.update(id, data));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("parents:unlink", async (_, parentId, studentId) => {
    try {
      return ok$9(await svc.unlink(parentId, studentId));
    } catch (e) {
      return fail$9(e.message);
    }
  });
  electron.ipcMain.handle("parents:generateCode", async (_, parentId) => {
    try {
      return ok$9(await svc.generateAccessCode(parentId));
    } catch (e) {
      return fail$9(e.message);
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
function ok$8(data) {
  return { success: true, data };
}
function fail$8(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerAuditLogIpc(db) {
  const svc = new AuditLogService(db);
  electron.ipcMain.handle("auditlog:list", async (_, filters) => {
    try {
      return ok$8(await svc.list(filters));
    } catch (e) {
      return fail$8(e.message);
    }
  });
  electron.ipcMain.handle("auditlog:entities", async () => {
    try {
      return ok$8(await svc.listEntities());
    } catch (e) {
      return fail$8(e.message);
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
function ok$7(data) {
  return { success: true, data };
}
function fail$7(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerLibraryIpc(db) {
  const svc = new LibraryService(db);
  electron.ipcMain.handle("library:listBooks", async (_, search) => {
    try {
      return ok$7(await svc.listBooks(search));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:createBook", async (_, data) => {
    try {
      return ok$7(await svc.createBook(data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:updateBook", async (_, id, data) => {
    try {
      return ok$7(await svc.updateBook(id, data));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:deleteBook", async (_, id) => {
    try {
      return ok$7(await svc.deleteBook(id));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:listLoans", async (_, filters) => {
    try {
      return ok$7(await svc.listLoans(filters));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:createLoan", async (_, data) => {
    try {
      return ok$7(await svc.createLoan({ ...data, dueDate: new Date(data.dueDate) }));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:returnLoan", async (_, loanId, fine) => {
    try {
      return ok$7(await svc.returnLoan(loanId, fine));
    } catch (e) {
      return fail$7(e.message);
    }
  });
  electron.ipcMain.handle("library:stats", async () => {
    try {
      return ok$7(await svc.stats());
    } catch (e) {
      return fail$7(e.message);
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
function ok$6(data) {
  return { success: true, data };
}
function fail$6(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerMedicalIpc(db) {
  const svc = new MedicalService(db);
  electron.ipcMain.handle("medical:getRecord", async (_, studentId) => {
    try {
      return ok$6(await svc.getRecord(studentId));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("medical:updateRecord", async (_, id, data) => {
    try {
      return ok$6(await svc.updateRecord(id, data));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("medical:addConsultation", async (_, medicalRecordId, data) => {
    try {
      return ok$6(await svc.addConsultation(medicalRecordId, { ...data, date: data.date ? new Date(data.date) : void 0 }));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("medical:deleteConsultation", async (_, id) => {
    try {
      return ok$6(await svc.deleteConsultation(id));
    } catch (e) {
      return fail$6(e.message);
    }
  });
  electron.ipcMain.handle("medical:listRecent", async (_, limit) => {
    try {
      return ok$6(await svc.listRecent(limit));
    } catch (e) {
      return fail$6(e.message);
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
function ok$5(data) {
  return { success: true, data };
}
function fail$5(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerTransportIpc(db) {
  const svc = new TransportService(db);
  electron.ipcMain.handle("transport:listBuses", async () => {
    try {
      return ok$5(await svc.listBuses());
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:createBus", async (_, data) => {
    try {
      return ok$5(await svc.createBus(data));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:updateBus", async (_, id, data) => {
    try {
      return ok$5(await svc.updateBus(id, data));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:deleteBus", async (_, id) => {
    try {
      return ok$5(await svc.deleteBus(id));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:createRoute", async (_, data) => {
    try {
      return ok$5(await svc.createRoute(data));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:updateRoute", async (_, id, data) => {
    try {
      return ok$5(await svc.updateRoute(id, data));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:deleteRoute", async (_, id) => {
    try {
      return ok$5(await svc.deleteRoute(id));
    } catch (e) {
      return fail$5(e.message);
    }
  });
  electron.ipcMain.handle("transport:stats", async () => {
    try {
      return ok$5(await svc.stats());
    } catch (e) {
      return fail$5(e.message);
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
function ok$4(data) {
  return { success: true, data };
}
function fail$4(message, code = "ERROR") {
  return { success: false, error: { code, message } };
}
function registerNotificationsIpc(db) {
  const svc = new NotificationService(db);
  electron.ipcMain.handle("notifications:list", async (_, limit) => {
    try {
      return ok$4(await svc.list(limit));
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("notifications:countUnread", async () => {
    try {
      return ok$4(await svc.countUnread());
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("notifications:markRead", async (_, id) => {
    try {
      return ok$4(await svc.markRead(id));
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("notifications:markAllRead", async () => {
    try {
      return ok$4(await svc.markAllRead());
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("notifications:create", async (_, data) => {
    try {
      return ok$4(await svc.create(data));
    } catch (e) {
      return fail$4(e.message);
    }
  });
  electron.ipcMain.handle("notifications:delete", async (_, id) => {
    try {
      return ok$4(await svc.delete(id));
    } catch (e) {
      return fail$4(e.message);
    }
  });
}
function ok$3(data) {
  return { success: true, data };
}
function fail$3(message) {
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
      if (result.canceled || result.filePaths.length === 0) return ok$3(null);
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase().replace(".", "");
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
      const data = fs.readFileSync(filePath);
      return ok$3(`data:${mime};base64,${data.toString("base64")}`);
    } catch (e) {
      return fail$3(e.message);
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
      if (result.canceled || result.filePaths.length === 0) return ok$3(null);
      const src = result.filePaths[0];
      const filename = path.basename(src);
      const dest = path.join(destDir, `${Date.now()}_${filename}`);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
      return ok$3({ filename, destPath: dest });
    } catch (e) {
      return fail$3(e.message);
    }
  });
  electron.ipcMain.handle("shell:openPath", async (_, filePath) => {
    try {
      await electron.shell.openPath(filePath);
      return ok$3(null);
    } catch (e) {
      return fail$3(e.message);
    }
  });
}
function ok$2(data) {
  return { success: true, data };
}
function fail$2(message) {
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
      return ok$2(docs);
    } catch (e) {
      return fail$2(e.message);
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
      if (result.canceled || result.filePaths.length === 0) return ok$2(null);
      const src = result.filePaths[0];
      const filename = path.basename(src);
      const destDir = path.join(DOCS_ROOT, studentId);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${Date.now()}_${filename}`);
      fs.copyFileSync(src, dest);
      const doc = await db.studentDocument.create({
        data: { studentId, type, filePath: dest }
      });
      return ok$2(doc);
    } catch (e) {
      return fail$2(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:open", async (_, id) => {
    try {
      const doc = await db.studentDocument.findUnique({ where: { id } });
      if (!doc) return fail$2("Document introuvable");
      if (!fs.existsSync(doc.filePath)) return fail$2("Fichier introuvable sur le disque");
      await electron.shell.openPath(doc.filePath);
      return ok$2(null);
    } catch (e) {
      return fail$2(e.message);
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
      return ok$2(null);
    } catch (e) {
      return fail$2(e.message);
    }
  });
  electron.ipcMain.handle("studentdocs:types", async () => ok$2(DOC_TYPES));
}
class LicenseService {
  constructor(db) {
    this.db = db;
  }
  async getLicense() {
    return this.db.license.findFirst({ orderBy: { issuedAt: "desc" } });
  }
  async activate(key) {
    if (!key || key.length < 10) throw new Error("Clé de licence invalide");
    const existing = await this.db.license.findUnique({ where: { key } });
    if (existing) {
      return this.db.license.update({ where: { key }, data: { isActive: true } });
    }
    const parts = key.toUpperCase().split("-");
    let plan = "STANDARD";
    let maxStudents = 500;
    let expiresAt = void 0;
    if (parts.length >= 2) {
      const planCode = parts[1];
      if (planCode === "PRO") {
        plan = "PROFESSIONAL";
        maxStudents = 2e3;
      } else if (planCode === "ULT") {
        plan = "ULTIMATE";
        maxStudents = 9999;
      }
    }
    for (const p of parts) {
      const yr = parseInt(p, 10);
      if (yr >= 2024 && yr <= 2099) {
        expiresAt = new Date(yr, 11, 31, 23, 59, 59);
        break;
      }
    }
    const school = await this.db.schoolSettings.findFirst();
    const schoolName = school?.name ?? "École";
    return this.db.license.create({
      data: {
        key,
        schoolName,
        plan,
        maxStudents,
        isActive: true,
        expiresAt: expiresAt ?? null
      }
    });
  }
  async deactivate() {
    const lic = await this.getLicense();
    if (!lic) throw new Error("Aucune licence trouvée");
    return this.db.license.update({ where: { id: lic.id }, data: { isActive: false } });
  }
  async isValid() {
    const lic = await this.getLicense();
    if (!lic || !lic.isActive) return false;
    if (lic.expiresAt && /* @__PURE__ */ new Date() > lic.expiresAt) return false;
    return true;
  }
}
function ok$1(data) {
  return { success: true, data };
}
function fail$1(code, message) {
  return { success: false, error: { code, message } };
}
function registerLicenseIpc(db) {
  const svc = new LicenseService(db);
  electron.ipcMain.handle("license:get", async () => {
    try {
      return ok$1(await svc.getLicense());
    } catch (e) {
      return fail$1("LICENSE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("license:activate", async (_, key) => {
    try {
      return ok$1(await svc.activate(key));
    } catch (e) {
      return fail$1("ACTIVATION_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("license:deactivate", async () => {
    try {
      return ok$1(await svc.deactivate());
    } catch (e) {
      return fail$1("LICENSE_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("license:isValid", async () => {
    try {
      return ok$1(await svc.isValid());
    } catch (e) {
      return ok$1(false);
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
function ok(data) {
  return { success: true, data };
}
function fail(code, message) {
  return { success: false, error: { code, message } };
}
function registerMessagesIpc(db) {
  const svc = new MessageService(db);
  electron.ipcMain.handle("messages:inbox", async (_, userId) => {
    try {
      return ok(await svc.listInbox(userId));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:sent", async (_, userId) => {
    try {
      return ok(await svc.listSent(userId));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:thread", async (_, messageId, userId) => {
    try {
      return ok(await svc.getThread(messageId, userId));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:send", async (_, data) => {
    try {
      return ok(await svc.send(data));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:countUnread", async (_, userId) => {
    try {
      return ok(await svc.countUnread(userId));
    } catch (e) {
      return ok(0);
    }
  });
  electron.ipcMain.handle("messages:markRead", async (_, messageId) => {
    try {
      return ok(await svc.markRead(messageId));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
    }
  });
  electron.ipcMain.handle("messages:delete", async (_, messageId, userId) => {
    try {
      return ok(await svc.delete(messageId, userId));
    } catch (e) {
      return fail("MSG_ERROR", e.message);
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
      const ExcelJS = require("exceljs");
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
      const wb = new ExcelJS.Workbook();
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
      if (saveResult.canceled || !saveResult.filePath) return ok$a(null);
      await wb.xlsx.writeFile(saveResult.filePath);
      electron.shell.openPath(path.dirname(saveResult.filePath));
      return ok$a({ filePath: saveResult.filePath });
    } catch (e) {
      return fail$a("EXCEL_ERROR", e.message);
    }
  });
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
exports.fail = fail$a;
exports.formatReceiptNo = formatReceiptNo;
exports.generateMatricule = generateMatricule;
exports.getAppreciation = getAppreciation;
exports.ok = ok$a;
