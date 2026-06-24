"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleware(jwtSecret) {
    return (req, res, next) => {
        const header = req.headers.authorization;
        if (!header?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'Token manquant' });
            return;
        }
        try {
            req.user = jsonwebtoken_1.default.verify(header.slice(7), jwtSecret);
            next();
        }
        catch {
            res.status(401).json({ error: 'Token invalide ou expiré' });
        }
    };
}
//# sourceMappingURL=auth.middleware.js.map