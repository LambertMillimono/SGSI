"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const auth_ipc_1 = require("./auth.ipc");
const students_ipc_1 = require("./students.ipc");
const grades_ipc_1 = require("./grades.ipc");
const payments_ipc_1 = require("./payments.ipc");
const backup_ipc_1 = require("./backup.ipc");
const path_1 = __importDefault(require("path"));
function registerIpcHandlers(db) {
    const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';
    const dbPath = process.env.NODE_ENV === 'development'
        ? path_1.default.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')
        : path_1.default.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db');
    (0, auth_ipc_1.registerAuthIpc)(db, jwtSecret);
    (0, students_ipc_1.registerStudentsIpc)(db);
    (0, grades_ipc_1.registerGradesIpc)(db);
    (0, payments_ipc_1.registerPaymentsIpc)(db);
    (0, backup_ipc_1.registerBackupIpc)(db, dbPath);
}
//# sourceMappingURL=index.js.map