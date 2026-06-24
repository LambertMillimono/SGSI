"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.closeDb = closeDb;
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
let _prisma = null;
function getDb() {
    if (!_prisma) {
        const isPackaged = process.env.NODE_ENV === 'production';
        const dbPath = isPackaged
            ? path_1.default.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db')
            : path_1.default.resolve(__dirname, '../../../../packages/db/prisma/sgsi.db');
        _prisma = new client_1.PrismaClient({
            datasources: { db: { url: `file:${dbPath}` } },
            log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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
//# sourceMappingURL=client.js.map