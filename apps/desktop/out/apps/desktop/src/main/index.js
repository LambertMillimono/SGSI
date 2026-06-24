"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const client_1 = require("./database/client");
const ipc_1 = require("./ipc");
const server_1 = require("./server");
let mainWindow = null;
async function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 600,
        title: "SGSI — Le numérique au service de l'éducation",
        webPreferences: {
            preload: path_1.default.join(__dirname, '../preload/index.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Phase 2 will load the React UI here
    mainWindow.loadURL('about:blank');
}
electron_1.app.whenReady().then(async () => {
    const db = (0, client_1.getDb)();
    (0, ipc_1.registerIpcHandlers)(db);
    await (0, server_1.startExpressServer)(db);
    await createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', async () => {
    (0, server_1.stopExpressServer)();
    await (0, client_1.closeDb)();
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
//# sourceMappingURL=index.js.map