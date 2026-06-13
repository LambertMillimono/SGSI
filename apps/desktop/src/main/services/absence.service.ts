import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'

export class AbsenceService {
  constructor(private db: PrismaClient) {}

  async record(
    data: {
      enrollmentId: string
      date: Date
      type: string
      justified?: boolean
      reason?: string
    },
    actorId: string
  ) {
    if (!['ABSENCE', 'LATE', 'EARLY_LEAVE'].includes(data.type)) {
      throw new ServiceError('INVALID_ABSENCE_TYPE', `Type d'absence invalide: ${data.type}`)
    }

    const absence = await this.db.absence.create({ data })
    await this.tryAudit(actorId, 'ABSENCE_RECORDED', 'absence', absence.id)
    return absence
  }

  async listByEnrollment(enrollmentId: string) {
    return this.db.absence.findMany({
      where: { enrollmentId },
      orderBy: { date: 'desc' },
    })
  }

  async listByClass(classId: string, date?: Date) {
    const where: any = {
      enrollment: { classId },
    }

    if (date) {
      const start = new Date(date)
      start.setHours(0, 0, 0, 0)
      const end = new Date(date)
      end.setHours(23, 59, 59, 999)
      where.date = { gte: start, lte: end }
    }

    return this.db.absence.findMany({
      where,
      include: {
        enrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    })
  }

  async justify(absenceId: string, reason: string, actorId: string) {
    const absence = await this.db.absence.findUnique({ where: { id: absenceId } })
    if (!absence) {
      throw new ServiceError('ABSENCE_NOT_FOUND', 'Absence introuvable')
    }

    const updated = await this.db.absence.update({
      where: { id: absenceId },
      data: { justified: true, reason },
    })

    await this.tryAudit(actorId, 'ABSENCE_JUSTIFIED', 'absence', absenceId)
    return updated
  }

  async countByEnrollment(enrollmentId: string): Promise<{ total: number; justified: number; unjustified: number }> {
    const absences = await this.db.absence.findMany({
      where: { enrollmentId, type: 'ABSENCE' },
    })
    const justified = absences.filter((a) => a.justified).length
    return {
      total: absences.length,
      justified,
      unjustified: absences.length - justified,
    }
  }

  private async tryAudit(userId: string, action: string, entity: string, entityId?: string) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } })
    } catch {
      // Audit is non-fatal
    }
  }
}
