"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StudentService = void 0;
const shared_1 = require("@sgsi/shared");
const shared_2 = require("@sgsi/shared");
class StudentService {
    db;
    constructor(db) {
        this.db = db;
    }
    /** Best-effort audit log — does not throw if userId is not a valid FK */
    async audit(userId, action, entity, entityId) {
        try {
            await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
        }
        catch {
            // Audit failures are non-fatal
        }
    }
    async list(filters) {
        return this.db.student.findMany({
            where: {
                ...(filters?.search && {
                    OR: [
                        { firstName: { contains: filters.search } },
                        { lastName: { contains: filters.search } },
                        { matricule: { contains: filters.search } },
                    ],
                }),
                ...(filters?.classId && {
                    enrollments: { some: { classId: filters.classId } },
                }),
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        });
    }
    async findById(id) {
        const student = await this.db.student.findUnique({
            where: { id },
            include: {
                enrollments: {
                    include: { class: true, academicYear: true },
                    orderBy: { enrolledAt: 'desc' },
                },
                parents: { include: { parent: true } },
                documents: true,
            },
        });
        if (!student) {
            throw new shared_1.ServiceError('STUDENT_NOT_FOUND', `Élève introuvable`);
        }
        return student;
    }
    async create(data, actorId) {
        const school = await this.db.school.findFirst();
        if (!school) {
            throw new shared_1.ServiceError('SCHOOL_NOT_CONFIGURED', 'École non configurée');
        }
        const year = new Date().getFullYear();
        const count = await this.db.student.count();
        const matricule = (0, shared_2.generateMatricule)({
            schoolSigle: school.sigle,
            firstName: data.firstName,
            lastName: data.lastName,
            year,
            sequence: count + 1,
        });
        const student = await this.db.student.create({
            data: { ...data, matricule },
        });
        await this.audit(actorId, 'CREATE', 'student', student.id);
        return student;
    }
    async update(id, data, actorId) {
        await this.findById(id);
        const student = await this.db.student.update({ where: { id }, data });
        await this.audit(actorId, 'UPDATE', 'student', id);
        return student;
    }
    async delete(id, actorId) {
        await this.findById(id);
        await this.db.student.delete({ where: { id } });
        await this.audit(actorId, 'DELETE', 'student', id);
    }
    async enroll(studentId, classId, academicYearId, actorId) {
        await this.findById(studentId);
        const enrollment = await this.db.enrollment.create({
            data: { studentId, classId, academicYearId },
        });
        await this.audit(actorId, 'ENROLL', 'enrollment', enrollment.id);
        return enrollment;
    }
}
exports.StudentService = StudentService;
//# sourceMappingURL=student.service.js.map