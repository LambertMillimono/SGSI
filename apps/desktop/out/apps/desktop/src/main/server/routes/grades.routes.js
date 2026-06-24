"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherRoutes = teacherRoutes;
const express_1 = require("express");
const grade_service_1 = require("../../services/grade.service");
const absence_service_1 = require("../../services/absence.service");
function teacherRoutes(db) {
    const router = (0, express_1.Router)();
    const gradeService = new grade_service_1.GradeService(db);
    const absenceService = new absence_service_1.AbsenceService(db);
    // POST /api/teacher/:id/grades — offline sync (batch)
    router.post('/:id/grades', async (req, res) => {
        try {
            const { grades } = req.body;
            if (!Array.isArray(grades)) {
                res.status(400).json({ error: 'grades doit être un tableau' });
                return;
            }
            const actorId = req.user?.userId ?? req.params.id;
            const saved = await Promise.allSettled(grades.map((g) => gradeService.save(g, actorId)));
            const succeeded = saved.filter((r) => r.status === 'fulfilled').length;
            const failed = saved
                .filter((r) => r.status === 'rejected')
                .map((r) => r.reason?.message);
            res.json({ saved: succeeded, failed });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // POST /api/teacher/:id/absences — offline sync (batch)
    router.post('/:id/absences', async (req, res) => {
        try {
            const { absences } = req.body;
            if (!Array.isArray(absences)) {
                res.status(400).json({ error: 'absences doit être un tableau' });
                return;
            }
            const actorId = req.user?.userId ?? req.params.id;
            const saved = await Promise.allSettled(absences.map((a) => absenceService.record(a, actorId)));
            const succeeded = saved.filter((r) => r.status === 'fulfilled').length;
            const failed = saved
                .filter((r) => r.status === 'rejected')
                .map((r) => r.reason?.message);
            res.json({ saved: succeeded, failed });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=grades.routes.js.map