import type { PrismaClient } from '@prisma/client'

export class AuditLogService {
  constructor(private db: PrismaClient) {}

  async list(filters?: { userId?: string; entity?: string; limit?: number }) {
    return this.db.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.entity && { entity: filters.entity }),
      },
      include: { user: { select: { firstName: true, lastName: true, username: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 200,
    })
  }

  async listEntities() {
    const rows = await this.db.auditLog.findMany({
      select: { entity: true },
      distinct: ['entity'],
      orderBy: { entity: 'asc' },
    })
    return rows.map(r => r.entity)
  }
}
