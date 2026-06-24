import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding SGSI demo data...')

  // École
  const school = await prisma.school.upsert({
    where: { id: 'school-demo' },
    update: {},
    create: {
      id: 'school-demo',
      name: 'École Démo SGSI',
      sigle: 'DEMO',
      currency: 'GNF',
      language: 'fr',
      jwtSecret: 'demo-secret-change-in-production',
      eliminatoryThreshold: 5.0,
      passingAverage: 10.0,
      periodType: 'TRIMESTER',
    },
  })

  // Année scolaire
  const year = await prisma.academicYear.upsert({
    where: { id: 'year-2025-2026' },
    update: {},
    create: {
      id: 'year-2025-2026',
      label: '2025-2026',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: true,
      periodType: 'TRIMESTER',
    },
  })

  // Licence démo
  await prisma.license.upsert({
    where: { key: 'DEMO-SGSI-0000-0000' },
    update: {},
    create: {
      key: 'DEMO-SGSI-0000-0000',
      schoolName: 'École Démo SGSI',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      plan: 'DEMO',
      maxStudents: 50,
    },
  })

  // Super Admin
  const hashedPassword = await bcrypt.hash('Admin@1234', 12)
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Administrateur',
      mustChangePassword: true,
    },
  })

  // ─── Cycles ───────────────────────────────────────────────────────────────────
  const cycleMaternelle = await prisma.cycle.upsert({
    where: { id: 'cycle-maternelle' },
    update: {},
    create: { id: 'cycle-maternelle', name: 'Maternelle', order: 1 },
  })
  const cyclePrimaire = await prisma.cycle.upsert({
    where: { id: 'cycle-primaire' },
    update: {},
    create: { id: 'cycle-primaire', name: 'Primaire', order: 2 },
  })
  const cycleCollege = await prisma.cycle.upsert({
    where: { id: 'cycle-college' },
    update: {},
    create: { id: 'cycle-college', name: 'Collège', order: 3 },
  })
  const cycleLycee = await prisma.cycle.upsert({
    where: { id: 'cycle-lycee' },
    update: {},
    create: { id: 'cycle-lycee', name: 'Lycée', order: 4 },
  })

  // ─── Niveaux ──────────────────────────────────────────────────────────────────
  // Maternelle
  await prisma.level.upsert({ where: { id: 'niveau-ps' }, update: {}, create: { id: 'niveau-ps', name: 'Petite Section', order: 1, cycleId: cycleMaternelle.id } })
  await prisma.level.upsert({ where: { id: 'niveau-ms' }, update: {}, create: { id: 'niveau-ms', name: 'Moyenne Section', order: 2, cycleId: cycleMaternelle.id } })
  await prisma.level.upsert({ where: { id: 'niveau-gs' }, update: {}, create: { id: 'niveau-gs', name: 'Grande Section', order: 3, cycleId: cycleMaternelle.id } })
  // Primaire
  await prisma.level.upsert({ where: { id: 'niveau-ci' }, update: {}, create: { id: 'niveau-ci', name: 'CI', order: 1, cycleId: cyclePrimaire.id } })
  await prisma.level.upsert({ where: { id: 'niveau-cp' }, update: {}, create: { id: 'niveau-cp', name: 'CP', order: 2, cycleId: cyclePrimaire.id } })
  await prisma.level.upsert({ where: { id: 'niveau-ce1' }, update: {}, create: { id: 'niveau-ce1', name: 'CE1', order: 3, cycleId: cyclePrimaire.id } })
  const niveauCe2 = await prisma.level.upsert({ where: { id: 'niveau-ce2' }, update: {}, create: { id: 'niveau-ce2', name: 'CE2', order: 4, cycleId: cyclePrimaire.id } })
  await prisma.level.upsert({ where: { id: 'niveau-cm1' }, update: {}, create: { id: 'niveau-cm1', name: 'CM1', order: 5, cycleId: cyclePrimaire.id } })
  await prisma.level.upsert({ where: { id: 'niveau-cm2' }, update: {}, create: { id: 'niveau-cm2', name: 'CM2', order: 6, cycleId: cyclePrimaire.id } })
  // Collège
  const niveau6e = await prisma.level.upsert({ where: { id: 'niveau-6e' }, update: {}, create: { id: 'niveau-6e', name: '6ème', order: 1, cycleId: cycleCollege.id } })
  await prisma.level.upsert({ where: { id: 'niveau-5e' }, update: {}, create: { id: 'niveau-5e', name: '5ème', order: 2, cycleId: cycleCollege.id } })
  await prisma.level.upsert({ where: { id: 'niveau-4e' }, update: {}, create: { id: 'niveau-4e', name: '4ème', order: 3, cycleId: cycleCollege.id } })
  await prisma.level.upsert({ where: { id: 'niveau-3e' }, update: {}, create: { id: 'niveau-3e', name: '3ème', order: 4, cycleId: cycleCollege.id } })
  // Lycée
  await prisma.level.upsert({ where: { id: 'niveau-2nde' }, update: {}, create: { id: 'niveau-2nde', name: 'Seconde', order: 1, cycleId: cycleLycee.id } })
  await prisma.level.upsert({ where: { id: 'niveau-1ere' }, update: {}, create: { id: 'niveau-1ere', name: 'Première', order: 2, cycleId: cycleLycee.id } })
  await prisma.level.upsert({ where: { id: 'niveau-tale' }, update: {}, create: { id: 'niveau-tale', name: 'Terminale', order: 3, cycleId: cycleLycee.id } })

  // ─── Classes ──────────────────────────────────────────────────────────────────
  const ce2 = await prisma.class.upsert({
    where: { id: 'class-ce2' },
    update: {},
    create: { id: 'class-ce2', name: 'CE2 A', levelId: niveauCe2.id, academicYearId: year.id, maxStudents: 35 },
  })
  const classe6e = await prisma.class.upsert({
    where: { id: 'class-6e' },
    update: {},
    create: { id: 'class-6e', name: '6ème A', levelId: niveau6e.id, academicYearId: year.id, maxStudents: 40 },
  })

  // ─── Matières ─────────────────────────────────────────────────────────────────
  const math = await prisma.subject.upsert({ where: { code: 'MATH' }, update: {}, create: { code: 'MATH', name: 'Mathématiques' } })
  const francais = await prisma.subject.upsert({ where: { code: 'FR' }, update: {}, create: { code: 'FR', name: 'Français' } })
  const svt = await prisma.subject.upsert({ where: { code: 'SVT' }, update: {}, create: { code: 'SVT', name: 'SVT' } })

  await prisma.classSubject.upsert({ where: { id: 'cs-6e-math' }, update: {}, create: { id: 'cs-6e-math', classId: classe6e.id, subjectId: math.id, coefficient: 3 } })
  await prisma.classSubject.upsert({ where: { id: 'cs-6e-fr' }, update: {}, create: { id: 'cs-6e-fr', classId: classe6e.id, subjectId: francais.id, coefficient: 3 } })
  await prisma.classSubject.upsert({ where: { id: 'cs-6e-svt' }, update: {}, create: { id: 'cs-6e-svt', classId: classe6e.id, subjectId: svt.id, coefficient: 2 } })

  // ─── Élèves démo ──────────────────────────────────────────────────────────────
  const students = [
    { id: 'stu-001', firstName: 'Amadou',     lastName: 'Bah',    gender: 'MALE',   matricule: 'DEMOAB-2025-0001' },
    { id: 'stu-002', firstName: 'Fatoumata',  lastName: 'Diallo', gender: 'FEMALE', matricule: 'DEMOFD-2025-0002' },
    { id: 'stu-003', firstName: 'Ibrahima',   lastName: 'Camara', gender: 'MALE',   matricule: 'DEMOIC-2025-0003' },
  ]

  for (const s of students) {
    await prisma.student.upsert({
      where: { matricule: s.matricule },
      update: {},
      create: { ...s, birthDate: new Date('2010-01-01'), nationality: 'Guinéenne' },
    })
    await prisma.enrollment.upsert({
      where: { id: `enroll-${s.id}` },
      update: {},
      create: { id: `enroll-${s.id}`, studentId: s.id, classId: classe6e.id, academicYearId: year.id },
    })
  }

  // ─── Frais scolaires ──────────────────────────────────────────────────────────
  await prisma.feeType.upsert({
    where: { id: 'fee-inscription' },
    update: {},
    create: { id: 'fee-inscription', name: "Frais d'inscription", amount: 500000, levelId: niveau6e.id, isRequired: true },
  })
  await prisma.feeType.upsert({
    where: { id: 'fee-scolarite' },
    update: {},
    create: { id: 'fee-scolarite', name: 'Scolarité trimestrielle', amount: 1500000, levelId: niveau6e.id, isRequired: true },
  })

  console.log('✅ Seed terminé avec succès')
  console.log('👤 Connexion admin: username=admin / password=Admin@1234')
  console.log(`📚 École: ${school.name}`)
  console.log(`📅 Année: ${year.label}`)
  console.log(`🔄 Cycles: Maternelle, Primaire, Collège, Lycée`)
  console.log(`📊 Niveaux: 16 niveaux standards créés`)
  console.log(`👥 Élèves créés: ${students.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
