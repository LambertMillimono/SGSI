"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentsIpc = registerPaymentsIpc;
const electron_1 = require("electron");
const payment_service_1 = require("../services/payment.service");
const shared_1 = require("@sgsi/shared");
function registerPaymentsIpc(db) {
    const service = new payment_service_1.PaymentService(db);
    electron_1.ipcMain.handle('payments:record', async (_, data, cashierId) => {
        try {
            return (0, shared_1.ok)(await service.record(data, cashierId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('payments:list', async (_, enrollmentId) => {
        try {
            return (0, shared_1.ok)(await service.listByEnrollment(enrollmentId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('payments:unpaid', async (_, classId) => {
        try {
            return (0, shared_1.ok)(await service.listUnpaid(classId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('feetypes:list', async (_, levelId) => {
        try {
            return (0, shared_1.ok)(await service.listFeeTypes(levelId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('feetypes:create', async (_, data, actorId) => {
        try {
            return (0, shared_1.ok)(await service.createFeeType(data, actorId));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
    electron_1.ipcMain.handle('payments:receipt', async (_, id) => {
        try {
            return (0, shared_1.ok)(await service.getById(id));
        }
        catch (e) {
            return (0, shared_1.fail)(e.code ?? 'ERROR', e.message);
        }
    });
}
//# sourceMappingURL=payments.ipc.js.map