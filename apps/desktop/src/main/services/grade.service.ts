import { PrismaClient } from '@prisma/client'
import {
  ServiceError,
  calcSubjectAverage,
  calcGeneralAverage,
  calcRankings,
  DEFAULT_EVAL_WEIGHTS,
} from '@sgsi/shared'
import type { EvalWeights } from '@sgsi/shared'

export class GradeService {
  constructor(private db: PrismaClient) {}

  async listByEnrollment(enrollmentId: string, period: number) {
    return this.db.grade.findMany({
      where: { enrollmentId, period },
      include: { subject: true },
      orderBy: { enteredAt: 'asc' },
    })
  }

  async save(
    data: {
      enrollmentId: string
      subjectId: string
      period: number
      evalType: string
      value: number
      maxValue?: number
    },
    actorId: string
  ) {
    const maxValue = data.maxValue ?? 20
    if (data.value < 0 || data.value > maxValue) {
      throw new ServiceError(
        'INVALID_GRADE',
        `Note invalide : ${data.value} (doit être entre 0 et ${maxValue})`
      )
    }

    const grade = await this.db.grade.create({
      data: { ...data, maxValue },
    })

    await this.tryAudit(actorId, 'GRADE_SAVED', 'grade', grade.id)
    return grade
  }

  async computeAverages(
    enrollmentId: string,
    period: number,
    weights: EvalWeights = DEFAULT_EVAL_WEIGHTS
  ) {
    const enrollment = await this.db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        class: {
          include: {
            subjects: { include: { subject: true } },
          },
        },
      },
    })
    if (!enrollment) {
      throw new ServiceError('ENROLLMENT_NOT_FOUND', 'Inscription introuvable')
    }

    const school = await this.db.school.findFirst()
    const eliminatoryThreshold = school?.eliminatoryThreshold ?? 5

    const grades = await this.listByEnrollment(enrollmentId, period)

    const subjectAverages = enrollment.class.subjects.map((cs) => {
      const subjectGrades = grades.filter((g) => g.subjectId === cs.subjectId)
      const average = calcSubjectAverage(subjectGrades as any, weights)
      return {
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        coefficient: cs.coefficient,
        average,
        grades: subjectGrades,
      }
    })

    const generalAverage = calcGeneralAverage(subjectAverages)
    const isEliminated = subjectAverages.some(
      (s) => s.grades.length > 0 && s.average < eliminatoryThreshold
    )

    return { subjectAverages, generalAverage, isEliminated }
  }

  async computeClassRankings(classId: string, period: number) {
    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: { student: true },
    })

    const averages = await Promise.all(
      enrollments.map(async (e) => {
        const { generalAverage, isEliminated } = await this.computeAverages(e.id, period)
        return {
          enrollmentId: e.id,
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`,
          generalAverage,
          isEliminated,
        }
      })
    )

    return calcRankings(averages)
  }

  async lockGrades(enrollmentId: string, period: number, actorId: string) {
    await this.db.grade.updateMany({
      where: { enrollmentId, period },
      data: { isLocked: true },
    })
    await this.tryAudit(actorId, 'GRADES_LOCKED', 'enrollment', enrollmentId, `period:${period}`)
  }

  private async tryAudit(
    userId: string,
    action: string,
    entity: string,
    entityId?: string,
    details?: string
  ) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId, details } })
    } catch {
      // Audit is non-fatal
    }
  }
}
