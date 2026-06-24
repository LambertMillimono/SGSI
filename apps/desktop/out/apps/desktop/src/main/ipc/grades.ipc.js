"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerGradesIpc = registerGradesIpc;
const electron_1 = require("electron");
const grade_service_1 = require("../services/grade.service");
const bulletin_service_1 = require("../services/bulletin.service");
const shared_1 = require("@sgsi/shared");
function registerGradesIpc(db) {
    const grades = new grade_service_1.GradeService(db);
    const bulletins = new bulletin_service_1.BulletinService(db);
    electron_1.ipcMain.handle('grades:list', async (_, enrollmentId, period) => {
        try {
            return (0, shared_1.ok)(await grades.listByEnrollment(enrollmentId, period));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('grades:save', async (_, data, actorId) => {
        try {
            return (0, shared_1.ok)(await grades.save(data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('grades:averages', async (_, enrollmentId, period) => {
        try {
            return (0, shared_1.ok)(await grades.computeAverages(enrollmentId, period));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('grades:ranking', async (_, classId, period) => {
        try {
            return (0, shared_1.ok)(await grades.computeClassRankings(classId, period));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('grades:lock', async (_, enrollmentId, period, actorId) => {
        try {
            await grades.lockGrades(enrollmentId, period, actorId);
            return (0, shared_1.ok)(null);
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('bulletins:generate', async (_, enrollmentId, period, actorId) => {
        try {
            return (0, shared_1.ok)(await bulletins.generate(enrollmentId, period, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('bulletins:validate', async (_, bulletinId, directorId) => {
        try {
            return (0, shared_1.ok)(await bulletins.validate(bulletinId, directorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('bulletins:list', async (_, enrollmentId) => {
        try {
            return (0, shared_1.ok)(await bulletins.findByEnrollment(enrollmentId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
}
//# sourceMappingURL=grades.ipc.js.map