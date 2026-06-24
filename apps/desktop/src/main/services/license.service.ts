import type { PrismaClient } from '@prisma/client'

export class LicenseService {
  constructor(private db: PrismaClient) {}

  async getLicense() {
    return this.db.license.findFirst({ orderBy: { issuedAt: 'desc' } })
  }

  async activate(key: string) {
    // Validate key format: SGSI-XXXX-XXXX-XXXX
    if (!key || key.length < 10) throw new Error('Clé de licence invalide')

    // Check if a license with this key already exists
    const existing = await this.db.license.findUnique({ where: { key } })
    if (existing) {
      // Re-activate it
      return this.db.license.update({ where: { key }, data: { isActive: true } })
    }

    // Decode plan and expiry from key (simple convention: last segment encodes plan)
    // Format: SGSI-PLAN-XXXXXX-EXPYYYY (PLAN: STD/PRO/ULT, EXP: year)
    const parts = key.toUpperCase().split('-')
    let plan = 'STANDARD'
    let maxStudents = 500
    let expiresAt: Date | undefined = undefined

    if (parts.length >= 2) {
      const planCode = parts[1]
      if (planCode === 'PRO') { plan = 'PROFESSIONAL'; maxStudents = 2000 }
      else if (planCode === 'ULT') { plan = 'ULTIMATE'; maxStudents = 9999 }
    }
    // Expiry: look for a segment that is a 4-digit year
    for (const p of parts) {
      const yr = parseInt(p, 10)
      if (yr >= 2024 && yr <= 2099) {
        expiresAt = new Date(yr, 11, 31, 23, 59, 59) // Dec 31 of that year
        break
      }
    }

    // Get school name from settings
    const school = await (this.db as any).schoolSettings.findFirst()
    const schoolName = school?.name ?? 'École'

    return this.db.license.create({
      data: {
        key,
        schoolName,
        plan,
        maxStudents,
        isActive: true,
        expiresAt: expiresAt ?? null,
      },
    })
  }

  async deactivate() {
    const lic = await this.getLicense()
    if (!lic) throw new Error('Aucune licence trouvée')
    return this.db.license.update({ where: { id: lic.id }, data: { isActive: false } })
  }

  async isValid(): Promise<boolean> {
    const lic = await this.getLicense()
    if (!lic || !lic.isActive) return false
    if (lic.expiresAt && new Date() > lic.expiresAt) return false
    return true
  }
}
