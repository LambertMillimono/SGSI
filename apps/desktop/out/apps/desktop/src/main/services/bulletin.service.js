"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulletinService = void 0;
const shared_1 = require("@sgsi/shared");
const grade_service_1 = require("./grade.service");
class BulletinService {
    db;
    gradeService;
    constructor(db) {
        this.db = db;
        this.gradeService = new grade_service_1.GradeService(db);
    }
    async generate(enrollmentId, period, actorId) {
        const enrollment = await this.db.enrollment.findUnique({
            where: { id: enrollmentId },
            include: { class: true },
        });
        if (!enrollment) {
            throw new shared_1.ServiceError('ENROLLMENT_NOT_FOUND', 'Inscription introuvable');
        }
        const { generalAverage, subjectAverages, isEliminated } = await this.gradeService.computeAverages(enrollmentId, period);
        const rankings = await this.gradeService.computeClassRankings(enrollment.classId, period);
        const myRank = rankings.find((r) => r.enrollmentId === enrollmentId);
        const school = await this.db.school.findFirst();
        const passingAverage = school?.passingAverage ?? 10;
        const decision = isEliminated
            ? 'Redouble'
            : generalAverage >= passingAverage
                ? 'Admis(e)'
                : 'Passage conditionnel';
        const bulletinId = `bulletin-${enrollmentId}-${period}`;
        const bulletin = await this.db.bulletin.upsert({
            where: { id: bulletinId },
            update: {
                generalAverage,
                rank: myRank?.rank ?? 0,
                totalStudents: rankings.length,
                appreciation: (0, shared_1.getAppreciation)(generalAverage),
                decision,
            },
            create: {
                id: bulletinId,
                enrollmentId,
                period,
                generalAverage,
                rank: myRank?.rank ?? 0,
                totalStudents: rankings.length,
                appreciation: (0, shared_1.getAppreciation)(generalAverage),
                decision,
            },
        });
        await this.tryAudit(actorId, 'BULLETIN_GENERATED', 'bulletin', bulletin.id);
        return { bulletin, subjectAverages, rankings };
    }
    async validate(bulletinId, directorId) {
        const bulletin = await this.db.bulletin.findUnique({ where: { id: bulletinId } });
        if (!bulletin) {
            throw new shared_1.ServiceError('BULLETIN_NOT_FOUND', 'Bulletin introuvable');
        }
        if (bulletin.isValidated) {
            throw new shared_1.ServiceError('ALREADY_VALIDATED', 'Ce bulletin est déjà validé');
        }
        const updated = await this.db.bulletin.update({
            where: { id: bulletinId },
            data: { isValidated: true, validatedAt: new Date() },
        });
        await this.tryAudit(directorId, 'BULLETIN_VALIDATED', 'bulletin', bulletinId);
        return updated;
    }
    async findByEnrollment(enrollmentId) {
        return this.db.bulletin.findMany({
            where: { enrollmentId },
            orderBy: { period: 'asc' },
        });
    }
    async findById(id) {
        const bulletin = await this.db.bulletin.findUnique({ where: { id } });
        if (!bulletin) {
            throw new shared_1.ServiceError('BULLETIN_NOT_FOUND', 'Bulletin introuvable');
        }
        return bulletin;
    }
    async tryAudit(userId, action, entity, entityId) {
        try {
            await this.db.auditLog.create({ data: { userId, action, entity, entityId } });
        }
        catch {
            // Audit is non-fatal
        }
    }
}
exports.BulletinService = BulletinService;
//# sourceMappingURL=bulletin.service.js.map