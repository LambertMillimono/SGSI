-- Migration: add Cycle model, add cycleId to Level
-- Hierarchy: Cycle → Level (Niveau) → Class (Classe)

PRAGMA foreign_keys=OFF;

-- 1. Create Cycle table
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL
);

-- 2. Insert 4 default cycles
INSERT INTO "Cycle" ("id", "name", "order") VALUES
    ('cycle-maternelle', 'Maternelle', 1),
    ('cycle-primaire',   'Primaire',   2),
    ('cycle-college',    'Collège',    3),
    ('cycle-lycee',      'Lycée',      4);

-- 3. Create new Level table with cycleId
CREATE TABLE "new_Level" (
    "id"      TEXT    NOT NULL PRIMARY KEY,
    "name"    TEXT    NOT NULL,
    "order"   INTEGER NOT NULL,
    "cycleId" TEXT    NOT NULL,
    CONSTRAINT "Level_cycleId_fkey"
        FOREIGN KEY ("cycleId") REFERENCES "Cycle" ("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 4. Insert standard niveaux for all cycles
INSERT INTO "new_Level" ("id", "name", "order", "cycleId") VALUES
    -- Maternelle
    ('niveau-ps',   'Petite Section',  1, 'cycle-maternelle'),
    ('niveau-ms',   'Moyenne Section', 2, 'cycle-maternelle'),
    ('niveau-gs',   'Grande Section',  3, 'cycle-maternelle'),
    -- Primaire
    ('niveau-ci',   'CI',              1, 'cycle-primaire'),
    ('niveau-cp',   'CP',              2, 'cycle-primaire'),
    ('niveau-ce1',  'CE1',             3, 'cycle-primaire'),
    ('niveau-ce2',  'CE2',             4, 'cycle-primaire'),
    ('niveau-cm1',  'CM1',             5, 'cycle-primaire'),
    ('niveau-cm2',  'CM2',             6, 'cycle-primaire'),
    -- Collège
    ('niveau-6e',   '6ème',            1, 'cycle-college'),
    ('niveau-5e',   '5ème',            2, 'cycle-college'),
    ('niveau-4e',   '4ème',            3, 'cycle-college'),
    ('niveau-3e',   '3ème',            4, 'cycle-college'),
    -- Lycée
    ('niveau-2nde', 'Seconde',         1, 'cycle-lycee'),
    ('niveau-1ere', 'Première',        2, 'cycle-lycee'),
    ('niveau-tale', 'Terminale',       3, 'cycle-lycee');

-- 5. Update Class.levelId based on class name patterns
UPDATE "Class" SET "levelId" = 'niveau-ce2'  WHERE "name" LIKE '%CE2%';
UPDATE "Class" SET "levelId" = 'niveau-ce1'  WHERE "name" LIKE '%CE1%';
UPDATE "Class" SET "levelId" = 'niveau-cm2'  WHERE "name" LIKE '%CM2%';
UPDATE "Class" SET "levelId" = 'niveau-cm1'  WHERE "name" LIKE '%CM1%';
UPDATE "Class" SET "levelId" = 'niveau-cp'   WHERE "name" LIKE 'CP%' OR "name" LIKE '% CP%';
UPDATE "Class" SET "levelId" = 'niveau-ci'   WHERE "name" LIKE 'CI%' OR "name" LIKE '% CI%';
UPDATE "Class" SET "levelId" = 'niveau-6e'   WHERE "name" LIKE '6%me%' OR "name" LIKE '%6ème%';
UPDATE "Class" SET "levelId" = 'niveau-5e'   WHERE "name" LIKE '5%me%' OR "name" LIKE '%5ème%';
UPDATE "Class" SET "levelId" = 'niveau-4e'   WHERE "name" LIKE '4%me%' OR "name" LIKE '%4ème%';
UPDATE "Class" SET "levelId" = 'niveau-3e'   WHERE "name" LIKE '3%me%' OR "name" LIKE '%3ème%';
UPDATE "Class" SET "levelId" = 'niveau-2nde' WHERE lower("name") LIKE '%seconde%' OR lower("name") LIKE '%2nde%';
UPDATE "Class" SET "levelId" = 'niveau-1ere' WHERE lower("name") LIKE '%premi%re%' OR lower("name") LIKE '%1%re%';
UPDATE "Class" SET "levelId" = 'niveau-tale' WHERE lower("name") LIKE '%terminale%';
-- Fallback: classes still pointing to old level IDs → CI
UPDATE "Class" SET "levelId" = 'niveau-ci'
    WHERE "levelId" IN ('level-primaire','level-college','level-lycee');

-- 6. Update FeeType.levelId
UPDATE "FeeType" SET "levelId" = 'niveau-ci'   WHERE "levelId" = 'level-primaire';
UPDATE "FeeType" SET "levelId" = 'niveau-6e'   WHERE "levelId" = 'level-college';
UPDATE "FeeType" SET "levelId" = 'niveau-2nde' WHERE "levelId" = 'level-lycee';
-- Safety: null any remaining old references
UPDATE "FeeType" SET "levelId" = NULL WHERE "levelId" LIKE 'level-%';

-- 7. Drop old Level table (no more references to old IDs)
DROP TABLE "Level";

-- 8. Rename new Level table
ALTER TABLE "new_Level" RENAME TO "Level";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
