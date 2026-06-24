"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = void 0;
exports.ok = ok;
exports.fail = fail;
function ok(data) {
    return { success: true, data };
}
function fail(code, message) {
    return { success: false, error: { code, message } };
}
class ServiceError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'ServiceError';
    }
}
exports.ServiceError = ServiceError;
//# sourceMappingURL=api.types.js.map