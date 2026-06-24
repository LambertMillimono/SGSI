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

  async updateFeeType(
    id: string,
    data: { name?: string; amount?: number; isRequired?: boolean },
    actorId: string
  ) {
    const updated = await this.db.feeType.update({ where: { id }, data })
    await this.tryAudit(actorId, 'UPDATE', 'feeType', id)
    return updated
  }

  async deleteFeeType(id: string, actorId: string) {
    const count = await this.db.payment.count({ where: { feeTypeId: id } })
    if (count > 0) {
      throw new ServiceError(
        'FEE_TYPE_IN_USE',
        `Ce type de frais est utilisé dans ${count} paiement(s). Suppression impossible.`
      )
    }
    await this.db.feeType.delete({ where: { id } })
    await this.tryAudit(actorId, 'DELETE', 'feeType', id)
  }

  /* ── REMISES ET EXONÉRATIONS ────────────────────────────────────── */

  /**
   * Record a discount/exemption for a student enrollment.
   * Stored as a special Payment with method='DISCOUNT' and a motif in `note`.
   * The amount is DEDUCTED from the student's balance just like a real payment.
   */
  async recordDiscount(data: {
    enrollmentId: string
    feeTypeId:    string
    amount:       number
    motif:        string
  }, cashierId: string) {
    if (data.amount <= 0) throw new ServiceError('INVALID_AMOUNT', 'Le montant de la remise doit être > 0')

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const count  = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth } } })
    const receiptNo = `REM-${formatReceiptNo(now, count + 1)}`

    const discount = await this.db.payment.create({
      data: {
        enrollmentId: data.enrollmentId,
        feeTypeId:    data.feeTypeId,
        amount:       data.amount,
        method:       'DISCOUNT',
        receiptNo,
        cashierId,
        note:         data.motif,
        paidAt:       now,
      },
      include: { feeType: true },
    })

    await this.tryAudit(cashierId, 'DISCOUNT', 'payment', discount.id, `amount:${data.amount} motif:${data.motif}`)
    return discount
  }

  /** List discounts for an enrollment. */
  async listDiscounts(enrollmentId: string) {
    return this.db.payment.findMany({
      where: { enrollmentId, method: 'DISCOUNT' },
      include: { feeType: true },
      orderBy: { paidAt: 'desc' },
    })
  }

  /* ── PRÉVISIONS DE RECETTES ─────────────────────────────────────── */

  /**
   * Calculate expected vs actual revenue for the current year.
   * Expected = sum(required feeTypes × active enrollments)
   * Actual   = sum(all real payments — excludes PLAN and DISCOUNT containers)
   */
  async forecast(year: number) {
    const start = new Date(year, 0, 1)
    const end   = new Date(year, 11, 31, 23, 59, 59)

    // All active enrollments with their class level
    const enrollments = await this.db.enrollment.findMany({
      where: { status: 'ACTIVE' },
      include: {
        class: { include: { level: true } },
        payments: {
          where: { paidAt: { gte: start, lte: end }, method: { not: 'PLAN' } },
        },
      },
    })

    // Required fee types
    const allFeeTypes = await this.db.feeType.findMany({
      where: { isRequired: true },
    })

    let totalExpected = 0
    let totalPaid     = 0
    const byFeeType: Record<string, { name: string; expected: number; paid: number }> = {}

    for (const enrollment of enrollments) {
      const levelId  = enrollment.class.levelId
      const feesForLevel = allFeeTypes.filter(
        f => f.levelId === null || f.levelId === levelId
      )

      for (const fee of feesForLevel) {
        totalExpected += fee.amount
        if (!byFeeType[fee.id]) {
          byFeeType[fee.id] = { name: fee.name, expected: 0, paid: 0 }
        }
        byFeeType[fee.id].expected += fee.amount
      }

      const paidForEnrollment = enrollment.payments.reduce((s, p) => s + p.amount, 0)
      totalPaid += paidForEnrollment
    }

    // Actual payments per fee type
    const actualByFeeType = await this.db.payment.groupBy({
      by: ['feeTypeId'],
      where: {
        paidAt: { gte: start, lte: end },
        method: { notIn: ['PLAN'] },
      },
      _sum: { amount: true },
    })

    for (const row of actualByFeeType) {
      if (byFeeType[row.feeTypeId]) {
        byFeeType[row.feeTypeId].paid = row._sum.amount ?? 0
      }
    }

    const remaining = totalExpected - totalPaid
    const rate      = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0

    return {
      year,
      totalExpected,
      totalPaid,
      remaining,
      rate,
      activeEnrollments: enrollments.length,
      byFeeType: Object.values(byFeeType).sort((a, b) => b.expected - a.expected),
    }
  }

  /* ── PAYMENT PLANS (paiement partiel / échelonné) ──────────────── */

  /**
   * Create a payment plan: parent Payment (amount=0, method='PLAN') + installments.
   * The parent acts as a container — actual payments are created when installments are paid.
   */
  async createPlan(
    data: {
      enrollmentId: string
      feeTypeId: string
      totalAmount: number
      installments: Array<{ dueDate: Date; amount: number }>
    },
    cashierId: string
  ) {
    if (data.installments.length < 2) {
      throw new ServiceError('INVALID_PLAN', 'Un plan doit avoir au minimum 2 tranches')
    }
    const sumInstallments = data.installments.reduce((s, i) => s + i.amount, 0)
    if (Math.abs(sumInstallments - data.totalAmount) > 0.01) {
      throw new ServiceError('INVALID_PLAN', 'La somme des tranches doit être égale au montant total')
    }

    // Create plan container Payment (method='PLAN', amount=0 — excluded from balance calc)
    const plan = await this.db.payment.create({
      data: {
        enrollmentId: data.enrollmentId,
        feeTypeId: data.feeTypeId,
        amount: 0,
        method: 'PLAN',
        receiptNo: `PLAN-${Date.now()}`,
        cashierId,
        note: `Plan ${data.installments.length} tranches · Total ${data.totalAmount}`,
      },
    })

    // Create installment records
    await this.db.paymentInstallment.createMany({
      data: data.installments.map(i => ({
        paymentId: plan.id,
        dueDate: i.dueDate,
        amount: i.amount,
      })),
    })

    await this.tryAudit(cashierId, 'CREATE_PLAN', 'payment', plan.id, `total:${data.totalAmount}`)
    return this.getPlanById(plan.id)
  }

  /**
   * List all payment plans (method='PLAN') for an enrollment, with their installments.
   */
  async listPlans(enrollmentId: string) {
    return this.db.payment.findMany({
      where: { enrollmentId, method: 'PLAN' },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: 'asc' } },
      },
      orderBy: { paidAt: 'desc' },
    })
  }

  /** List ALL plans (all enrollments) with student info — for the management page. */
  async listAllPlans() {
    return this.db.payment.findMany({
      where: { method: 'PLAN' },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: 'asc' } },
        enrollment: {
          include: {
            student: true,
            class: true,
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    })
  }

  async getPlanById(id: string) {
    return this.db.payment.findUnique({
      where: { id },
      include: {
        feeType: true,
        installments: { orderBy: { dueDate: 'asc' } },
        enrollment: {
          include: { student: true, class: true },
        },
      },
    })
  }

  /**
   * Pay a single installment:
   * 1. Mark the installment as paid
   * 2. Create an actual Payment record (with receipt) for the tranche amount
   */
  async payInstallment(
    installmentId: string,
    method: string,
    cashierId: string
  ) {
    const installment = await this.db.paymentInstallment.findUnique({
      where: { id: installmentId },
      include: {
        payment: {
          include: { enrollment: { include: { class: true } } },
        },
      },
    })
    if (!installment) throw new ServiceError('NOT_FOUND', 'Tranche introuvable')
    if (installment.isPaid) throw new ServiceError('ALREADY_PAID', 'Cette tranche a déjà été payée')

    const plan = installment.payment

    // Mark installment as paid
    await this.db.paymentInstallment.update({
      where: { id: installmentId },
      data: { isPaid: true, paidAt: new Date() },
    })

    // Create actual Payment (shows in balance calculation)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const count = await this.db.payment.count({ where: { paidAt: { gte: startOfMonth }, method: { not: 'PLAN' } } })
    const receiptNo = formatReceiptNo(now, count + 1)

    const payment = await this.db.payment.create({
      data: {
        enrollmentId: plan.enrollmentId,
        feeTypeId: plan.feeTypeId,
        amount: installment.amount,
        method,
        receiptNo,
        cashierId,
        paidAt: now,
        note: `Tranche plan — ${formatReceiptNo(new Date(plan.paidAt), 1)}`,
      },
      include: { feeType: true },
    })

    await this.tryAudit(cashierId, 'PAY_INSTALLMENT', 'paymentInstallment', installmentId, `amount:${installment.amount}`)
    return { installment: { ...installment, isPaid: true, paidAt: now }, payment }
  }

  /** Delete an unpaid plan (cannot delete if any installment has been paid). */
  async deletePlan(planId: string, actorId: string) {
    const plan = await this.db.payment.findUnique({
      where: { id: planId },
      include: { installments: true },
    })
    if (!plan || plan.method !== 'PLAN') throw new ServiceError('NOT_FOUND', 'Plan introuvable')
    const anyPaid = plan.installments.some(i => i.isPaid)
    if (anyPaid) throw new ServiceError('PLAN_HAS_PAYMENTS', 'Ce plan a des tranches déjà payées. Suppression impossible.')

    await this.db.paymentInstallment.deleteMany({ where: { paymentId: planId } })
    await this.db.payment.delete({ where: { id: planId } })
    await this.tryAudit(actorId, 'DELETE_PLAN', 'payment', planId)
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
