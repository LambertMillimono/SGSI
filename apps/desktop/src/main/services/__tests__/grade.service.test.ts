import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { GradeService } from '../grade.service'
import { calcSubjectAverage, calcGeneralAverage, DEFAULT_EVAL_WEIGHTS } from '@sgsi/shared'

const DB_PATH = path.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db')

let prisma: PrismaClient
let gradeService: GradeService
let testEnrollmentId: string

beforeAll(async () => {
  prisma = new PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } })
  gradeService = new GradeService(prisma)

  // Use existing demo enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: { student: { matricule: 'DEMOAB-2025-0001' } },
  })
  if (!enrollment) throw new Error('Demo enrollment not found — run seed first')
  testEnrollmentId = enrollment.id
})

afterAll(async () => {
  // Clean up test grades
  await prisma.grade.deleteMany({ where: { enrollmentId: testEnrollmentId, period: 99 } })
  await prisma.$disconnect()
})

// ─── Unit tests for utility functions (pure, no DB) ─────────────────

describe('calcSubjectAverage (pure util)', () => {
  it('computes weighted average normalised to /20', () => {
    const grades = [
      { evalType: 'INTERROGATION' as const, value: 12, maxValue: 20, weight: 1 },
      { evalType: 'DEVOIR' as const, value: 14, maxValue: 20, weight: 1 },
      { evalType: 'EXAM' as const, value: 16, maxValue: 20, weight: 1 },
    ]
    // (12/20*20*1 + 14/20*20*2 + 16/20*20*3) / (1+2+3) = (12+28+48)/6 = 88/6 = 14.67
    const avg = calcSubjectAverage(grades as any, DEFAULT_EVAL_WEIGHTS)
    expect(avg).toBe(14.67)
  })

  it('returns 0 for empty grades', () => {
    expect(calcSubjectAverage([], DEFAULT_EVAL_WEIGHTS)).toBe(0)
  })

  it('normalises grades not on /20 scale', () => {
    const grades = [
      { evalType: 'INTERROGATION' as const, value: 8, maxValue: 10, weight: 1 },
    ]
    // 8/10*20 = 16/20
    const avg = calcSubjectAverage(grades as any, DEFAULT_EVAL_WEIGHTS)
    expect(avg).toBe(16)
  })
})

describe('calcGeneralAverage (pure util)', () => {
  it('computes coefficient-weighted general average', () => {
    const subjectAvgs = [
      { subjectId: '1', subjectName: 'Math', coefficient: 3, average: 14, grades: [] },
      { subjectId: '2', subjectName: 'Français', coefficient: 3, average: 12, grades: [] },
      { subjectId: '3', subjectName: 'SVT', coefficient: 2, average: 16, grades: [] },
    ]
    // (14*3 + 12*3 + 16*2) / (3+3+2) = 110/8 = 13.75
    expect(calcGeneralAverage(subjectAvgs)).toBe(13.75)
  })

  it('returns 0 for empty list', () => {
    expect(calcGeneralAverage([])).toBe(0)
  })
})

// ─── Integration tests (DB) ─────────────────────────────────────────

describe('GradeService.save', () => {
  it('saves a valid grade to the database', async () => {
    const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } })
    const grade = await gradeService.save(
      {
        enrollmentId: testEnrollmentId,
        subjectId: subject!.id,
        period: 99,
        evalType: 'DEVOIR',
        value: 15,
        maxValue: 20,
      },
      'actor'
    )
    expect(grade.id).toBeDefined()
    expect(grade.value).toBe(15)
    expect(grade.isLocked).toBe(false)
  })

  it('throws INVALID_GRADE for value above maxValue', async () => {
    const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } })
    await expect(
      gradeService.save(
        { enrollmentId: testEnrollmentId, subjectId: subject!.id, period: 99, evalType: 'DEVOIR', value: 25, maxValue: 20 },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'INVALID_GRADE' })
  })

  it('throws INVALID_GRADE for negative value', async () => {
    const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } })
    await expect(
      gradeService.save(
        { enrollmentId: testEnrollmentId, subjectId: subject!.id, period: 99, evalType: 'DEVOIR', value: -1, maxValue: 20 },
        'actor'
      )
    ).rejects.toMatchObject({ code: 'INVALID_GRADE' })
  })
})

describe('GradeService.listByEnrollment', () => {
  it('returns grades for a specific period', async () => {
    const grades = await gradeService.listByEnrollment(testEnrollmentId, 99)
    expect(grades.length).toBeGreaterThan(0)
    expect(grades[0].period).toBe(99)
  })
})

describe('GradeService.lockGrades', () => {
  it('locks all grades for a period', async () => {
    await gradeService.lockGrades(testEnrollmentId, 99, 'actor')
    const grades = await gradeService.listByEnrollment(testEnrollmentId, 99)
    expect(grades.every((g) => g.isLocked)).toBe(true)
  })
})
