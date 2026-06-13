import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'

export class ClassService {
  constructor(private db: PrismaClient) {}

  /** Best-effort audit log — does not throw if userId is not a valid FK */
  private async audit(userId: string, action: string, entity: string, entityId?: string) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } })
    } catch {
      // Audit failures are non-fatal
    }
  }

  async listLevels() {
    return this.db.level.findMany({ orderBy: { order: 'asc' } })
  }

  async createLevel(data: { name: string; order: number }, actorId: string) {
    const level = await this.db.level.create({ data })
    await this.audit(actorId, 'CREATE', 'level', level.id)
    return level
  }

  async listClasses(academicYearId?: string) {
    return this.db.class.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      include: {
        level: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async createClass(
    data: { name: string; levelId: string; academicYearId: string; maxStudents?: number },
    actorId: string
  ) {
    const cls = await this.db.class.create({ data })
    await this.audit(actorId, 'CREATE', 'class', cls.id)
    return cls
  }

  async findClassById(id: string) {
    const cls = await this.db.class.findUnique({
      where: { id },
      include: {
        level: true,
        subjects: { include: { subject: true, teacher: { include: { user: true } } } },
        _count: { select: { enrollments: true } },
      },
    })
    if (!cls) {
      throw new ServiceError('CLASS_NOT_FOUND', `Classe introuvable`)
    }
    return cls
  }

  async updateClass(
    id: string,
    data: Partial<{ name: string; maxStudents: number; teacherId: string }>,
    actorId: string
  ) {
    await this.findClassById(id)
    const cls = await this.db.class.update({ where: { id }, data })
    await this.audit(actorId, 'UPDATE', 'class', id)
    return cls
  }
}
