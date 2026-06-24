import type { PrismaClient } from '@prisma/client'

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export class ParentService {
  constructor(private db: PrismaClient) {}

  async listByStudent(studentId: string) {
    const links = await this.db.studentParent.findMany({
      where: { studentId },
      include: { parent: true },
    })
    return links.map(l => l.parent)
  }

  async create(data: {
    firstName: string
    lastName: string
    relation: string
    phone: string
    phone2?: string
    address?: string
    profession?: string
    email?: string
  }, studentId: string) {
    return this.db.$transaction(async (tx) => {
      const parent = await tx.parent.create({ data })
      await tx.studentParent.create({ data: { studentId, parentId: parent.id } })
      return parent
    })
  }

  async update(id: string, data: {
    firstName?: string
    lastName?: string
    relation?: string
    phone?: string
    phone2?: string
    address?: string
    profession?: string
    email?: string
  }) {
    return this.db.parent.update({ where: { id }, data })
  }

  async unlink(parentId: string, studentId: string) {
    await this.db.studentParent.delete({
      where: { studentId_parentId: { studentId, parentId } },
    })
  }

  async generateAccessCode(parentId: string) {
    const code = `PAR-${randomCode()}`
    await this.db.parent.update({ where: { id: parentId }, data: { accessCode: code } })
    return code
  }
}
