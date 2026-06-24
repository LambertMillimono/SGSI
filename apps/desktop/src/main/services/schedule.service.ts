import { PrismaClient } from '@prisma/client'

export class ScheduleService {
  constructor(private db: PrismaClient) {}

  async listByClass(classId: string) {
    return this.db.schedule.findMany({
      where: { classId },
      include: {
        teacher: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        room: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
  }

  async listByTeacher(teacherId: string) {
    return this.db.schedule.findMany({
      where: { teacherId },
      include: {
        class: { select: { name: true } },
        room: true,
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
  }

  async create(data: {
    classId: string
    teacherId: string
    roomId?: string
    dayOfWeek: number
    startTime: string
    endTime: string
    subjectName: string
  }) {
    // Conflict check: same teacher same time slot
    const teacherConflict = await this.db.schedule.findFirst({
      where: {
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        OR: [
          { startTime: { lte: data.startTime }, endTime: { gt: data.startTime } },
          { startTime: { lt: data.endTime }, endTime: { gte: data.endTime } },
          { startTime: { gte: data.startTime }, endTime: { lte: data.endTime } },
        ],
      },
    })
    if (teacherConflict) throw new Error(`Conflit horaire : l'enseignant est déjà occupé à ce créneau (${teacherConflict.subjectName})`)

    // Same class same slot
    const classConflict = await this.db.schedule.findFirst({
      where: {
        classId: data.classId,
        dayOfWeek: data.dayOfWeek,
        OR: [
          { startTime: { lte: data.startTime }, endTime: { gt: data.startTime } },
          { startTime: { lt: data.endTime }, endTime: { gte: data.endTime } },
          { startTime: { gte: data.startTime }, endTime: { lte: data.endTime } },
        ],
      },
    })
    if (classConflict) throw new Error(`Conflit horaire : la classe a déjà un cours à ce créneau (${classConflict.subjectName})`)

    return this.db.schedule.create({
      data,
      include: {
        teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
        room: true,
      },
    })
  }

  async delete(id: string) {
    return this.db.schedule.delete({ where: { id } })
  }

  async listRooms() {
    return this.db.room.findMany({ orderBy: { name: 'asc' } })
  }

  async createRoom(data: { name: string; capacity: number }) {
    return this.db.room.create({ data })
  }
}
