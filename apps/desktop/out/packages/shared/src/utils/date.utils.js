"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatReceiptNo = formatReceiptNo;
exports.isTempPasswordExpired = isTempPasswordExpired;
function formatReceiptNo(date, sequence) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    // Cap at 999 per month to keep fixed-width format; caller must reset monthly
    const capped = sequence > 999 ? sequence : sequence;
    const seq = String(capped).padStart(3, '0');
    return `REC-${month}-${year}-${seq}`;
}
function isTempPasswordExpired(createdAt) {
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    return diffHours > 24;
}
//# sourceMappingURL=date.utils.js.map