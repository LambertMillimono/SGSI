import { create } from 'zustand'
import { api } from '../api/client'

export type UserRole = 'PARENT' | 'TEACHER' | 'STUDENT' | 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY'

interface AuthState {
  isLoading:       boolean
  isAuthenticated: boolean
  token:           string | null
  role:            UserRole | null
  userId:          string | null
  firstName:       string | null
  lastName:        string | null
  studentId:       string | null  // for parent/student accounts
  serverIp:        string | null

  initialize:  () => Promise<void>
  login:       (serverIp: string, username: string, password: string) => Promise<void>
  logout:      () => Promise<void>
  setStudentId:(id: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoading:       true,
  isAuthenticated: false,
  token:           null,
  role:            null,
  userId:          null,
  firstName:       null,
  lastName:        null,
  studentId:       null,
  serverIp:        null,

  initialize: async () => {
    try {
      await api.loadFromStorage()
      if (api.isAuthenticated && api.isConfigured) {
        // Verify token still valid by checking server status
        try {
          await api.checkServer(api.savedServerIp)
          set({
            isAuthenticated: true,
            serverIp:        api.savedServerIp,
            isLoading:       false,
          })
          return
        } catch {
          await api.clearSession()
        }
      }
    } catch { /* ignore */ }
    set({ isLoading: false, isAuthenticated: false })
  },

  login: async (serverIp: string, username: string, password: string) => {
    // Save server IP first
    await api.saveServer(serverIp)

    const data = await api.login(username, password)
    set({
      isAuthenticated: true,
      token:           data.token,
      role:            data.role as UserRole,
      userId:          data.userId,
      firstName:       data.firstName ?? null,
      lastName:        data.lastName  ?? null,
      serverIp,
    })
  },

  logout: async () => {
    await api.clearSession()
    set({
      isAuthenticated: false,
      token:           null,
      role:            null,
      userId:          null,
      firstName:       null,
      lastName:        null,
      studentId:       null,
      serverIp:        null,
    })
  },

  setStudentId: (id: string) => set({ studentId: id }),
}))
