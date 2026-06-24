"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_service_1 = require("../auth.service");
let prisma;
let authService;
(0, vitest_1.beforeAll)(async () => {
    // Use the dev database — it already has the full schema applied via migrations
    // Resolve path: from __tests__ go 6 levels up to repo root, then into packages/db/prisma
    const { resolve } = await Promise.resolve().then(() => __importStar(require('path')));
    const dbPath = resolve(process.cwd(), '../../packages/db/prisma/sgsi.db');
    prisma = new client_1.PrismaClient({
        datasources: { db: { url: `file:${dbPath}` } },
    });
    // Use the main dev database for tests but with unique test data
    const hash = await bcryptjs_1.default.hash('password123', 4); // cost 4 for speed in tests
    await prisma.user.upsert({
        where: { username: 'testuser-auth' },
        // Always reset password and flags to ensure a clean starting state
        update: { password: hash, mustChangePassword: false, isActive: true },
        create: {
            username: 'testuser-auth',
            password: hash,
            role: 'SECRETARY',
            firstName: 'Test',
            lastName: 'User',
        },
    });
    authService = new auth_service_1.AuthService(prisma, 'test-jwt-secret');
});
(0, vitest_1.afterAll)(async () => {
    // Delete audit logs first (foreign key constraint) then the user
    const users = await prisma.user.findMany({ where: { username: 'testuser-auth' } });
    for (const u of users) {
        await prisma.auditLog.deleteMany({ where: { userId: u.id } });
    }
    await prisma.user.deleteMany({ where: { username: 'testuser-auth' } });
    await prisma.$disconnect();
});
(0, vitest_1.describe)('AuthService.login', () => {
    (0, vitest_1.it)('returns JWT token and user on valid credentials', async () => {
        const result = await authService.login('testuser-auth', 'password123');
        (0, vitest_1.expect)(result.token).toBeDefined();
        (0, vitest_1.expect)(typeof result.token).toBe('string');
        (0, vitest_1.expect)(result.user.username).toBe('testuser-auth');
        (0, vitest_1.expect)(result.user.role).toBe('SECRETARY');
        // Password must NOT be in the response
        (0, vitest_1.expect)(result.user.password).toBeUndefined();
    });
    (0, vitest_1.it)('throws ServiceError with code INVALID_CREDENTIALS on wrong password', async () => {
        await (0, vitest_1.expect)(authService.login('testuser-auth', 'wrongpassword')).rejects.toMatchObject({
            code: 'INVALID_CREDENTIALS',
        });
    });
    (0, vitest_1.it)('throws ServiceError with code INVALID_CREDENTIALS on unknown user', async () => {
        await (0, vitest_1.expect)(authService.login('nonexistent', 'password')).rejects.toMatchObject({
            code: 'INVALID_CREDENTIALS',
        });
    });
});
(0, vitest_1.describe)('AuthService.verifyToken', () => {
    (0, vitest_1.it)('returns payload for valid token', async () => {
        const { token } = await authService.login('testuser-auth', 'password123');
        const payload = authService.verifyToken(token);
        (0, vitest_1.expect)(payload.username).toBe('testuser-auth');
        (0, vitest_1.expect)(payload.role).toBe('SECRETARY');
        (0, vitest_1.expect)(payload.userId).toBeDefined();
    });
    (0, vitest_1.it)('throws for invalid token', () => {
        (0, vitest_1.expect)(() => authService.verifyToken('not-a-token')).toThrow();
    });
    (0, vitest_1.it)('throws for tampered token', () => {
        (0, vitest_1.expect)(() => authService.verifyToken('eyJhbGciOiJIUzI1NiJ9.tampered.signature')).toThrow();
    });
});
(0, vitest_1.describe)('AuthService.requestPasswordReset', () => {
    (0, vitest_1.it)('returns a temp password string', async () => {
        const users = await prisma.user.findMany({ where: { username: 'testuser-auth' } });
        const tempPwd = await authService.requestPasswordReset(users[0].id, users[0].id);
        (0, vitest_1.expect)(typeof tempPwd).toBe('string');
        (0, vitest_1.expect)(tempPwd.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('sets mustChangePassword=true on user', async () => {
        const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } });
        (0, vitest_1.expect)(user?.mustChangePassword).toBe(true);
    });
});
(0, vitest_1.describe)('AuthService.changePassword', () => {
    (0, vitest_1.it)('allows login with new password after change', async () => {
        const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } });
        await authService.changePassword(user.id, 'NewSecurePassword@456');
        const result = await authService.login('testuser-auth', 'NewSecurePassword@456');
        (0, vitest_1.expect)(result.token).toBeDefined();
    });
    (0, vitest_1.it)('sets mustChangePassword=false after change', async () => {
        const user = await prisma.user.findUnique({ where: { username: 'testuser-auth' } });
        (0, vitest_1.expect)(user?.mustChangePassword).toBe(false);
    });
});
//# sourceMappingURL=auth.service.test.js.map