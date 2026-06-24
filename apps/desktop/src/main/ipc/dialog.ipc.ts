import { ipcMain, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'

function ok<T>(data: T) { return { success: true, data } }
function fail(message: string) { return { success: false, error: { code: 'ERROR', message } } }

export function registerDialogIpc(): void {
  // Pick an image → return base64 data URL
  ipcMain.handle('dialog:openImage', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Sélectionner une photo',
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return ok(null)
      const filePath = result.filePaths[0]
      const ext = path.extname(filePath).toLowerCase().replace('.', '')
      const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      const data = fs.readFileSync(filePath)
      return ok(`data:${mime};base64,${data.toString('base64')}`)
    } catch (e: any) { return fail(e.message) }
  })

  // Pick any file → copy to destDir → return { filename, destPath }
  ipcMain.handle('dialog:openAndCopyFile', async (_, destDir: string, extensions?: string[]) => {
    try {
      const filters = extensions?.length
        ? [{ name: 'Fichiers', extensions }]
        : [{ name: 'Tous les fichiers', extensions: ['*'] }]
      const result = await dialog.showOpenDialog({
        title: 'Sélectionner un fichier',
        filters,
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return ok(null)
      const src = result.filePaths[0]
      const filename = path.basename(src)
      const dest = path.join(destDir, `${Date.now()}_${filename}`)
      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(src, dest)
      return ok({ filename, destPath: dest })
    } catch (e: any) { return fail(e.message) }
  })

  // Open a file with the OS default application
  ipcMain.handle('shell:openPath', async (_, filePath: string) => {
    try { await shell.openPath(filePath); return ok(null) }
    catch (e: any) { return fail(e.message) }
  })
}
