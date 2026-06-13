import { PrismaClient } from '@prisma/client'
import path from 'path'

let _prisma: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!_prisma) {
    const isPackaged = process.env.NODE_ENV === 'production'
    const dbPath = isPackaged
      ? path.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db')
      : path.resolve(__dirname, '../../../../packages/db/prisma/sgsi.db')

    _prisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
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
