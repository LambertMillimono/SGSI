"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const grade_service_1 = require("../grade.service");
const shared_1 = require("@sgsi/shared");
const DB_PATH = path_1.default.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db');
let prisma;
let gradeService;
let testEnrollmentId;
(0, vitest_1.beforeAll)(async () => {
    prisma = new client_1.PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } });
    gradeService = new grade_service_1.GradeService(prisma);
    // Use existing demo enrollment
    const enrollment = await prisma.enrollment.findFirst({
        where: { student: { matricule: 'DEMOAB-2025-0001' } },
    });
    if (!enrollment)
        throw new Error('Demo enrollment not found — run seed first');
    testEnrollmentId = enrollment.id;
});
(0, vitest_1.afterAll)(async () => {
    // Clean up test grades
    await prisma.grade.deleteMany({ where: { enrollmentId: testEnrollmentId, period: 99 } });
    await prisma.$disconnect();
});
// ─── Unit tests for utility functions (pure, no DB) ─────────────────
(0, vitest_1.describe)('calcSubjectAverage (pure util)', () => {
    (0, vitest_1.it)('computes weighted average normalised to /20', () => {
        const grades = [
            { evalType: 'INTERROGATION', value: 12, maxValue: 20, weight: 1 },
            { evalType: 'DEVOIR', value: 14, maxValue: 20, weight: 1 },
            { evalType: 'EXAM', value: 16, maxValue: 20, weight: 1 },
        ];
        // (12/20*20*1 + 14/20*20*2 + 16/20*20*3) / (1+2+3) = (12+28+48)/6 = 88/6 = 14.67
        const avg = (0, shared_1.calcSubjectAverage)(grades, shared_1.DEFAULT_EVAL_WEIGHTS);
        (0, vitest_1.expect)(avg).toBe(14.67);
    });
    (0, vitest_1.it)('returns 0 for empty grades', () => {
        (0, vitest_1.expect)((0, shared_1.calcSubjectAverage)([], shared_1.DEFAULT_EVAL_WEIGHTS)).toBe(0);
    });
    (0, vitest_1.it)('normalises grades not on /20 scale', () => {
        const grades = [
            { evalType: 'INTERROGATION', value: 8, maxValue: 10, weight: 1 },
        ];
        // 8/10*20 = 16/20
        const avg = (0, shared_1.calcSubjectAverage)(grades, shared_1.DEFAULT_EVAL_WEIGHTS);
        (0, vitest_1.expect)(avg).toBe(16);
    });
});
(0, vitest_1.describe)('calcGeneralAverage (pure util)', () => {
    (0, vitest_1.it)('computes coefficient-weighted general average', () => {
        const subjectAvgs = [
            { subjectId: '1', subjectName: 'Math', coefficient: 3, average: 14, grades: [] },
            { subjectId: '2', subjectName: 'Français', coefficient: 3, average: 12, grades: [] },
            { subjectId: '3', subjectName: 'SVT', coefficient: 2, average: 16, grades: [] },
        ];
        // (14*3 + 12*3 + 16*2) / (3+3+2) = 110/8 = 13.75
        (0, vitest_1.expect)((0, shared_1.calcGeneralAverage)(subjectAvgs)).toBe(13.75);
    });
    (0, vitest_1.it)('returns 0 for empty list', () => {
        (0, vitest_1.expect)((0, shared_1.calcGeneralAverage)([])).toBe(0);
    });
});
// ─── Integration tests (DB) ─────────────────────────────────────────
(0, vitest_1.describe)('GradeService.save', () => {
    (0, vitest_1.it)('saves a valid grade to the database', async () => {
        const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } });
        const grade = await gradeService.save({
            enrollmentId: testEnrollmentId,
            subjectId: subject.id,
            period: 99,
            evalType: 'DEVOIR',
            value: 15,
            maxValue: 20,
        }, 'actor');
        (0, vitest_1.expect)(grade.id).toBeDefined();
        (0, vitest_1.expect)(grade.value).toBe(15);
        (0, vitest_1.expect)(grade.isLocked).toBe(false);
    });
    (0, vitest_1.it)('throws INVALID_GRADE for value above maxValue', async () => {
        const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } });
        await (0, vitest_1.expect)(gradeService.save({ enrollmentId: testEnrollmentId, subjectId: subject.id, period: 99, evalType: 'DEVOIR', value: 25, maxValue: 20 }, 'actor')).rejects.toMatchObject({ code: 'INVALID_GRADE' });
    });
    (0, vitest_1.it)('throws INVALID_GRADE for negative value', async () => {
        const subject = await prisma.subject.findFirst({ where: { code: 'MATH' } });
        await (0, vitest_1.expect)(gradeService.save({ enrollmentId: testEnrollmentId, subjectId: subject.id, period: 99, evalType: 'DEVOIR', value: -1, maxValue: 20 }, 'actor')).rejects.toMatchObject({ code: 'INVALID_GRADE' });
    });
});
(0, vitest_1.describe)('GradeService.listByEnrollment', () => {
    (0, vitest_1.it)('returns grades for a specific period', async () => {
        const grades = await gradeService.listByEnrollment(testEnrollmentId, 99);
        (0, vitest_1.expect)(grades.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(grades[0].period).toBe(99);
    });
});
(0, vitest_1.describe)('GradeService.lockGrades', () => {
    (0, vitest_1.it)('locks all grades for a period', async () => {
        await gradeService.lockGrades(testEnrollmentId, 99, 'actor');
        const grades = await gradeService.listByEnrollment(testEnrollmentId, 99);
        (0, vitest_1.expect)(grades.every((g) => g.isLocked)).toBe(true);
    });
});
//# sourceMappingURL=grade.service.test.js.map