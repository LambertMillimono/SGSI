/**
 * auth-state.ts — Server-side auth state (main process only)
 * Token is stored here, never in the renderer.
 */
import jwt from 'jsonwebtoken'

interface AuthSession {
  userId:   string
  username: string
  role:     string
  token:    string
}

let _session: AuthSession | null = null
let _jwtSecret: string = 'change-me-in-production'

export function setJwtSecret(secret: string): void {
  _jwtSecret = secret || 'change-me-in-production'
}

export function getJwtSecret(): string {
  return _jwtSecret
}

export function setSession(session: AuthSession): void {
  _session = session
}

export function clearSession(): void {
  _session = null
}

export function getSession(): AuthSession | null {
  return _session
}

/** Verify a token and return its payload, or null if invalid */
export function verifyToken(token: string): { userId: string; username: string; role: string } | null {
  try {
    const payload = jwt.verify(token, _jwtSecret) as any
    return { userId: payload.userId, username: payload.username, role: payload.role }
  } catch {
    return null
  }
}

/** Returns the verified userId from the current session */
export function getAuthenticatedUserId(): string | null {
  if (!_session) return null
  const payload = verifyToken(_session.token)
  return payload?.userId ?? null
}

/** Returns the verified role from the current session */
export function getAuthenticatedRole(): string | null {
  if (!_session) return null
  const payload = verifyToken(_session.token)
  return payload?.role ?? null
}
