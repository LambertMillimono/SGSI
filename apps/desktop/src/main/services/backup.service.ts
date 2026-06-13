import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'
import os from 'os'

export class BackupService {
  private backupDir: string

  constructor(
    private db: PrismaClient,
    private dbPath: string
  ) {
    this.backupDir = path.join(os.homedir(), 'Documents', 'SGSI', 'backups')
  }

  private ensureBackupDir(): void {
    fs.mkdirSync(this.backupDir, { recursive: true })
  }

  private timestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  }

  async createDbBackup(): Promise<string> {
    this.ensureBackupDir()
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`)
    }
    const destPath = path.join(this.backupDir, `sgsi-${this.timestamp()}.db`)
    fs.copyFileSync(this.dbPath, destPath)
    return destPath
  }

  async createZipBackup(photosDir?: string): Promise<string> {
    this.ensureBackupDir()
    if (!fs.existsSync(this.dbPath)) {
      throw new Error(`Database file not found: ${this.dbPath}`)
    }
    const destPath = path.join(this.backupDir, `sgsi-${this.timestamp()}.zip`)

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => resolve(destPath))
      archive.on('error', reject)
      archive.pipe(output)

      archive.file(this.dbPath, { name: 'sgsi.db' })
      if (photosDir && fs.existsSync(photosDir)) {
        archive.directory(photosDir, 'photos')
      }

      archive.finalize()
    })
  }

  async restore(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }
    // Disconnect DB before overwriting
    await this.db.$disconnect()
    fs.copyFileSync(backupPath, this.dbPath)
  }

  listBackups(): { name: string; path: string; size: number; createdAt: Date }[] {
    this.ensureBackupDir()
    return fs
      .readdirSync(this.backupDir)
      .filter((f) => f.startsWith('sgsi-') && (f.endsWith('.db') || f.endsWith('.zip')))
      .map((f) => {
        const fullPath = path.join(this.backupDir, f)
        const stat = fs.statSync(fullPath)
        return { name: f, path: fullPath, size: stat.size, createdAt: stat.birthtime }
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }
}
