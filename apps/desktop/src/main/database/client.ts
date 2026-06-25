import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let _prisma: PrismaClient | null = null

function getDbPath(): string {
  const isPackaged = app.isPackaged
  return isPackaged
    ? path.join(app.getPath('userData'), 'sgsi.db')
    : path.resolve(__dirname, '../../../../packages/db/prisma/sgsi.db')
}

function ensureDbExists(dbPath: string): void {
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  if (!fs.existsSync(dbPath)) {
    // Copier la DB template fournie avec l'app
    const templatePath = path.join(process.resourcesPath, 'template.db')
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, dbPath)
    }
  }
}

export function getDb(): PrismaClient {
  if (!_prisma) {
    const dbPath = getDbPath()

    if (app.isPackaged) {
      ensureDbExists(dbPath)
    }

    _prisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
      log: app.isPackaged ? ['error'] : ['error', 'warn'],
    })
  }
  return _prisma
}

export async function closeDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
  }
}
