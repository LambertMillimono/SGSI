"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const os_1 = __importDefault(require("os"));
class BackupService {
    db;
    dbPath;
    backupDir;
    constructor(db, dbPath) {
        this.db = db;
        this.dbPath = dbPath;
        this.backupDir = path_1.default.join(os_1.default.homedir(), 'Documents', 'SGSI', 'backups');
    }
    ensureBackupDir() {
        fs_1.default.mkdirSync(this.backupDir, { recursive: true });
    }
    timestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
    async createDbBackup() {
        this.ensureBackupDir();
        if (!fs_1.default.existsSync(this.dbPath)) {
            throw new Error(`Database file not found: ${this.dbPath}`);
        }
        const destPath = path_1.default.join(this.backupDir, `sgsi-${this.timestamp()}.db`);
        fs_1.default.copyFileSync(this.dbPath, destPath);
        return destPath;
    }
    async createZipBackup(photosDir) {
        this.ensureBackupDir();
        if (!fs_1.default.existsSync(this.dbPath)) {
            throw new Error(`Database file not found: ${this.dbPath}`);
        }
        const destPath = path_1.default.join(this.backupDir, `sgsi-${this.timestamp()}.zip`);
        return new Promise((resolve, reject) => {
            const output = fs_1.default.createWriteStream(destPath);
            const archive = (0, archiver_1.default)('zip', { zlib: { level: 9 } });
            output.on('close', () => resolve(destPath));
            archive.on('error', reject);
            archive.pipe(output);
            archive.file(this.dbPath, { name: 'sgsi.db' });
            if (photosDir && fs_1.default.existsSync(photosDir)) {
                archive.directory(photosDir, 'photos');
            }
            archive.finalize();
        });
    }
    async restore(backupPath) {
        if (!fs_1.default.existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }
        // Disconnect DB before overwriting
        await this.db.$disconnect();
        fs_1.default.copyFileSync(backupPath, this.dbPath);
    }
    listBackups() {
        this.ensureBackupDir();
        return fs_1.default
            .readdirSync(this.backupDir)
            .filter((f) => f.startsWith('sgsi-') && (f.endsWith('.db') || f.endsWith('.zip')))
            .map((f) => {
            const fullPath = path_1.default.join(this.backupDir, f);
            const stat = fs_1.default.statSync(fullPath);
            return { name: f, path: fullPath, size: stat.size, createdAt: stat.birthtime };
        })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backup.service.js.map