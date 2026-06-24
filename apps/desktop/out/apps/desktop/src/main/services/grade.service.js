"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradeService = void 0;
const shared_1 = require("@sgsi/shared");
class GradeService {
    db;
    constructor(db) {
        this.db = db;
    }
    async listByEnrollment(enrollmentId, period) {
        return this.db.grade.findMany({
            where: { enrollmentId, period },
            include: { subject: true },
            orderBy: { enteredAt: 'asc' },
        });
    }
    async save(data, actorId) {
        const maxValue = data.maxValue ?? 20;
        if (data.value < 0 || data.value > maxValue) {
            throw new shared_1.ServiceError('INVALID_GRADE', `Note invalide : ${data.value} (doit être entre 0 et ${maxValue})`);
        }
        const grade = await this.db.grade.create({
            data: { ...data, maxValue },
        });
        await this.tryAudit(actorId, 'GRADE_SAVED', 'grade', grade.id);
        return grade;
    }
    async computeAverages(enrollmentId, period, weights = shared_1.DEFAULT_EVAL_WEIGHTS) {
        const enrollment = await this.db.enrollment.findUnique({
            where: { id: enrollmentId },
            include: {
                class: {
                    include: {
                        subjects: { include: { subject: true } },
                    },
                },
            },
        });
        if (!enrollment) {
            throw new shared_1.ServiceError('ENROLLMENT_NOT_FOUND', 'Inscription introuvable');
        }
        const school = await this.db.school.findFirst();
        const eliminatoryThreshold = school?.eliminatoryThreshold ?? 5;
        const grades = await this.listByEnrollment(enrollmentId, period);
        const subjectAverages = enrollment.class.subjects.map((cs) => {
            const subjectGrades = grades.filter((g) => g.subjectId === cs.subjectId);
            const average = (0, shared_1.calcSubjectAverage)(subjectGrades, weights);
            return {
                subjectId: cs.subjectId,
                subjectName: cs.subject.name,
                coefficient: cs.coefficient,
                average,
                grades: subjectGrades,
            };
        });
        const generalAverage = (0, shared_1.calcGeneralAverage)(subjectAverages);
        const isEliminated = subjectAverages.some((s) => s.grades.length > 0 && s.average < eliminatoryThreshold);
        return { subjectAverages, generalAverage, isEliminated };
    }
    async computeClassRankings(classId, period) {
        const enrollments = await this.db.enrollment.findMany({
            where: { classId, status: 'ACTIVE' },
            include: { student: true },
        });
        const averages = await Promise.all(enrollments.map(async (e) => {
            const { generalAverage, isEliminated } = await this.computeAverages(e.id, period);
            return {
                enrollmentId: e.id,
                studentId: e.studentId,
                studentName: `${e.student.firstName} ${e.student.lastName}`,
                generalAverage,
                isEliminated,
            };
        }));
        return (0, shared_1.calcRankings)(averages);
    }
    async lockGrades(enrollmentId, period, actorId) {
        await this.db.grade.updateMany({
            where: { enrollmentId, period },
            data: { isLocked: true },
        });
        await this.tryAudit(actorId, 'GRADES_LOCKED', 'enrollment', enrollmentId, `period:${period}`);
    }
    async tryAudit(userId, action, entity, entityId, details) {
        try {
            await this.db.auditLog.create({ data: { userId, action, entity, entityId, details } });
        }
        catch {
            // Audit is non-fatal
        }
    }
}
exports.GradeService = GradeService;
//# sourceMappingURL=grade.service.js.map