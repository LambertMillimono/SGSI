"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
class AuditService {
    db;
    constructor(db) {
        this.db = db;
    }
    async list(filters) {
        return this.db.auditLog.findMany({
            where: {
                ...(filters?.userId && { userId: filters.userId }),
                ...(filters?.entity && { entity: filters.entity }),
                ...(filters?.action && { action: filters.action }),
                ...((filters?.from || filters?.to) && {
                    createdAt: {
                        ...(filters.from && { gte: filters.from }),
                        ...(filters.to && { lte: filters.to }),
                    },
                }),
            },
            include: {
                user: {
                    select: { username: true, firstName: true, lastName: true, role: true },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: filters?.limit ?? 500,
        });
    }
    async countByAction(from, to) {
        const logs = await this.db.auditLog.findMany({
            where: { createdAt: { gte: from, lte: to } },
            select: { action: true },
        });
        const counts = {};
        for (const log of logs) {
            counts[log.action] = (counts[log.action] ?? 0) + 1;
        }
        return counts;
    }
}
exports.AuditService = AuditService;
//# sourceMappingURL=audit.service.js.map