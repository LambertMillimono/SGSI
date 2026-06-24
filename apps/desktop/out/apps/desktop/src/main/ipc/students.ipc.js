"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerStudentsIpc = registerStudentsIpc;
const electron_1 = require("electron");
const student_service_1 = require("../services/student.service");
const class_service_1 = require("../services/class.service");
const shared_1 = require("@sgsi/shared");
function registerStudentsIpc(db) {
    const students = new student_service_1.StudentService(db);
    const classes = new class_service_1.ClassService(db);
    electron_1.ipcMain.handle('students:list', async (_, filters) => {
        try {
            return (0, shared_1.ok)(await students.list(filters));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('students:findById', async (_, id) => {
        try {
            return (0, shared_1.ok)(await students.findById(id));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('students:create', async (_, data, actorId) => {
        try {
            return (0, shared_1.ok)(await students.create(data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('students:update', async (_, id, data, actorId) => {
        try {
            return (0, shared_1.ok)(await students.update(id, data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('students:delete', async (_, id, actorId) => {
        try {
            await students.delete(id, actorId);
            return (0, shared_1.ok)(null);
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('students:enroll', async (_, studentId, classId, yearId, actorId) => {
        try {
            return (0, shared_1.ok)(await students.enroll(studentId, classId, yearId, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    // Classes IPC (registered here to avoid extra file)
    electron_1.ipcMain.handle('classes:list', async (_, yearId) => {
        try {
            return (0, shared_1.ok)(await classes.listClasses(yearId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('classes:create', async (_, data, actorId) => {
        try {
            return (0, shared_1.ok)(await classes.createClass(data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('classes:findById', async (_, id) => {
        try {
            return (0, shared_1.ok)(await classes.findClassById(id));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('levels:list', async () => {
        try {
            return (0, shared_1.ok)(await classes.listLevels());
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('levels:create', async (_, data, actorId) => {
        try {
            return (0, shared_1.ok)(await classes.createLevel(data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
}
//# sourceMappingURL=students.ipc.js.map