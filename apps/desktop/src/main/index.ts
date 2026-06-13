import { app, BrowserWindow } from 'electron'
import path from 'path'
import { getDb, closeDb } from './database/client'
import { registerIpcHandlers } from './ipc'
import { startExpressServer, stopExpressServer } from './server'

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
  // Phase 2 will load the React UI here
  mainWindow.loadURL('about:blank')
}

app.whenReady().then(async () => {
  const db = getDb()
  registerIpcHandlers(db)
  await startExpressServer(db)
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  stopExpressServer()
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})
