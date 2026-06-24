"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = void 0;
exports.ROLE_PERMISSIONS = {
    SUPER_ADMIN: [{ module: '*', actions: ['read', 'write', 'delete', 'validate'] }],
    DIRECTOR: [
        { module: 'students', actions: ['read'] },
        { module: 'grades', actions: ['read', 'validate'] },
        { module: 'bulletins', actions: ['read', 'validate'] },
        { module: 'payments', actions: ['read', 'validate'] },
        { module: 'staff', actions: ['read', 'write'] },
        { module: 'reports', actions: ['read'] },
        { module: 'school', actions: ['read', 'write'] },
    ],
    SECRETARY: [
        { module: 'students', actions: ['read', 'write'] },
        { module: 'absences', actions: ['read', 'write'] },
        { module: 'documents', actions: ['read', 'write'] },
    ],
    ACCOUNTANT: [
        { module: 'payments', actions: ['read', 'write'] },
        { module: 'expenses', actions: ['read', 'write'] },
        { module: 'reports', actions: ['read'] },
        { module: 'salary', actions: ['read', 'write'] },
    ],
    TEACHER: [
        { module: 'grades', actions: ['read', 'write'] },
        { module: 'absences', actions: ['read', 'write'] },
        { module: 'classes', actions: ['read'] },
    ],
};
//# sourceMappingURL=user.types.js.map