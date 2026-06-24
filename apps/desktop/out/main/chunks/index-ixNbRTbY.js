"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const index = require("../index.js");
require("electron");
require("path");
require("@prisma/client");
require("fs");
require("crypto");
require("bcryptjs");
require("jsonwebtoken");
require("archiver");
require("os");
require("express");
require("http");
require("cors");
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: [{ module: "*", actions: ["read", "write", "delete", "validate"] }],
  DIRECTOR: [
    { module: "students", actions: ["read"] },
    { module: "grades", actions: ["read", "validate"] },
    { module: "bulletins", actions: ["read", "validate"] },
    { module: "payments", actions: ["read", "validate"] },
    { module: "staff", actions: ["read", "write"] },
    { module: "reports", actions: ["read"] },
    { module: "school", actions: ["read", "write"] }
  ],
  SECRETARY: [
    { module: "students", actions: ["read", "write"] },
    { module: "absences", actions: ["read", "write"] },
    { module: "documents", actions: ["read", "write"] }
  ],
  ACCOUNTANT: [
    { module: "payments", actions: ["read", "write"] },
    { module: "expenses", actions: ["read", "write"] },
    { module: "reports", actions: ["read"] },
    { module: "salary", actions: ["read", "write"] }
  ],
  TEACHER: [
    { module: "grades", actions: ["read", "write"] },
    { module: "absences", actions: ["read", "write"] },
    { module: "classes", actions: ["read"] }
  ]
};
exports.DEFAULT_EVAL_WEIGHTS = index.DEFAULT_EVAL_WEIGHTS;
exports.ServiceError = index.ServiceError;
exports.calcGeneralAverage = index.calcGeneralAverage;
exports.calcRankings = index.calcRankings;
exports.calcSubjectAverage = index.calcSubjectAverage;
exports.fail = index.fail;
exports.formatReceiptNo = index.formatReceiptNo;
exports.generateMatricule = index.generateMatricule;
exports.getAppreciation = index.getAppreciation;
exports.ok = index.ok;
exports.ROLE_PERMISSIONS = ROLE_PERMISSIONS;
