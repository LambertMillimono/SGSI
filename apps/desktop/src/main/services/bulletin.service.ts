import { PrismaClient } from '@prisma/client'
import { ServiceError, getAppreciation } from '@sgsi/shared'
import { GradeService } from './grade.service'

export class BulletinService {
  private gradeService: GradeService

  constructor(private db: PrismaClient) {
    this.gradeService = new GradeService(db)
  }

  async generate(enrollmentId: string, period: number, actorId: string) {
    const enrollment = await this.db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { class: true },
    })
    if (!enrollment) {
      throw new ServiceError('ENROLLMENT_NOT_FOUND', 'Inscription introuvable')
    }

    const { generalAverage, subjectAverages, isEliminated } =
      await this.gradeService.computeAverages(enrollmentId, period)

    const rankings = await this.gradeService.computeClassRankings(enrollment.classId, period)
    const myRank = rankings.find((r) => r.enrollmentId === enrollmentId)

    const school = await this.db.school.findFirst()
    const passingAverage = school?.passingAverage ?? 10

    const decision = isEliminated
      ? 'Redouble'
      : generalAverage >= passingAverage
        ? 'Admis(e)'
        : 'Passage conditionnel'

    const bulletinId = `bulletin-${enrollmentId}-${period}`

    const bulletin = await this.db.bulletin.upsert({
      where: { id: bulletinId },
      update: {
        generalAverage,
        rank: myRank?.rank ?? 0,
        totalStudents: rankings.length,
        appreciation: getAppreciation(generalAverage),
        decision,
      },
      create: {
        id: bulletinId,
        enrollmentId,
        period,
        generalAverage,
        rank: myRank?.rank ?? 0,
        totalStudents: rankings.length,
        appreciation: getAppreciation(generalAverage),
        decision,
      },
    })

    await this.tryAudit(actorId, 'BULLETIN_GENERATED', 'bulletin', bulletin.id)
    return { bulletin, subjectAverages, rankings }
  }

  async validate(bulletinId: string, directorId: string) {
    const bulletin = await this.db.bulletin.findUnique({ where: { id: bulletinId } })
    if (!bulletin) {
      throw new ServiceError('BULLETIN_NOT_FOUND', 'Bulletin introuvable')
    }
    if (bulletin.isValidated) {
      throw new ServiceError('ALREADY_VALIDATED', 'Ce bulletin est déjà validé')
    }

    const updated = await this.db.bulletin.update({
      where: { id: bulletinId },
      data: { isValidated: true, validatedAt: new Date() },
    })

    await this.tryAudit(directorId, 'BULLETIN_VALIDATED', 'bulletin', bulletinId)
    return updated
  }

  async findByEnrollment(enrollmentId: string) {
    return this.db.bulletin.findMany({
      where: { enrollmentId },
      orderBy: { period: 'asc' },
    })
  }

  async findById(id: string) {
    const bulletin = await this.db.bulletin.findUnique({ where: { id } })
    if (!bulletin) {
      throw new ServiceError('BULLETIN_NOT_FOUND', 'Bulletin introuvable')
    }
    return bulletin
  }

  private async tryAudit(userId: string, action: string, entity: string, entityId?: string) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } })
    } catch {
      // Audit is non-fatal
    }
  }
}
