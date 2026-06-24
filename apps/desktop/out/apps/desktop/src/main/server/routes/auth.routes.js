"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = authRoutes;
const express_1 = require("express");
const auth_service_1 = require("../../services/auth.service");
function authRoutes(db, jwtSecret) {
    const router = (0, express_1.Router)();
    const auth = new auth_service_1.AuthService(db, jwtSecret);
    // Mobile login — parents use student matricule as username + their access code as password
    // Teachers use their normal username + password
    router.post('/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                res.status(400).json({ error: 'username et password requis' });
                return;
            }
            const result = await auth.login(username, password);
            res.json(result);
        }
        catch (e) {
            res.status(401).json({ error: e.message });
        }
    });
    return router;
}
//# sourceMappingURL=auth.routes.js.map