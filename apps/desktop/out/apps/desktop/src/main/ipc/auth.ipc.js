"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAuthIpc = registerAuthIpc;
const electron_1 = require("electron");
const auth_service_1 = require("../services/auth.service");
const shared_1 = require("@sgsi/shared");
function registerAuthIpc(db, jwtSecret) {
    const auth = new auth_service_1.AuthService(db, jwtSecret);
    electron_1.ipcMain.handle('auth:login', async (_, username, password) => {
        try {
            return (0, shared_1.ok)(await auth.login(username, password));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('auth:verifyToken', async (_, token) => {
        try {
            return (0, shared_1.ok)(auth.verifyToken(token));
        }
        catch {
            return (0, shared_1.fail)('INVALID_TOKEN', 'Token invalide');
        }
    });
    electron_1.ipcMain.handle('auth:requestReset', async (_, userId, requestedBy) => {
        try {
            return (0, shared_1.ok)({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) });
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('auth:changePassword', async (_, userId, newPassword) => {
        try {
            await auth.changePassword(userId, newPassword);
            return (0, shared_1.ok)(null);
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('auth:checkPermission', async (_, userId, module, action) => {
        try {
            return (0, shared_1.ok)(await auth.checkPermission(userId, module, action));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    // JWT is stateless — logout is handled client-side by discarding the token
    electron_1.ipcMain.handle('auth:logout', async () => (0, shared_1.ok)(null));
}
//# sourceMappingURL=auth.ipc.js.map