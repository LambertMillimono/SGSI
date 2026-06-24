"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startExpressServer = startExpressServer;
exports.stopExpressServer = stopExpressServer;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_middleware_1 = require("./middleware/cors.middleware");
const auth_middleware_1 = require("./middleware/auth.middleware");
const auth_routes_1 = require("./routes/auth.routes");
const students_routes_1 = require("./routes/students.routes");
const grades_routes_1 = require("./routes/grades.routes");
const payments_routes_1 = require("./routes/payments.routes");
let server = null;
async function startExpressServer(db) {
    const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production';
    const port = Number(process.env.EXPRESS_PORT ?? 3721);
    const app = (0, express_1.default)();
    app.use(cors_middleware_1.corsMiddleware);
    app.use(express_1.default.json({ limit: '10mb' }));
    // Health check — no auth required
    app.get('/api/status', (_, res) => {
        res.json({
            status: 'ok',
            name: 'SGSI',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
        });
    });
    // Auth routes — no auth middleware (this IS the login endpoint)
    app.use('/api/auth', (0, auth_routes_1.authRoutes)(db, jwtSecret));
    // Protected routes — require valid JWT
    const auth = (0, auth_middleware_1.authMiddleware)(jwtSecret);
    app.use('/api/student', auth, (0, students_routes_1.studentRoutes)(db));
    app.use('/api/teacher', auth, (0, grades_routes_1.teacherRoutes)(db));
    app.use('/api/payments', auth, (0, payments_routes_1.paymentRoutes)(db));
    // 404 handler
    app.use((_, res) => {
        res.status(404).json({ error: 'Route introuvable' });
    });
    server = http_1.default.createServer(app);
    return new Promise((resolve, reject) => {
        server.listen(port, '0.0.0.0', () => {
            console.log(`✅ Serveur mobile SGSI démarré sur le port ${port}`);
            resolve();
        });
        server.on('error', reject);
    });
}
function stopExpressServer() {
    if (server) {
        server.close();
        server = null;
        console.log('🛑 Serveur mobile arrêté');
    }
}
//# sourceMappingURL=index.js.map