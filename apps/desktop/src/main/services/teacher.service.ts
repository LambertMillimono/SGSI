import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { sendEmail, buildTeacherWelcomeEmail, loadBrevoConfig } from './email.service'

export class TeacherService {
  constructor(private db: PrismaClient) {}

  private async audit(userId: string, action: string, entity: string, entityId?: string) {
    try {
      await this.db.auditLog.create({ data: { userId, action, entity, entityId } })
    } catch { /* non-fatal */ }
  }

  async list() {
    return this.db.teacher.findMany({
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, username: true },
        },
        homeClasses: { select: { id: true, name: true } },
        subjects: {
          include: { subject: { select: { name: true, code: true } }, class: { select: { name: true } } },
        },
      },
      orderBy: { matricule: 'asc' },
    })
  }

  async getById(id: string) {
    return this.db.teacher.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, isActive: true, username: true } },
        homeClasses: { select: { id: true, name: true } },
        subjects: {
          include: { subject: true, class: { select: { name: true } } },
        },
        salaries: { orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 12 },
      },
    })
  }

  async create(data: {
    firstName: string
    lastName: string
    email?: string
    phone?: string
    username: string
    password?: string
    diploma?: string
    hireDate?: Date
    contractType?: string
    baseSalary?: number
    hoursPerWeek?: number
  }, actorId: string) {
    const existing = await this.db.user.findFirst({ where: { username: data.username } })
    if (existing) throw new Error('Ce nom d\'utilisateur est déjà utilisé')

    const hashed = await bcrypt.hash(data.password ?? 'Enseignant@1234', 12)

    // Count existing teachers to generate matricule
    const count = await this.db.teacher.count()
    const school = await this.db.school.findFirst()
    const sigle = school?.sigle ?? 'ECO'
    const year = new Date().getFullYear()
    const matricule = `${sigle}-ENS-${year}-${String(count + 1).padStart(4, '0')}`

    const result = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          password: hashed,
          role: 'TEACHER',
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          isActive: true,
        },
      })

      const teacher = await tx.teacher.create({
        data: {
          matricule,
          userId: user.id,
          diploma: data.diploma,
          hireDate: data.hireDate,
          contractType: data.contractType,
          baseSalary: data.baseSalary ?? 0,
          hoursPerWeek: data.hoursPerWeek ?? 0,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      })

      return teacher
    })

    await this.audit(actorId, 'CREATE', 'teacher', result.id)

    // ── Envoyer l'email de bienvenue via Resend si configuré ──
    const tempPassword = data.password ?? 'Enseignant@1234'
    if (data.email && loadBrevoConfig()?.apiKey) {
      try {
        const html = buildTeacherWelcomeEmail({
          teacherName: `${data.firstName} ${data.lastName}`,
          username:    data.username,
          password:    tempPassword,
          schoolName:  school?.name  ?? 'Notre établissement',
          schoolPhone: school?.phone ?? undefined,
        })
        await sendEmail({
          to:      data.email,
          subject: `Vos identifiants SGSI — ${school?.name ?? 'SchoolManager Pro'}`,
          html,
        })
      } catch (emailErr: any) {
        // Email failure is non-fatal — teacher account is created
        console.warn('[SGSI] Email non envoyé:', emailErr.message)
      }
    }

    return { ...result, emailSent: !!(data.email && loadBrevoConfig()?.apiKey) }
  }

  async update(id: string, data: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
    diploma?: string
    hireDate?: Date
    contractType?: string
    baseSalary?: number
    hoursPerWeek?: number
    isActive?: boolean
  }, actorId: string) {
    const teacher = await this.db.teacher.findUnique({ where: { id } })
    if (!teacher) throw new Error('Enseignant introuvable')

    const result = await this.db.$transaction(async (tx) => {
      if (data.firstName || data.lastName || data.email !== undefined || data.phone !== undefined || data.isActive !== undefined) {
        await tx.user.update({
          where: { id: teacher.userId },
          data: {
            ...(data.firstName && { firstName: data.firstName }),
            ...(data.lastName && { lastName: data.lastName }),
            ...(data.email !== undefined && { email: data.email }),
            ...(data.phone !== undefined && { phone: data.phone }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        })
      }

      return tx.teacher.update({
        where: { id },
        data: {
          ...(data.diploma !== undefined && { diploma: data.diploma }),
          ...(data.hireDate !== undefined && { hireDate: data.hireDate }),
          ...(data.contractType !== undefined && { contractType: data.contractType }),
          ...(data.baseSalary !== undefined && { baseSalary: data.baseSalary }),
          ...(data.hoursPerWeek !== undefined && { hoursPerWeek: data.hoursPerWeek }),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true, email: true, phone: true, isActive: true } },
        },
      })
    })

    await this.audit(actorId, 'UPDATE', 'teacher', id)
    return result
  }

  async delete(id: string, actorId: string) {
    const teacher = await this.db.teacher.findUnique({
      where: { id },
      include: { subjects: true, homeClasses: true },
    })
    if (!teacher) throw new Error('Enseignant introuvable')
    if (teacher.subjects.length > 0) throw new Error('Cet enseignant est affecté à des matières. Retirez-le d\'abord des classes.')
    if (teacher.homeClasses.length > 0) throw new Error('Cet enseignant est professeur principal d\'une classe.')

    await this.db.$transaction(async (tx) => {
      await tx.teacher.delete({ where: { id } })
      await tx.user.delete({ where: { id: teacher.userId } })
    })

    await this.audit(actorId, 'DELETE', 'teacher', id)
  }

  async listSalaries(teacherId: string) {
    return this.db.salary.findMany({
      where: { teacherId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  async createSalary(data: {
    teacherId: string
    month: number
    year: number
    baseSalary: number
    bonuses?: number
    advances?: number
    deductions?: number
  }, actorId: string) {
    const net = (data.baseSalary + (data.bonuses ?? 0)) - (data.advances ?? 0) - (data.deductions ?? 0)
    const salary = await this.db.salary.create({
      data: {
        teacherId: data.teacherId,
        month: data.month,
        year: data.year,
        baseSalary: data.baseSalary,
        bonuses: data.bonuses ?? 0,
        advances: data.advances ?? 0,
        deductions: data.deductions ?? 0,
        netSalary: net,
      },
    })
    await this.audit(actorId, 'CREATE', 'salary', salary.id)
    return salary
  }

  async markSalaryPaid(salaryId: string, actorId: string) {
    const salary = await this.db.salary.update({
      where: { id: salaryId },
      data: { paidAt: new Date() },
    })
    await this.audit(actorId, 'UPDATE', 'salary', salaryId)
    return salary
  }

  async getSalaryReceipt(salaryId: string) {
    const salary = await this.db.salary.findUnique({
      where: { id: salaryId },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    })
    if (!salary) throw new Error('Bulletin de salaire introuvable')
    return salary
  }
}
