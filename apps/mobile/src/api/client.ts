/**
 * API client for SGSI mobile — communicates with the desktop Express server
 * Server: http://{desktopIP}:3721
 */

import * as SecureStore from 'expo-secure-store'

const PORT = 3721
const TOKEN_KEY   = 'sgsi:token'
const SERVER_KEY  = 'sgsi:server'

export type ApiError = { code: string; message: string }

class ApiClient {
  private serverIp = ''
  private token    = ''

  get baseUrl() { return `http://${this.serverIp}:${PORT}/api` }

  /* ── Persistence ─────────────────────────────────────────── */
  async loadFromStorage() {
    const [ip, token] = await Promise.all([
      SecureStore.getItemAsync(SERVER_KEY),
      SecureStore.getItemAsync(TOKEN_KEY),
    ])
    if (ip)    this.serverIp = ip
    if (token) this.token    = token
  }

  async saveServer(ip: string) {
    this.serverIp = ip
    await SecureStore.setItemAsync(SERVER_KEY, ip)
  }

  async saveToken(token: string) {
    this.token = token
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }

  async clearSession() {
    this.token    = ''
    this.serverIp = ''
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(SERVER_KEY),
    ])
  }

  get isConfigured() { return !!this.serverIp }
  get isAuthenticated() { return !!this.token }
  get savedServerIp() { return this.serverIp }

  /* ── HTTP helpers ─────────────────────────────────────────── */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
    timeoutMs = 8000
  ): Promise<T> {
    if (!this.serverIp) throw new Error('Serveur non configuré')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error ?? err.message ?? `HTTP ${res.status}`)
      }

      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  get<T>(path: string)              { return this.request<T>('GET', path) }
  post<T>(path: string, body: unknown) { return this.request<T>('POST', path, body) }

  /* ── Status check ─────────────────────────────────────────── */
  async checkServer(ip: string): Promise<{ name: string; version: string }> {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 4000)
    const res = await fetch(`http://${ip}:${PORT}/api/status`, { signal: controller.signal })
    if (!res.ok) throw new Error('Serveur non disponible')
    return res.json()
  }

  /* ── Auth ─────────────────────────────────────────────────── */
  async login(username: string, password: string) {
    const data = await this.post<{ token: string; role: string; userId: string; firstName?: string; lastName?: string }>(
      '/auth/login', { username, password }
    )
    await this.saveToken(data.token)
    return data
  }

  /* ── Student routes ───────────────────────────────────────── */
  getStudentGrades(studentId: string, period: number) {
    return this.get<any>(`/student/${studentId}/grades?period=${period}`)
  }
  getStudentAbsences(studentId: string) {
    return this.get<any>(`/student/${studentId}/absences`)
  }
  getStudentBulletin(studentId: string, period: number) {
    return this.get<any>(`/student/${studentId}/bulletin/${period}`)
  }
  getStudentPayments(studentId: string) {
    return this.get<any>(`/student/${studentId}/payments`)
  }

  /* ── Teacher routes ───────────────────────────────────────── */
  getTeacherSchedule() {
    return this.get<any>('/teacher/schedule')
  }
  getTeacherClasses() {
    return this.get<any>('/teacher/classes')
  }
  getClassStudents(classId: string) {
    return this.get<any>(`/teacher/classes/${classId}/students`)
  }
  saveGrades(enrollmentId: string, period: number, grades: any[]) {
    return this.post<any>('/teacher/grades', { enrollmentId, period, grades })
  }
  saveAbsences(data: any) {
    return this.post<any>('/teacher/absences', data)
  }

  /* ── Payments routes ──────────────────────────────────────── */
  getPayments() {
    return this.get<any>('/payments')
  }
}

export const api = new ApiClient()
