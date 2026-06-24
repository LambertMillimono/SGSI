import { ipcMain, dialog, shell, app } from 'electron'
import type { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string) { return { success: false, error: { code: 'ERROR', message } } }

const DOCS_ROOT = path.join(app.getPath('userData'), 'student-docs')

const DOC_TYPES = [
  'Extrait de naissance',
  'Certificat de transfert',
  'Photo d\'identité',
  'Certificat médical',
  'Diplôme / Attestation',
  'Autre',
]

export function registerStudentDocumentIpc(db: PrismaClient): void {
  ipcMain.handle('studentdocs:list', async (_, studentId: string) => {
    try {
      const docs = await db.studentDocument.findMany({
        where: { studentId },
        orderBy: { uploadedAt: 'desc' },
      })
      return ok(docs)
    } catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('studentdocs:add', async (_, studentId: string, type: string) => {
    try {
      const result = await dialog.showOpenDialog({
        title: `Joindre : ${type}`,
        filters: [
          { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'] },
        ],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return ok(null)

      const src = result.filePaths[0]
      const filename = path.basename(src)
      const destDir = path.join(DOCS_ROOT, studentId)
      fs.mkdirSync(destDir, { recursive: true })
      const dest = path.join(destDir, `${Date.now()}_${filename}`)
      fs.copyFileSync(src, dest)

      const doc = await db.studentDocument.create({
        data: { studentId, type, filePath: dest },
      })
      return ok(doc)
    } catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('studentdocs:open', async (_, id: string) => {
    try {
      const doc = await db.studentDocument.findUnique({ where: { id } })
      if (!doc) return fail('Document introuvable')
      if (!fs.existsSync(doc.filePath)) return fail('Fichier introuvable sur le disque')
      await shell.openPath(doc.filePath)
      return ok(null)
    } catch (e: any) { return fail(e.message) }
  })

  ipcMain.handle('studentdocs:delete', async (_, id: string) => {
    try {
      const doc = await db.studentDocument.findUnique({ where: { id } })
      if (doc) {
        try { fs.unlinkSync(doc.filePath) } catch { /* file may already be gone */ }
      }
      await db.studentDocument.delete({ where: { id } })
      return ok(null)
    } catch (e: any) { return fail(e.message) }
  })

  // Return the list of allowed document types
  ipcMain.handle('studentdocs:types', async () => ok(DOC_TYPES))
}
