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

  async upsertGrade(
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

    const existing = await this.db.grade.findFirst({
      where: {
        enrollmentId: data.enrollmentId,
        subjectId: data.subjectId,
        period: data.period,
        evalType: data.evalType,
      },
    })

    let grade
    if (existing) {
      grade = await this.db.grade.update({
        where: { id: existing.id },
        data: { value: data.value },
      })
    } else {
      grade = await this.db.grade.create({
        data: { ...data, maxValue },
      })
    }

    await this.tryAudit(actorId, 'GRADE_UPSERTED', 'grade', grade.id)
    return grade
  }

  async listByClassSubjectPeriodEvalType(
    classId: string,
    subjectId: string,
    period: number,
    evalType: string
  ) {
    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: {
        student: { select: { firstName: true, lastName: true, matricule: true } },
        grades: {
          where: { subjectId, period, evalType },
          orderBy: { enteredAt: 'asc' },
          take: 1,
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    })

    return enrollments.map((e) => ({
      enrollmentId: e.id,
      studentName: `${e.student.lastName} ${e.student.firstName}`,
      matricule: e.student.matricule,
      grade: e.grades[0] ?? null,
    }))
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

    // N'inclure que les matières ayant au moins une note dans la moyenne générale
    const subjectsWithGrades = subjectAverages.filter((s) => s.grades.length > 0)
    const generalAverage = calcGeneralAverage(subjectsWithGrades as any)
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

  async statsBySubject(classId: string, period: number) {
    const classSubjects = await this.db.classSubject.findMany({
      where: { classId },
      include: { subject: true },
    })

    const enrollments = await this.db.enrollment.findMany({
      where: { classId, status: 'ACTIVE' },
      include: { grades: { where: { period } } },
    })

    return classSubjects.map((cs) => {
      const subjectGrades: number[] = []
      for (const enrollment of enrollments) {
        const grades = enrollment.grades.filter((g) => g.subjectId === cs.subjectId)
        if (grades.length > 0) {
          const totalWeight = grades.reduce((s, g) => s + g.weight, 0)
          const avg = totalWeight > 0
            ? grades.reduce((s, g) => s + g.value * g.weight, 0) / totalWeight
            : 0
          subjectGrades.push(avg)
        }
      }
      const classAverage = subjectGrades.length > 0
        ? Math.round((subjectGrades.reduce((s, v) => s + v, 0) / subjectGrades.length) * 100) / 100
        : null
      const minAvg = subjectGrades.length > 0 ? Math.min(...subjectGrades) : null
      const maxAvg = subjectGrades.length > 0 ? Math.max(...subjectGrades) : null
      const passing = subjectGrades.filter((v) => v >= 10).length

      return {
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        subjectCode: cs.subject.code,
        coefficient: cs.coefficient,
        classAverage,
        minAvg: minAvg !== null ? Math.round(minAvg * 100) / 100 : null,
        maxAvg: maxAvg !== null ? Math.round(maxAvg * 100) / 100 : null,
        passRate: subjectGrades.length > 0 ? Math.round((passing / subjectGrades.length) * 100) : null,
        count: subjectGrades.length,
      }
    })
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
