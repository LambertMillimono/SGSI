import { PrismaClient } from '@prisma/client'

export class ExpenseService {
  constructor(private db: PrismaClient) {}

  async list(filters?: { year?: number; month?: number; category?: string }) {
    const where: any = {}
    if (filters?.year || filters?.month) {
      const y = filters.year ?? new Date().getFullYear()
      const m = filters.month
      if (m) {
        const start = new Date(y, m - 1, 1)
        const end = new Date(y, m, 0, 23, 59, 59)
        where.doneAt = { gte: start, lte: end }
      } else {
        where.doneAt = { gte: new Date(y, 0, 1), lte: new Date(y, 11, 31, 23, 59, 59) }
      }
    }
    if (filters?.category) where.category = filters.category

    return this.db.expense.findMany({ where, orderBy: { doneAt: 'desc' } })
  }

  async create(data: {
    label: string
    amount: number
    category: string
    recordedBy: string
    doneAt?: Date
  }) {
    return this.db.expense.create({
      data: {
        label: data.label,
        amount: data.amount,
        category: data.category,
        recordedBy: data.recordedBy,
        doneAt: data.doneAt ?? new Date(),
      },
    })
  }

  async delete(id: string) {
    return this.db.expense.delete({ where: { id } })
  }

  async monthlySummary(year: number) {
    const expenses = await this.db.expense.findMany({
      where: { doneAt: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } },
    })

    const byMonth: Record<number, number> = {}
    const byCategory: Record<string, number> = {}
    let total = 0

    for (const e of expenses) {
      const m = new Date(e.doneAt).getMonth() + 1
      byMonth[m] = (byMonth[m] ?? 0) + e.amount
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount
      total += e.amount
    }

    return { byMonth, byCategory, total, count: expenses.length }
  }

  // Cash register
  async getTodayCash() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return this.db.cashRegister.findFirst({ where: { date: today } })
  }

  async openCash(openBalance: number, openedBy: string) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const existing = await this.db.cashRegister.findFirst({ where: { date: today } })
    if (existing) throw new Error('La caisse est déjà ouverte aujourd\'hui')
    return this.db.cashRegister.create({
      data: { date: today, openBalance, openedBy, isClosed: false },
    })
  }

  async closeCash(id: string, closeBalance: number, closedBy: string) {
    return this.db.cashRegister.update({
      where: { id },
      data: { closeBalance, closedBy, isClosed: true },
    })
  }
}
