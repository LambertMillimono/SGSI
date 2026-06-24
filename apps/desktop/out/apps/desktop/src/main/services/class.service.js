"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClassService = void 0;
const shared_1 = require("@sgsi/shared");
class ClassService {
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
    async listLevels() {
        return this.db.level.findMany({ orderBy: { order: 'asc' } });
    }
    async createLevel(data, actorId) {
        const level = await this.db.level.create({ data });
        await this.audit(actorId, 'CREATE', 'level', level.id);
        return level;
    }
    async listClasses(academicYearId) {
        return this.db.class.findMany({
            where: academicYearId ? { academicYearId } : undefined,
            include: {
                level: true,
                _count: { select: { enrollments: true } },
            },
            orderBy: { name: 'asc' },
        });
    }
    async createClass(data, actorId) {
        const cls = await this.db.class.create({ data });
        await this.audit(actorId, 'CREATE', 'class', cls.id);
        return cls;
    }
    async findClassById(id) {
        const cls = await this.db.class.findUnique({
            where: { id },
            include: {
                level: true,
                subjects: { include: { subject: true, teacher: { include: { user: true } } } },
                _count: { select: { enrollments: true } },
            },
        });
        if (!cls) {
            throw new shared_1.ServiceError('CLASS_NOT_FOUND', `Classe introuvable`);
        }
        return cls;
    }
    async updateClass(id, data, actorId) {
        await this.findClassById(id);
        const cls = await this.db.class.update({ where: { id }, data });
        await this.audit(actorId, 'UPDATE', 'class', id);
        return cls;
    }
}
exports.ClassService = ClassService;
//# sourceMappingURL=class.service.js.map