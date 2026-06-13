export function formatGNF(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(amount) + ' GNF'
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('fr-FR').format(new Date(date))
}

export function formatMatricule(
  schoolCode: string, lastName: string, firstName: string,
  year: number, seq: number
): string {
  const l = lastName[0]?.toUpperCase() ?? 'X'
  const f = firstName[0]?.toUpperCase() ?? 'X'
  const n = String(seq).padStart(4, '0')
  return `${schoolCode.toUpperCase()}${l}${f}-${year}-${n}`
}

export function numberToWordsFR(amount: number): string {
  // Simple implementation for GNF amounts
  const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
  const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

  if (amount === 0) return 'zéro'
  if (amount < 0) return 'moins ' + numberToWordsFR(-amount)

  let result = ''

  if (amount >= 1000000) {
    const m = Math.floor(amount / 1000000)
    result += (m === 1 ? 'un million' : numberToWordsFR(m) + ' millions') + ' '
    amount %= 1000000
  }
  if (amount >= 1000) {
    const k = Math.floor(amount / 1000)
    result += (k === 1 ? 'mille' : numberToWordsFR(k) + ' mille') + ' '
    amount %= 1000
  }
  if (amount >= 100) {
    const h = Math.floor(amount / 100)
    result += (h === 1 ? 'cent' : units[h] + ' cents') + ' '
    amount %= 100
  }
  if (amount >= 20) {
    const t = Math.floor(amount / 10)
    const u = amount % 10
    if (t === 7 || t === 9) {
      result += tens[t] + '-' + units[10 + u] + ' '
    } else if (t === 8 && u === 0) {
      result += 'quatre-vingts '
    } else if (u === 1 && t !== 8) {
      result += tens[t] + '-et-un '
    } else if (u > 0) {
      result += tens[t] + '-' + units[u] + ' '
    } else {
      result += tens[t] + ' '
    }
  } else if (amount > 0) {
    result += units[amount] + ' '
  }

  return result.trim() + ' francs guinéens'
}
