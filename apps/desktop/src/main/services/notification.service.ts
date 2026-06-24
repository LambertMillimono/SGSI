import type { PrismaClient } from '@prisma/client'

export class NotificationService {
  constructor(private db: PrismaClient) {}

  async list(limit = 50) {
    return this.db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async countUnread() {
    return this.db.notification.count({ where: { isRead: false } })
  }

  async markRead(id: string) {
    return this.db.notification.update({ where: { id }, data: { isRead: true } })
  }

  async markAllRead() {
    return this.db.notification.updateMany({ where: { isRead: false }, data: { isRead: true } })
  }

  async create(data: { target: string; title: string; body: string; type: string }) {
    return this.db.notification.create({ data })
  }

  async delete(id: string) {
    return this.db.notification.delete({ where: { id } })
  }
}
