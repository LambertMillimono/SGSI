import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'
import { generateMatricule } from '@sgsi/shared'
import type { CreateStudentInput } from '@sgsi/shared'

export class StudentService {
  constructor(private db: PrismaClient) {}

  /** Best-effort audit log — does not throw if userId is not a valid FK */
  private async audit(userId: string, action: string, entity: string, entityId?: string) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } })
    } catch {
      // Audit failures are non-fatal
    }
  }

  async list(filters?: { classId?: string; search?: string; yearId?: string }) {
    return this.db.student.findMany({
      where: {
        ...(filters?.search && {
          OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { matricule: { contains: filters.search } },
          ],
        }),
        ...(filters?.classId && {
          enrollments: { some: { classId: filters.classId } },
        }),
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
  }

  async findById(id: string) {
    const student = await this.db.student.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: { class: true, academicYear: true },
          orderBy: { enrolledAt: 'desc' },
        },
        parents: { include: { parent: true } },
        documents: true,
      },
    })
    if (!student) {
      throw new ServiceError('STUDENT_NOT_FOUND', `Élève introuvable`)
    }
    return student
  }

  async create(data: CreateStudentInput, actorId: string) {
    const school = await this.db.school.findFirst()
    if (!school) {
      throw new ServiceError('SCHOOL_NOT_CONFIGURED', 'École non configurée')
    }

    const year = new Date().getFullYear()
    const count = await this.db.student.count()
    const matricule = generateMatricule({
      schoolSigle: school.sigle,
      firstName: data.firstName,
      lastName: data.lastName,
      year,
      sequence: count + 1,
    })

    const student = await this.db.student.create({
      data: { ...data, matricule },
    })

    await this.audit(actorId, 'CREATE', 'student', student.id)

    return student
  }

  async update(id: string, data: Partial<CreateStudentInput>, actorId: string) {
    await this.findById(id)
    const student = await this.db.student.update({ where: { id }, data })
    await this.audit(actorId, 'UPDATE', 'student', id)
    return student
  }

  async delete(id: string, actorId: string) {
    await this.findById(id)
    await this.db.student.delete({ where: { id } })
    await this.audit(actorId, 'DELETE', 'student', id)
  }

  async enroll(studentId: string, classId: string, academicYearId: string, actorId: string) {
    await this.findById(studentId)
    const enrollment = await this.db.enrollment.create({
      data: { studentId, classId, academicYearId },
    })
    await this.audit(actorId, 'ENROLL', 'enrollment', enrollment.id)
    return enrollment
  }
}
