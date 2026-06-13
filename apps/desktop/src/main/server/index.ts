import type { PrismaClient } from '@prisma/client'

export async function startExpressServer(_db: PrismaClient): Promise<void> {
  // Express server started here in Task 13
  console.log('Express server placeholder — Task 13')
}

export function stopExpressServer(): void {
  // Stopped in Task 13
}
