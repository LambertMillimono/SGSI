import { PrismaClient } from '@prisma/client'

export class MedicalService {
  constructor(private db: PrismaClient) {}

  async getRecord(studentId: string) {
    const existing = await this.db.medicalRecord.findUnique({
      where: { studentId },
      include: {
        consultations: { orderBy: { date: 'desc' } },
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
    })
    if (existing) return existing
    return this.db.medicalRecord.create({
      data: { studentId },
      include: {
        consultations: { orderBy: { date: 'desc' } },
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
    })
  }

  async updateRecord(id: string, data: {
    bloodType?: string
    allergies?: string
    conditions?: string
    emergencyContact?: string
  }) {
    return this.db.medicalRecord.update({
      where: { id },
      data,
      include: {
        consultations: { orderBy: { date: 'desc' } },
        student: { select: { firstName: true, lastName: true, matricule: true } },
      },
    })
  }

  async addConsultation(medicalRecordId: string, data: {
    reason: string
    treatment?: string
    notes?: string
    date?: Date
  }) {
    return this.db.consultation.create({
      data: {
        medicalRecordId,
        reason: data.reason,
        treatment: data.treatment ?? null,
        notes: data.notes ?? null,
        date: data.date ?? new Date(),
      },
    })
  }

  async deleteConsultation(id: string) {
    return this.db.consultation.delete({ where: { id } })
  }

  async listRecent(limit = 60) {
    return this.db.consultation.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: {
        medicalRecord: {
          include: {
            student: { select: { firstName: true, lastName: true, matricule: true } },
          },
        },
      },
    })
  }
}
