import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
import uiReducer from './uiSlice'

const AUTH_STORAGE_KEY = 'sgsi:auth'
const UI_STORAGE_KEY = 'sgsi:ui'

function loadFromStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function saveToStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* non-fatal */ }
}

function clearStorage(key: string) {
  try { localStorage.removeItem(key) } catch { /* non-fatal */ }
}

// Load saved UI prefs — default theme is 'dark' if never saved
const savedUi = loadFromStorage<{ theme: 'light' | 'dark'; sidebarCollapsed: boolean }>(UI_STORAGE_KEY)
const resolvedTheme: 'light' | 'dark' = savedUi?.theme ?? 'dark'

// Apply theme class immediately before React renders (prevents flash)
document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
  },
  preloadedState: {
    auth: loadFromStorage(AUTH_STORAGE_KEY),
    ui: {
      sidebarCollapsed: savedUi?.sidebarCollapsed ?? false,
      theme: resolvedTheme,
    },
  } as any,
})

// Persist auth + UI preferences on every state change
store.subscribe(() => {
  const { auth, ui } = store.getState()
  if (auth.isAuthenticated) {
    saveToStorage(AUTH_STORAGE_KEY, auth)
  } else {
    clearStorage(AUTH_STORAGE_KEY)
  }
  saveToStorage(UI_STORAGE_KEY, { theme: ui.theme, sidebarCollapsed: ui.sidebarCollapsed })
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
