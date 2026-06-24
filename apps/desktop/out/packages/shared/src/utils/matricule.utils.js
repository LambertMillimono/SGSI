"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMatricule = generateMatricule;
function generateMatricule(params) {
    const { schoolSigle, firstName, lastName, year, sequence } = params;
    if (!firstName.trim() || !lastName.trim()) {
        throw new Error('firstName and lastName must not be empty to generate a matricule');
    }
    const initials = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toUpperCase()}`;
    const seq = String(sequence).padStart(4, '0');
    return `${schoolSigle.toUpperCase()}${initials}-${year}-${seq}`;
}
//# sourceMappingURL=matricule.utils.js.map