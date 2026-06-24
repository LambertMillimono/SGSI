"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsenceService = void 0;
const shared_1 = require("@sgsi/shared");
class AbsenceService {
    db;
    constructor(db) {
        this.db = db;
    }
    async record(data, actorId) {
        if (!['ABSENCE', 'LATE', 'EARLY_LEAVE'].includes(data.type)) {
            throw new shared_1.ServiceError('INVALID_ABSENCE_TYPE', `Type d'absence invalide: ${data.type}`);
        }
        const absence = await this.db.absence.create({ data });
        await this.tryAudit(actorId, 'ABSENCE_RECORDED', 'absence', absence.id);
        return absence;
    }
    async listByEnrollment(enrollmentId) {
        return this.db.absence.findMany({
            where: { enrollmentId },
            orderBy: { date: 'desc' },
        });
    }
    async listByClass(classId, date) {
        const where = {
            enrollment: { classId },
        };
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.date = { gte: start, lte: end };
        }
        return this.db.absence.findMany({
            where,
            include: {
                enrollment: {
                    include: {
                        student: { select: { id: true, firstName: true, lastName: true, matricule: true } },
                    },
                },
            },
            orderBy: { date: 'desc' },
        });
    }
    async justify(absenceId, reason, actorId) {
        const absence = await this.db.absence.findUnique({ where: { id: absenceId } });
        if (!absence) {
            throw new shared_1.ServiceError('ABSENCE_NOT_FOUND', 'Absence introuvable');
        }
        const updated = await this.db.absence.update({
            where: { id: absenceId },
            data: { justified: true, reason },
        });
        await this.tryAudit(actorId, 'ABSENCE_JUSTIFIED', 'absence', absenceId);
        return updated;
    }
    async countByEnrollment(enrollmentId) {
        const absences = await this.db.absence.findMany({
            where: { enrollmentId, type: 'ABSENCE' },
        });
        const justified = absences.filter((a) => a.justified).length;
        return {
            total: absences.length,
            justified,
            unjustified: absences.length - justified,
        };
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
exports.AbsenceService = AbsenceService;
//# sourceMappingURL=absence.service.js.map