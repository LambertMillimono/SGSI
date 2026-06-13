import { PrismaClient } from '@prisma/client'

export class AuditService {
  constructor(private db: PrismaClient) {}

  async list(filters?: {
    userId?: string
    entity?: string
    action?: string
    from?: Date
    to?: Date
    limit?: number
  }) {
    return this.db.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.entity && { entity: filters.entity }),
        ...(filters?.action && { action: filters.action }),
        ...((filters?.from || filters?.to) && {
          createdAt: {
            ...(filters.from && { gte: filters.from }),
            ...(filters.to && { lte: filters.to }),
          },
        }),
      },
      include: {
        user: {
          select: { username: true, firstName: true, lastName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 500,
    })
  }

  async countByAction(from: Date, to: Date) {
    const logs = await this.db.auditLog.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { action: true },
    })
    const counts: Record<string, number> = {}
    for (const log of logs) {
      counts[log.action] = (counts[log.action] ?? 0) + 1
    }
    return counts
  }
}
