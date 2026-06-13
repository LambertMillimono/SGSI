import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { StudentService } from '../student.service'
import { ClassService } from '../class.service'
import path from 'path'

const DB_PATH = path.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')

let prisma: PrismaClient
let studentService: StudentService
let classService: ClassService
const ACTOR_ID = 'school-demo' // Use existing school as actor placeholder

beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: `file:${DB_PATH}` } },
  })
  studentService = new StudentService(prisma)
  classService = new ClassService(prisma)
})

afterAll(async () => {
  // Clean up test students (keep demo students)
  await prisma.auditLog.deleteMany({ where: { entity: 'student', details: { contains: 'test-' } } })
  await prisma.student.deleteMany({ where: { matricule: { startsWith: 'TST' } } })
  await prisma.level.deleteMany({ where: { name: { startsWith: 'TestLevel-' } } })
  await prisma.$disconnect()
})

describe('StudentService', () => {
  it('creates a student with auto-generated unique matricule', async () => {
    const student = await studentService.create(
      {
        firstName: 'Ibrahima',
        lastName: 'Barry',
        gender: 'MALE',
        birthDate: new Date('2010-05-15'),
      },
      'admin-actor'
    )

    expect(student.matricule).toMatch(/^DEMO/)
    expect(student.firstName).toBe('Ibrahima')
    expect(student.lastName).toBe('Barry')
    expect(student.id).toBeDefined()
  })

  it('lists students', async () => {
    const list = await studentService.list()
    expect(list.length).toBeGreaterThan(0)
  })

  it('finds student by id', async () => {
    const all = await studentService.list()
    const found = await studentService.findById(all[0].id)
    expect(found.id).toBe(all[0].id)
  })

  it('throws STUDENT_NOT_FOUND for unknown id', async () => {
    await expect(studentService.findById('nonexistent-id-xyz')).rejects.toMatchObject({
      code: 'STUDENT_NOT_FOUND',
    })
  })

  it('updates student data', async () => {
    const students = await studentService.list()
    const target = students.find((s) => s.firstName === 'Ibrahima')!
    const updated = await studentService.update(
      target.id,
      { address: '123 Rue Test, Conakry' },
      'admin-actor'
    )
    expect(updated.address).toBe('123 Rue Test, Conakry')
  })

  it('searches students by name', async () => {
    const results = await studentService.list({ search: 'Ibrahima' })
    expect(results.some((s) => s.firstName === 'Ibrahima')).toBe(true)
  })
})

describe('ClassService', () => {
  it('lists existing levels', async () => {
    const levels = await classService.listLevels()
    expect(levels.length).toBeGreaterThan(0)
    expect(levels[0].name).toBeDefined()
  })

  it('creates a new level', async () => {
    const level = await classService.createLevel(
      { name: 'TestLevel-Terminale', order: 10 },
      'admin-actor'
    )
    expect(level.name).toBe('TestLevel-Terminale')
    expect(level.id).toBeDefined()
  })

  it('lists classes for the current year', async () => {
    const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } })
    const classes = await classService.listClasses(year!.id)
    expect(classes.length).toBeGreaterThan(0)
  })

  it('finds a class by id with subjects', async () => {
    const classes = await classService.listClasses()
    const found = await classService.findClassById(classes[0].id)
    expect(found.id).toBe(classes[0].id)
    expect(found.subjects).toBeDefined()
  })

  it('throws CLASS_NOT_FOUND for unknown id', async () => {
    await expect(classService.findClassById('nonexistent-class')).rejects.toMatchObject({
      code: 'CLASS_NOT_FOUND',
    })
  })
})
