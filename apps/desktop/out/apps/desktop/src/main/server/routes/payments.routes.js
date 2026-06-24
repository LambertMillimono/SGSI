"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRoutes = paymentRoutes;
const express_1 = require("express");
function paymentRoutes(db) {
    const router = (0, express_1.Router)();
    // GET /api/payments/student/:enrollmentId
    router.get('/student/:enrollmentId', async (req, res) => {
        try {
            const payments = await db.payment.findMany({
                where: { enrollmentId: req.params.enrollmentId },
                include: { feeType: true },
                orderBy: { paidAt: 'desc' },
            });
            res.json({ payments });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=payments.routes.js.map