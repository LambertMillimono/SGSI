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
  const adminUser = await prisma.user.upsert({
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

  // Niveaux
  const primaire = await prisma.level.upsert({
    where: { id: 'level-primaire' },
    update: {},
    create: { id: 'level-primaire', name: 'Primaire', order: 1 },
  })
  const college = await prisma.level.upsert({
    where: { id: 'level-college' },
    update: {},
    create: { id: 'level-college', name: 'Collège', order: 2 },
  })
  const lycee = await prisma.level.upsert({
    where: { id: 'level-lycee' },
    update: {},
    create: { id: 'level-lycee', name: 'Lycée', order: 3 },
  })

  // Classes
  const ce2 = await prisma.class.upsert({
    where: { id: 'class-ce2' },
    update: {},
    create: {
      id: 'class-ce2',
      name: 'CE2',
      levelId: primaire.id,
      academicYearId: year.id,
      maxStudents: 35,
    },
  })
  const classe6e = await prisma.class.upsert({
    where: { id: 'class-6e' },
    update: {},
    create: {
      id: 'class-6e',
      name: '6ème A',
      levelId: college.id,
      academicYearId: year.id,
      maxStudents: 40,
    },
  })

  // Matières
  const math = await prisma.subject.upsert({
    where: { code: 'MATH' },
    update: {},
    create: { code: 'MATH', name: 'Mathématiques' },
  })
  const francais = await prisma.subject.upsert({
    where: { code: 'FR' },
    update: {},
    create: { code: 'FR', name: 'Français' },
  })
  const svt = await prisma.subject.upsert({
    where: { code: 'SVT' },
    update: {},
    create: { code: 'SVT', name: 'SVT' },
  })

  // Association matières ↔ classe 6ème A
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-math' },
    update: {},
    create: { id: 'cs-6e-math', classId: classe6e.id, subjectId: math.id, coefficient: 3 },
  })
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-fr' },
    update: {},
    create: { id: 'cs-6e-fr', classId: classe6e.id, subjectId: francais.id, coefficient: 3 },
  })
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-svt' },
    update: {},
    create: { id: 'cs-6e-svt', classId: classe6e.id, subjectId: svt.id, coefficient: 2 },
  })

  // 3 élèves démo
  const students = [
    { id: 'stu-001', firstName: 'Amadou', lastName: 'Bah', gender: 'MALE', matricule: 'DEMOAB-2025-0001' },
    { id: 'stu-002', firstName: 'Fatoumata', lastName: 'Diallo', gender: 'FEMALE', matricule: 'DEMOFD-2025-0002' },
    { id: 'stu-003', firstName: 'Ibrahima', lastName: 'Camara', gender: 'MALE', matricule: 'DEMOIC-2025-0003' },
  ]

  for (const s of students) {
    await prisma.student.upsert({
      where: { matricule: s.matricule },
      update: {},
      create: {
        ...s,
        birthDate: new Date('2010-01-01'),
        nationality: 'Guinéenne',
      },
    })
    await prisma.enrollment.upsert({
      where: { id: `enroll-${s.id}` },
      update: {},
      create: {
        id: `enroll-${s.id}`,
        studentId: s.id,
        classId: classe6e.id,
        academicYearId: year.id,
      },
    })
  }

  // Frais scolaires (par niveau collège)
  await prisma.feeType.upsert({
    where: { id: 'fee-inscription' },
    update: {},
    create: {
      id: 'fee-inscription',
      name: "Frais d'inscription",
      amount: 500000,
      levelId: college.id,
      isRequired: true,
    },
  })
  await prisma.feeType.upsert({
    where: { id: 'fee-scolarite' },
    update: {},
    create: {
      id: 'fee-scolarite',
      name: 'Scolarité trimestrielle',
      amount: 1500000,
      levelId: college.id,
      isRequired: true,
    },
  })

  console.log('✅ Seed terminé avec succès')
  console.log('👤 Connexion admin: username=admin / password=Admin@1234')
  console.log(`📚 École: ${school.name}`)
  console.log(`📅 Année: ${year.label}`)
  console.log(`👥 Élèves créés: ${students.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
