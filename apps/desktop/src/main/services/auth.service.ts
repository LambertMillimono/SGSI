import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { ServiceError } from '@sgsi/shared'
import type { TokenPayload, Role } from '@sgsi/shared'

export class AuthService {
  constructor(
    private db: PrismaClient,
    private jwtSecret: string
  ) {}

  async login(
    username: string,
    password: string
  ): Promise<{
    token: string
    user: { id: string; username: string; role: string; firstName: string; lastName: string; mustChangePassword: boolean }
  }> {
    const user = await this.db.user.findUnique({ where: { username } })

    if (!user || !user.isActive) {
      throw new ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides')
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides')
    }

    await this.db.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    await this.db.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'user',
        entityId: user.id,
      },
    })

    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      role: user.role as Role,
    }

    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '8h' })

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        mustChangePassword: user.mustChangePassword,
      },
    }
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload
  }

  async requestPasswordReset(userId: string, requestedBy: string): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let tempPassword = ''
    for (let i = 0; i < 8; i++) {
      tempPassword += chars.charAt(Math.floor(Math.random() * chars.length))
    }

    const hashed = await bcrypt.hash(tempPassword, 12)
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await this.db.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        mustChangePassword: true,
        tempPasswordExpiry: expiry,
      },
    })

    await this.db.auditLog.create({
      data: {
        userId: requestedBy,
        action: 'PASSWORD_RESET_REQUEST',
        entity: 'user',
        entityId: userId,
      },
    })

    return tempPassword
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 12)
    await this.db.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        mustChangePassword: false,
        tempPasswordExpiry: null,
      },
    })

    await this.db.auditLog.create({
      data: {
        userId,
        action: 'PASSWORD_CHANGED',
        entity: 'user',
        entityId: userId,
      },
    })
  }

  async checkPermission(userId: string, module: string, action: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user || !user.isActive) return false
    if (user.role === 'SUPER_ADMIN') return true

    const { ROLE_PERMISSIONS } = await import('@sgsi/shared')
    const perms = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? []
    return perms.some(
      (p) =>
        (p.module === module || p.module === '*') &&
        (p.actions as string[]).includes(action)
    )
  }
}
