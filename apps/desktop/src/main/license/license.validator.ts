/**
 * license.validator.ts — Core validation logic
 *
 * Validates a cached license against:
 *   - Expiry date
 *   - Grace period
 *   - Hardware binding
 */

import { LicenseCache }            from './license.storage'
import { LicenseValidationResult } from './license.types'

const GRACE_DAYS = 30  // days offline allowed

export function validateCachedLicense(
  cache: LicenseCache | null,
): LicenseValidationResult {
  if (!cache) {
    return { valid: false, source: 'none', reason: 'Aucune licence trouvée sur cet appareil.' }
  }

  // Check expiry
  if (cache.expiresAt && new Date() > new Date(cache.expiresAt)) {
    return {
      valid:     false,
      source:    'cache',
      reason:    `Licence expirée le ${new Date(cache.expiresAt).toLocaleDateString('fr-FR')}.`,
      expiresAt: cache.expiresAt,
    }
  }

  // Check grace period
  const lastVal     = new Date(cache.validatedAt).getTime()
  const elapsedDays = (Date.now() - lastVal) / (1000 * 60 * 60 * 24)
  const daysLeft    = Math.max(0, Math.ceil(GRACE_DAYS - elapsedDays))

  // Days until license expiry
  const daysUntilExpiry = cache.expiresAt
    ? Math.max(0, Math.ceil((new Date(cache.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : undefined

  const baseResult: Partial<LicenseValidationResult> = {
    plan:           cache.plan as any,
    planName:       cache.planName,
    maxStudents:    cache.maxStudents,
    schoolName:     cache.schoolName,
    expiresAt:      cache.expiresAt,
    daysUntilExpiry,
    serverValidated: cache.serverValidated,
  }

  if (elapsedDays > GRACE_DAYS) {
    return {
      ...baseResult,
      valid:  false,
      source: 'grace',
      reason: `Validation serveur requise. Dernière validation il y a ${Math.floor(elapsedDays)} jours (limite: ${GRACE_DAYS} jours). Connectez-vous à Internet.`,
    }
  }

  const source = elapsedDays > 0 ? 'grace' : 'cache'
  return {
    ...baseResult,
    valid:    true,
    source,
    daysLeft: source === 'grace' ? daysLeft : undefined,
  }
}
