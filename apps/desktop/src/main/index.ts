import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import { getDb, closeDb } from './database/client'
import { registerIpcHandlers } from './ipc'
import { startExpressServer, stopExpressServer } from './server'
import { BackupService } from './services/backup.service'
import { checkOverdueAtStartup } from './ipc/relances.ipc'

// ── Suppress Chromium noise before app is ready ────────────────────────────
// Fixes "Critical error found -8 / No file for / Failed to save user data"
app.commandLine.appendSwitch('disk-cache-size', '0')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
// Fixes "Request Autofill.enable / Autofill.setAddresses wasn't found"
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')
// Suppress background HTTPS requests to Google services that produce
// "ssl_client_socket_impl handshake failed net_error -100" on restricted networks.
// These services (Safe Browsing, Component Updater, UMA, NQE) are not needed
// in a local school management app.
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')
app.commandLine.appendSwitch('disable-sync')
app.commandLine.appendSwitch('metrics-recording-only')
app.commandLine.appendSwitch('no-report-upload')

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "SGSI — Le numérique au service de l'éducation",
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173/')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function scheduleAutoBackup(db: ReturnType<typeof getDb>, dbPath: string) {
  const svc = new BackupService(db, dbPath)
  const LAST_BACKUP_KEY = 'sgsi:last-auto-backup'

  const run = async () => {
    try {
      const last = parseInt(global.__sgsiLastBackup ?? '0', 10)
      const now = Date.now()
      const ONE_DAY = 24 * 60 * 60 * 1000
      if (now - last >= ONE_DAY) {
        await svc.createDbBackup()
        global.__sgsiLastBackup = String(now)
        console.log('[SGSI] Sauvegarde automatique effectuée')
      }
    } catch (e) {
      console.error('[SGSI] Erreur sauvegarde automatique:', e)
    }
  }

  // Run shortly after startup, then every hour (actual write only if 24h have elapsed)
  setTimeout(run, 60_000)
  setInterval(run, 60 * 60 * 1000)
}

app.whenReady().then(async () => {
  // Clear any corrupted disk cache left from previous sessions
  await session.defaultSession.clearCache()

  const db = getDb()
  registerIpcHandlers(db)
  await startExpressServer(db)
  await createWindow()

  if (mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      checkOverdueAtStartup(db, mainWindow!)
    })
  }

  const dbPath = process.env.NODE_ENV === 'development'
    ? path.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')
    : path.join(process.env.APPDATA ?? '', 'sgsi', 'sgsi.db')
  scheduleAutoBackup(db, dbPath)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  stopExpressServer()
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})
