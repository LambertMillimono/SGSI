import { autoUpdater } from 'electron-updater'
import { BrowserWindow, ipcMain } from 'electron'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

export function initAutoUpdater(win: BrowserWindow): void {
  if (process.env.NODE_ENV === 'development') return

  const send = (channel: string, data?: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, data)
  }

  autoUpdater.on('checking-for-update',  ()      => send('update:checking'))
  autoUpdater.on('update-not-available', ()      => send('update:not-available'))
  autoUpdater.on('error',                (err)   => send('update:error', err.message))

  autoUpdater.on('update-available', (info) => {
    send('update:available', {
      version:     info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    send('update:progress', {
      percent:          Math.round(progress.percent),
      transferred:      progress.transferred,
      total:            progress.total,
      bytesPerSecond:   progress.bytesPerSecond,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    send('update:ready', { version: info.version })
  })

  ipcMain.handle('update:download', async () => {
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall(false, true)
  })

  // Vérifier les mises à jour 5 secondes après le démarrage
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // Re-vérifier toutes les 4 heures
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}
