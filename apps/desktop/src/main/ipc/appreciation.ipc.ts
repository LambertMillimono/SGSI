/**
 * Appreciation configuration IPC — §9.2 "Appréciations automatiques configurables"
 * Stores thresholds in a JSON file in the app's userData folder.
 */

import { ipcMain, app } from 'electron'
import fs from 'fs'
import path from 'path'

const CONFIG_FILE = path.join(app.getPath('userData'), 'appreciation-config.json')

export interface AppreciationRange {
  min:   number
  max:   number
  label: string
  color: string
}

const DEFAULT_RANGES: AppreciationRange[] = [
  { min: 18, max: 20,   label: 'Excellent',   color: '#059669' },
  { min: 16, max: 17.99, label: 'Très Bien',  color: '#10B981' },
  { min: 14, max: 15.99, label: 'Bien',        color: '#3B82F6' },
  { min: 12, max: 13.99, label: 'Assez Bien', color: '#6366F1' },
  { min: 10, max: 11.99, label: 'Passable',    color: '#F59E0B' },
  { min:  0, max:  9.99, label: 'Insuffisant', color: '#DC2626' },
]

function loadRanges(): AppreciationRange[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch { /* use defaults */ }
  return DEFAULT_RANGES
}

function saveRanges(ranges: AppreciationRange[]): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(ranges, null, 2), 'utf-8')
}

/** Get appreciation label from average using current config */
export function getConfiguredAppreciation(average: number): string {
  const ranges = loadRanges()
  const match = ranges.find(r => average >= r.min && average <= r.max)
  return match?.label ?? 'Insuffisant'
}

export function registerAppreciationIpc(): void {
  ipcMain.handle('appreciation:getRanges', () => {
    try { return { success: true, data: loadRanges() } }
    catch (e: any) { return { success: false, error: { message: e.message } } }
  })

  ipcMain.handle('appreciation:saveRanges', (_, ranges: AppreciationRange[]) => {
    try {
      if (!Array.isArray(ranges) || ranges.length === 0) {
        return { success: false, error: { message: 'Tableau de plages invalide' } }
      }
      saveRanges(ranges)
      return { success: true, data: ranges }
    } catch (e: any) { return { success: false, error: { message: e.message } } }
  })

  ipcMain.handle('appreciation:reset', () => {
    try {
      saveRanges(DEFAULT_RANGES)
      return { success: true, data: DEFAULT_RANGES }
    } catch (e: any) { return { success: false, error: { message: e.message } } }
  })
}
