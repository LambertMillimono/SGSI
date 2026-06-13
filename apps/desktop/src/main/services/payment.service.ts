import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'
import { formatReceiptNo } from '@sgsi/shared'
import type { PayMethod } from '@sgsi/shared'

export class PaymentService {
  constructor(private db: PrismaClient) {}

  async listByEnrollment(enrollmentId: string) {
    return this.db.payment.findMany({
      where: { enrollmentId },
      include: { feeType: true },
      orderBy: { paidAt: 'desc' },
    })
  }

  async record(
    data: {
      enrollmentId: string
      feeTypeId: string
      amount: number
      method: PayMethod
      note?: string
    },
    cashierId: string
  ) {
    if (data.amount <= 0) {
      throw new ServiceError('INVALID_AMOUNT', 'Le montant doit être supérieur à 0')
    }

    const now = new Date()
    // Count payments this month for receipt sequence
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const count = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth } } })
    const receiptNo = formatReceiptNo(now, count + 1)

    const payment = await this.db.payment.create({
      data: { ...data, receiptNo, cashierId, paidAt: now },
      include: { feeType: true },
    })

    await this.tryAudit(cashierId, 'PAYMENT_RECORDED', 'payment', payment.id, `amount:${data.amount}`)
    return payment
  }

  async listUnpaid(classId?: string) {
    const enrollments = await this.db.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        ...(classId ? { classId } : {}),
      },
      include: {
        student: true,
        class: { include: { level: true } },
        payments: { include: { feeType: true } },
      },
    })

    // For each enrollment, find fee types for their level and compute balance
    const result = await Promise.all(
      enrollments.map(async (e) => {
        const feeTypes = await this.db.feeType.findMany({
          where: { OR: [{ levelId: e.class.levelId }, { levelId: null }], isRequired: true },
        })
        const totalDue = feeTypes.reduce((sum, f) => sum + f.amount, 0)
        const totalPaid = e.payments.reduce((sum, p) => sum + p.amount, 0)
        return {
          studentId: e.studentId,
          studentName: `${e.student.firstName} ${e.student.lastName}`,
          matricule: e.student.matricule,
          className: e.class.name,
          totalDue,
          totalPaid,
          balance: totalDue - totalPaid,
        }
      })
    )

    // Only return students with a balance > 0
    return result.filter((r) => r.balance > 0)
  }

  async getById(id: string) {
    const payment = await this.db.payment.findUnique({
      where: { id },
      include: {
        feeType: true,
        enrollment: {
          include: {
            student: true,
            class: { include: { level: true } },
            academicYear: true,
          },
        },
      },
    })
    if (!payment) throw new ServiceError('PAYMENT_NOT_FOUND', `Paiement ${id} introuvable`)
    return payment
  }

  async listFeeTypes(levelId?: string) {
    return this.db.feeType.findMany({
      where: levelId ? { OR: [{ levelId }, { levelId: null }] } : undefined,
      include: { level: true },
      orderBy: { name: 'asc' },
    })
  }

  async createFeeType(
    data: { name: string; amount: number; levelId?: string; isRequired?: boolean },
    actorId: string
  ) {
    if (data.amount < 0) {
      throw new ServiceError('INVALID_AMOUNT', 'Le montant ne peut pas être négatif')
    }
    const feeType = await this.db.feeType.create({ data })
    await this.tryAudit(actorId, 'CREATE', 'feeType', feeType.id)
    return feeType
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
