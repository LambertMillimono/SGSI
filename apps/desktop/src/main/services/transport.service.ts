import { PrismaClient } from '@prisma/client'

export class TransportService {
  constructor(private db: PrismaClient) {}

  async listBuses() {
    return this.db.bus.findMany({
      include: { routes: true },
      orderBy: { plate: 'asc' },
    })
  }

  async createBus(data: { plate: string; capacity: number; driver: string; driverPhone?: string }) {
    return this.db.bus.create({
      data,
      include: { routes: true },
    })
  }

  async updateBus(id: string, data: { plate?: string; capacity?: number; driver?: string; driverPhone?: string }) {
    return this.db.bus.update({
      where: { id },
      data,
      include: { routes: true },
    })
  }

  async deleteBus(id: string) {
    const routeCount = await this.db.route.count({ where: { busId: id } })
    if (routeCount > 0) throw new Error("Supprimez d'abord les circuits de ce bus")
    return this.db.bus.delete({ where: { id } })
  }

  async createRoute(data: { busId: string; name: string; stops: string }) {
    return this.db.route.create({ data })
  }

  async updateRoute(id: string, data: { name?: string; stops?: string }) {
    return this.db.route.update({ where: { id }, data })
  }

  async deleteRoute(id: string) {
    return this.db.route.delete({ where: { id } })
  }

  async stats() {
    const [busCount, routeCount] = await Promise.all([
      this.db.bus.count(),
      this.db.route.count(),
    ])
    const buses = await this.db.bus.findMany({ select: { capacity: true } })
    const totalCapacity = buses.reduce((s, b) => s + b.capacity, 0)
    return { busCount, routeCount, totalCapacity }
  }
}
