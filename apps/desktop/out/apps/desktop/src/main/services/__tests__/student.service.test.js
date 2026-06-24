"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("@prisma/client");
const student_service_1 = require("../student.service");
const class_service_1 = require("../class.service");
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.resolve(process.cwd(), '../../packages/db/prisma/sgsi.db');
let prisma;
let studentService;
let classService;
const ACTOR_ID = 'school-demo'; // Use existing school as actor placeholder
(0, vitest_1.beforeAll)(async () => {
    prisma = new client_1.PrismaClient({
        datasources: { db: { url: `file:${DB_PATH}` } },
    });
    studentService = new student_service_1.StudentService(prisma);
    classService = new class_service_1.ClassService(prisma);
});
(0, vitest_1.afterAll)(async () => {
    // Clean up test students (keep demo students)
    await prisma.auditLog.deleteMany({ where: { entity: 'student', details: { contains: 'test-' } } });
    await prisma.student.deleteMany({ where: { matricule: { startsWith: 'TST' } } });
    await prisma.level.deleteMany({ where: { name: { startsWith: 'TestLevel-' } } });
    await prisma.$disconnect();
});
(0, vitest_1.describe)('StudentService', () => {
    (0, vitest_1.it)('creates a student with auto-generated unique matricule', async () => {
        const student = await studentService.create({
            firstName: 'Ibrahima',
            lastName: 'Barry',
            gender: 'MALE',
            birthDate: new Date('2010-05-15'),
        }, 'admin-actor');
        (0, vitest_1.expect)(student.matricule).toMatch(/^DEMO/);
        (0, vitest_1.expect)(student.firstName).toBe('Ibrahima');
        (0, vitest_1.expect)(student.lastName).toBe('Barry');
        (0, vitest_1.expect)(student.id).toBeDefined();
    });
    (0, vitest_1.it)('lists students', async () => {
        const list = await studentService.list();
        (0, vitest_1.expect)(list.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('finds student by id', async () => {
        const all = await studentService.list();
        const found = await studentService.findById(all[0].id);
        (0, vitest_1.expect)(found.id).toBe(all[0].id);
    });
    (0, vitest_1.it)('throws STUDENT_NOT_FOUND for unknown id', async () => {
        await (0, vitest_1.expect)(studentService.findById('nonexistent-id-xyz')).rejects.toMatchObject({
            code: 'STUDENT_NOT_FOUND',
        });
    });
    (0, vitest_1.it)('updates student data', async () => {
        const students = await studentService.list();
        const target = students.find((s) => s.firstName === 'Ibrahima');
        const updated = await studentService.update(target.id, { address: '123 Rue Test, Conakry' }, 'admin-actor');
        (0, vitest_1.expect)(updated.address).toBe('123 Rue Test, Conakry');
    });
    (0, vitest_1.it)('searches students by name', async () => {
        const results = await studentService.list({ search: 'Ibrahima' });
        (0, vitest_1.expect)(results.some((s) => s.firstName === 'Ibrahima')).toBe(true);
    });
});
(0, vitest_1.describe)('ClassService', () => {
    (0, vitest_1.it)('lists existing levels', async () => {
        const levels = await classService.listLevels();
        (0, vitest_1.expect)(levels.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(levels[0].name).toBeDefined();
    });
    (0, vitest_1.it)('creates a new level', async () => {
        const level = await classService.createLevel({ name: 'TestLevel-Terminale', order: 10 }, 'admin-actor');
        (0, vitest_1.expect)(level.name).toBe('TestLevel-Terminale');
        (0, vitest_1.expect)(level.id).toBeDefined();
    });
    (0, vitest_1.it)('lists classes for the current year', async () => {
        const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
        const classes = await classService.listClasses(year.id);
        (0, vitest_1.expect)(classes.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('finds a class by id with subjects', async () => {
        const classes = await classService.listClasses();
        const found = await classService.findClassById(classes[0].id);
        (0, vitest_1.expect)(found.id).toBe(classes[0].id);
        (0, vitest_1.expect)(found.subjects).toBeDefined();
    });
    (0, vitest_1.it)('throws CLASS_NOT_FOUND for unknown id', async () => {
        await (0, vitest_1.expect)(classService.findClassById('nonexistent-class')).rejects.toMatchObject({
            code: 'CLASS_NOT_FOUND',
        });
    });
});
//# sourceMappingURL=student.service.test.js.map