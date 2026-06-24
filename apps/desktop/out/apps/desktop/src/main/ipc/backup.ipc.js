"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBackupIpc = registerBackupIpc;
const electron_1 = require("electron");
const backup_service_1 = require("../services/backup.service");
const shared_1 = require("@sgsi/shared");
function registerBackupIpc(db, dbPath) {
    const service = new backup_service_1.BackupService(db, dbPath);
    electron_1.ipcMain.handle('backup:create', async (_, format) => {
        try {
            const filePath = format === 'zip'
                ? await service.createZipBackup()
                : await service.createDbBackup();
            return (0, shared_1.ok)({ filePath });
        }
        catch (e) {
            return (0, shared_1.fail)('BACKUP_ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('backup:restore', async (_, backupPath) => {
        try {
            await service.restore(backupPath);
            return (0, shared_1.ok)(null);
        }
        catch (e) {
            return (0, shared_1.fail)('RESTORE_ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('backup:list', async () => {
        try {
            return (0, shared_1.ok)(service.listBackups());
        }
        catch (e) {
            return (0, shared_1.fail)('BACKUP_LIST_ERROR', e.message);
        }
    });
}
//# sourceMappingURL=backup.ipc.js.map