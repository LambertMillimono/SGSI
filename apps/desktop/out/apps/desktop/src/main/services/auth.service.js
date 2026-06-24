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
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const shared_1 = require("@sgsi/shared");
class AuthService {
    db;
    jwtSecret;
    constructor(db, jwtSecret) {
        this.db = db;
        this.jwtSecret = jwtSecret;
    }
    async login(username, password) {
        const user = await this.db.user.findUnique({ where: { username } });
        if (!user || !user.isActive) {
            throw new shared_1.ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides');
        }
        const valid = await bcryptjs_1.default.compare(password, user.password);
        if (!valid) {
            throw new shared_1.ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides');
        }
        await this.db.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        });
        await this.db.auditLog.create({
            data: {
                userId: user.id,
                action: 'LOGIN',
                entity: 'user',
                entityId: user.id,
            },
        });
        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role,
        };
        const token = jsonwebtoken_1.default.sign(payload, this.jwtSecret, { expiresIn: '8h' });
        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                firstName: user.firstName,
                lastName: user.lastName,
                mustChangePassword: user.mustChangePassword,
            },
        };
    }
    verifyToken(token) {
        return jsonwebtoken_1.default.verify(token, this.jwtSecret);
    }
    async requestPasswordReset(userId, requestedBy) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let tempPassword = '';
        for (let i = 0; i < 8; i++) {
            tempPassword += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const hashed = await bcryptjs_1.default.hash(tempPassword, 12);
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await this.db.user.update({
            where: { id: userId },
            data: {
                password: hashed,
                mustChangePassword: true,
                tempPasswordExpiry: expiry,
            },
        });
        await this.db.auditLog.create({
            data: {
                userId: requestedBy,
                action: 'PASSWORD_RESET_REQUEST',
                entity: 'user',
                entityId: userId,
            },
        });
        return tempPassword;
    }
    async changePassword(userId, newPassword) {
        const hashed = await bcryptjs_1.default.hash(newPassword, 12);
        await this.db.user.update({
            where: { id: userId },
            data: {
                password: hashed,
                mustChangePassword: false,
                tempPasswordExpiry: null,
            },
        });
        await this.db.auditLog.create({
            data: {
                userId,
                action: 'PASSWORD_CHANGED',
                entity: 'user',
                entityId: userId,
            },
        });
    }
    async checkPermission(userId, module, action) {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive)
            return false;
        if (user.role === 'SUPER_ADMIN')
            return true;
        const { ROLE_PERMISSIONS } = await Promise.resolve().then(() => __importStar(require('@sgsi/shared')));
        const perms = ROLE_PERMISSIONS[user.role] ?? [];
        return perms.some((p) => (p.module === module || p.module === '*') &&
            p.actions.includes(action));
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map