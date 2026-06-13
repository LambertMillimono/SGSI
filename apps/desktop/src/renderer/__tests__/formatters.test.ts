import { describe, it, expect } from 'vitest'
import { formatGNF, formatDate, formatMatricule } from '../utils/formatters'

describe('formatters', () => {
  it('formats GNF amounts correctly', () => {
    expect(formatGNF(500000)).toContain('500')
    expect(formatGNF(500000)).toContain('GNF')
  })

  it('formats matricule correctly', () => {
    expect(formatMatricule('L', 'Diallo', 'Mamadou', 2024, 1)).toBe('LDM-2024-0001')
    expect(formatMatricule('DEMO', 'Barry', 'Fatoumata', 2025, 42)).toBe('DEMOBF-2025-0042')
  })
})
