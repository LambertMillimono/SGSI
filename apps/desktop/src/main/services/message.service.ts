import type { PrismaClient } from '@prisma/client'

export class MessageService {
  constructor(private db: PrismaClient) {}

  async listInbox(userId: string) {
    return this.db.message.findMany({
      where: { toUserId: userId, isDeleted: false, parentId: null },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async listSent(userId: string) {
    return this.db.message.findMany({
      where: { fromUserId: userId, isDeleted: false, parentId: null },
      include: {
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: { where: { isDeleted: false }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getThread(messageId: string, userId: string) {
    const msg = await this.db.message.findUnique({
      where: { id: messageId },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        replies: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'asc' },
          include: {
            fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    })
    if (!msg) throw new Error('Message introuvable')
    // Mark as read if recipient is viewing
    if (msg.toUserId === userId && !msg.isRead) {
      await this.db.message.update({
        where: { id: messageId },
        data: { isRead: true, readAt: new Date() },
      })
    }
    return msg
  }

  async send(data: { fromUserId: string; toUserId: string; subject: string; body: string; parentId?: string }) {
    return this.db.message.create({
      data: {
        fromUserId: data.fromUserId,
        toUserId: data.toUserId,
        subject: data.subject,
        body: data.body,
        parentId: data.parentId ?? null,
      },
      include: {
        fromUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        toUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    })
  }

  async countUnread(userId: string) {
    return this.db.message.count({ where: { toUserId: userId, isRead: false, isDeleted: false } })
  }

  async markRead(messageId: string) {
    return this.db.message.update({
      where: { id: messageId },
      data: { isRead: true, readAt: new Date() },
    })
  }

  async delete(messageId: string, userId: string) {
    const msg = await this.db.message.findUnique({ where: { id: messageId } })
    if (!msg) throw new Error('Message introuvable')
    if (msg.fromUserId !== userId && msg.toUserId !== userId) throw new Error('Non autorisé')
    return this.db.message.update({ where: { id: messageId }, data: { isDeleted: true } })
  }
}
