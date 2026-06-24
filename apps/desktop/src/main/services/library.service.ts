import type { PrismaClient } from '@prisma/client'

export class LibraryService {
  constructor(private db: PrismaClient) {}

  async listBooks(search?: string) {
    return this.db.book.findMany({
      where: search ? {
        OR: [
          { title: { contains: search } },
          { author: { contains: search } },
          { isbn: { contains: search } },
        ],
      } : undefined,
      include: { _count: { select: { loans: true } } },
      orderBy: { title: 'asc' },
    })
  }

  async createBook(data: { title: string; author?: string; isbn?: string; category?: string; copies: number }) {
    return this.db.book.create({ data: { ...data, available: data.copies } })
  }

  async updateBook(id: string, data: { title?: string; author?: string; isbn?: string; category?: string; copies?: number }) {
    return this.db.book.update({ where: { id }, data })
  }

  async deleteBook(id: string) {
    const loans = await this.db.bookLoan.count({ where: { bookId: id, returnedAt: null } })
    if (loans > 0) throw new Error('Ce livre a des emprunts en cours')
    return this.db.book.delete({ where: { id } })
  }

  async listLoans(filters?: { returned?: boolean; bookId?: string; studentId?: string }) {
    return this.db.bookLoan.findMany({
      where: {
        ...(filters?.bookId && { bookId: filters.bookId }),
        ...(filters?.studentId && { studentId: filters.studentId }),
        ...(filters?.returned === false && { returnedAt: null }),
        ...(filters?.returned === true && { returnedAt: { not: null } }),
      },
      include: {
        book: { select: { title: true, author: true } },
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
      orderBy: { borrowedAt: 'desc' },
    })
  }

  async createLoan(data: { bookId: string; studentId: string; dueDate: Date }) {
    const book = await this.db.book.findUnique({ where: { id: data.bookId } })
    if (!book) throw new Error('Livre introuvable')
    if (book.available <= 0) throw new Error('Aucun exemplaire disponible')

    const [loan] = await this.db.$transaction([
      this.db.bookLoan.create({ data }),
      this.db.book.update({ where: { id: data.bookId }, data: { available: book.available - 1 } }),
    ])
    return loan
  }

  async returnLoan(loanId: string, fine?: number) {
    const loan = await this.db.bookLoan.findUnique({ where: { id: loanId }, include: { book: true } })
    if (!loan) throw new Error('Emprunt introuvable')
    if (loan.returnedAt) throw new Error('Ce livre a déjà été retourné')

    const [updated] = await this.db.$transaction([
      this.db.bookLoan.update({
        where: { id: loanId },
        data: { returnedAt: new Date(), fine: fine ?? 0 },
      }),
      this.db.book.update({
        where: { id: loan.bookId },
        data: { available: loan.book.available + 1 },
      }),
    ])
    return updated
  }

  async stats() {
    const [totalBooks, totalLoans, activeLoans, overdueLoans] = await Promise.all([
      this.db.book.aggregate({ _sum: { copies: true }, _count: true }),
      this.db.bookLoan.count(),
      this.db.bookLoan.count({ where: { returnedAt: null } }),
      this.db.bookLoan.count({ where: { returnedAt: null, dueDate: { lt: new Date() } } }),
    ])
    return { totalBooks: totalBooks._count, totalCopies: totalBooks._sum.copies ?? 0, totalLoans, activeLoans, overdueLoans }
  }
}
