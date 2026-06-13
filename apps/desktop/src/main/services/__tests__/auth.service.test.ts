import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { AuthService } from '../auth.service'

let prisma: PrismaClient
let authService: AuthService

beforeAll(async () => {
  // Use the dev database — it already has the full schema applied via migrations
  // Resolve path: from __tests__ go 6 levels up to repo root, then into packages/db/prisma
  const { resolve } = await import('path')
  const dbPath = resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')

  prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  })

  // Use the main dev database for tests but with unique test data
  const hash = await bcrypt.hash('password123', 4) // cost 4 for speed in tests
  await prisma.user.upsert({
    where: { username: 'testuser-auth' },
    // Always reset password and flags to ensure a clean starting state
    update: { password: hash, mustChangePassword: false, isActive: true },
    create: {
      username: 'testuser-auth',
      password: hash,
      role: 'SECRETARY',
      firstName: 'Test',
      lastName: 'User',
    },
  })

  authService = new AuthService(prisma, 'test-jwt-secret')
})

afterAll(async () => {
  // Delete audit logs first (foreign key constraint) then the user
  const users = await prisma.user.findMany({ where: { username: 'testuser-auth' } })
  for (const u of users) {
    await prisma.auditLog.deleteMany({ where: { userId: u.id } })
  }
  await prisma.user.deleteMany({ where: { username: 'testuser-auth' } })
  await prisma.$disconnect()
})

describe('AuthService.login', () => {
  it('returns JWT token and user on valid credentials', async () => {
    const result = await authService.login('testuser-auth', 'password123')
    expect(result.token).toBeDefined()
    expect(typeof result.token).toBe('string')
    expect(result.user.username).toBe('testuser-auth')
    expect(result.user.role).toBe('SECRETARY')
    // Password must NOT be in the response
    expect((result.user as any).password).toBeUndefined()
  })

  it('throws ServiceError with code INVALID_CREDENTIALS on wrong password', async () => {
    await expect(authService.login('testuser-auth', 'wrongpassword')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })

  it('throws ServiceError with code INVALID_CREDENTIALS on unknown user', async () => {
    await expect(authService.login('nonexistent', 'password')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    })
  })
})

describe('AuthService.verifyToken', () => {
  it('returns payload for valid token', async () => {
    const { token } = await authService.login('testuser-auth', 'password123')
    const payload = authService.verifyToken(token)
    expect(payload.username).toBe('testuser-auth')
    expect(payload.role).toBe('SECRETARY')
    expect(payload.userId).toBeDefined()
  })

  it('throws for invalid token', () => {
    expect(() => authService.verifyToken('not-a-token')).toThrow()
  })

  it('throws for tampered token', () => {
    expect(() => authService.verifyToken('eyJhbGciOiJIUzI1NiJ9.tampered.signature')).toThrow()
  })
})

describe('AuthService.requestPasswordReset', () => {
  it('returns a temp password string', async () => {
    const users = await prisma.user.findMany({ where: { username: 'testuser-auth' } })
    const tempPwd = await authService.requestPasswordReset(users[0].id, users[0].id)
    expect(typeof tempPwd).toBe('string')
    expect(tempPwd.length).toBeGreaterThan(0)
  })

  it('sets mustChangePassword=true on user', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } })
    expect(user?.mustChangePassword).toBe(true)
  })
})

describe('AuthService.changePassword', () => {
  it('allows login with new password after change', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } })
    await authService.changePassword(user!.id, 'NewSecurePassword@456')
    const result = await authService.login('testuser-auth', 'NewSecurePassword@456')
    expect(result.token).toBeDefined()
  })

  it('sets mustChangePassword=false after change', async () => {
    const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } })
    expect(user?.mustChangePassword).toBe(false)
  })
})
