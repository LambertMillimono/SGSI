-- CreateTable: DisciplinaryRecord
CREATE TABLE IF NOT EXISTS "DisciplinaryRecord" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "studentId"   TEXT NOT NULL,
    "date"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type"        TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sanction"    TEXT,
    "issuedBy"    TEXT NOT NULL,
    "resolved"    BOOLEAN NOT NULL DEFAULT 0,
    "resolvedAt"  DATETIME,
    "note"        TEXT,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryRecord_studentId_fkey"
        FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DisciplinaryRecord_studentId_idx" ON "DisciplinaryRecord"("studentId");
CREATE INDEX IF NOT EXISTS "DisciplinaryRecord_date_idx" ON "DisciplinaryRecord"("date" DESC);
