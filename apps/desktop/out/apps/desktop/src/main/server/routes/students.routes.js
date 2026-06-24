"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentRoutes = studentRoutes;
const express_1 = require("express");
const grade_service_1 = require("../../services/grade.service");
const absence_service_1 = require("../../services/absence.service");
const bulletin_service_1 = require("../../services/bulletin.service");
function studentRoutes(db) {
    const router = (0, express_1.Router)();
    const gradeService = new grade_service_1.GradeService(db);
    const absenceService = new absence_service_1.AbsenceService(db);
    const bulletinService = new bulletin_service_1.BulletinService(db);
    // GET /api/student/:id/grades?period=1
    router.get('/:id/grades', async (req, res) => {
        try {
            const period = Number(req.query.period ?? 1);
            const enrollment = await db.enrollment.findFirst({
                where: { studentId: req.params.id, status: 'ACTIVE' },
            });
            if (!enrollment) {
                res.status(404).json({ error: 'Inscription introuvable' });
                return;
            }
            const { subjectAverages, generalAverage, isEliminated } = await gradeService.computeAverages(enrollment.id, period);
            res.json({ subjectAverages, generalAverage, isEliminated, period });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/student/:id/absences
    router.get('/:id/absences', async (req, res) => {
        try {
            const enrollment = await db.enrollment.findFirst({
                where: { studentId: req.params.id, status: 'ACTIVE' },
            });
            if (!enrollment) {
                res.status(404).json({ error: 'Inscription introuvable' });
                return;
            }
            const [absences, counts] = await Promise.all([
                absenceService.listByEnrollment(enrollment.id),
                absenceService.countByEnrollment(enrollment.id),
            ]);
            res.json({ absences, counts });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/student/:id/bulletin/:period
    router.get('/:id/bulletin/:period', async (req, res) => {
        try {
            const period = Number(req.params.period);
            const enrollment = await db.enrollment.findFirst({
                where: { studentId: req.params.id, status: 'ACTIVE' },
            });
            if (!enrollment) {
                res.status(404).json({ error: 'Inscription introuvable' });
                return;
            }
            const actorId = req.user?.userId ?? 'mobile';
            const result = await bulletinService.generate(enrollment.id, period, actorId);
            res.json(result);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // GET /api/student/:id/payments
    router.get('/:id/payments', async (req, res) => {
        try {
            const enrollment = await db.enrollment.findFirst({
                where: { studentId: req.params.id, status: 'ACTIVE' },
                include: { payments: { include: { feeType: true } } },
            });
            if (!enrollment) {
                res.status(404).json({ error: 'Inscription introuvable' });
                return;
            }
            res.json({ payments: enrollment.payments });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=students.routes.js.map