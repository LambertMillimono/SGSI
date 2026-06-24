/**
 * Générateur de clés de licence SGSI SchoolManager Pro
 * Usage: node generate-license.js
 *
 * Format: SGSI-{PLAN}-{CODE6}-{ANNÉE}
 * Exemple: SGSI-PRO-AB1234-2027
 */

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function generateLicense({ plan = 'STD', year = new Date().getFullYear() + 1 } = {}) {
  const PLANS = {
    STD: { name: 'Standard',     maxStudents: 500  },
    PRO: { name: 'Professional', maxStudents: 2000 },
    ULT: { name: 'Ultimate',     maxStudents: 9999 },
  }

  const planInfo = PLANS[plan.toUpperCase()] || PLANS.STD
  const code     = generateCode(6)
  const key      = `SGSI-${plan.toUpperCase()}-${code}-${year}`

  return {
    key,
    plan: planInfo.name,
    maxStudents: planInfo.maxStudents,
    expiresAt: `31/12/${year}`,
  }
}

// ── Générer des exemples ─────────────────────────────────────────────
console.log('\n══ SGSI License Generator ══\n')

const examples = [
  { plan: 'STD', year: 2027, label: 'Standard (500 élèves, 1 an)' },
  { plan: 'PRO', year: 2027, label: 'Professional (2000 élèves, 1 an)' },
  { plan: 'ULT', year: 2099, label: 'Ultimate (illimité, permanent)' },
]

examples.forEach(({ plan, year, label }) => {
  const lic = generateLicense({ plan, year })
  console.log(`[${label}]`)
  console.log(`  Clé       : ${lic.key}`)
  console.log(`  Plan      : ${lic.plan}`)
  console.log(`  Max élèves: ${lic.maxStudents}`)
  console.log(`  Expire le : ${lic.expiresAt}`)
  console.log()
})

// ── Utilisation personnalisée ────────────────────────────────────────
// Modifiez les paramètres ci-dessous pour votre client:
const maLicence = generateLicense({
  plan: 'PRO',  // STD | PRO | ULT
  year: 2027,   // Année d'expiration
})
console.log('══ VOTRE CLÉ PERSONNALISÉE ══')
console.log(`Clé : ${maLicence.key}`)
console.log(`Plan: ${maLicence.plan} — Max ${maLicence.maxStudents} élèves`)
console.log(`Expire: ${maLicence.expiresAt}`)
