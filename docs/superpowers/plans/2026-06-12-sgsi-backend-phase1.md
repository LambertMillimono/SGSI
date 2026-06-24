# SGSI Backend Phase 1 — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire la fondation backend complète du SGSI : monorepo npm workspaces, schéma Prisma SQLite (33 modèles), 9 services métier, couche IPC Electron, serveur Express local pour la sync mobile, et authentification bcrypt/JWT.

**Architecture:** Monorepo npm workspaces avec `packages/shared` (types TypeScript), `packages/db` (Prisma + SQLite) et `apps/desktop` (Electron main process). Les services métier sont de simples classes TypeScript injectées avec PrismaClient. La couche IPC est le seul point d'entrée depuis le renderer. Le serveur Express écoute sur le port 3721 pour les clients mobiles.

**Tech Stack:** Node.js v24, TypeScript 5.x strict, Electron 31, Prisma 5.x, SQLite (better-sqlite3), bcryptjs, jsonwebtoken, Express 4, Vitest 1.x, archiver

---

## Fichiers à créer

```
sgsi/
├── package.json                                     ← workspace root
├── tsconfig.base.json
├── .gitignore
├── .env                                             ← racine (vide, documenté)
│
├── packages/
│   ├── shared/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       │   ├── user.types.ts
│   │       │   ├── student.types.ts
│   │       │   ├── grade.types.ts
│   │       │   ├── payment.types.ts
│   │       │   └── api.types.ts
│   │       └── utils/
│   │           ├── grade.utils.ts
│   │           ├── matricule.utils.ts
│   │           └── date.utils.ts
│   │
│   └── db/
│       ├── package.json
│       ├── tsconfig.json
│       ├── .env
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           ├── client.ts
│           └── seed.ts
│
└── apps/
    └── desktop/
        ├── package.json
        ├── tsconfig.json
        ├── electron.vite.config.ts
        ├── .env
        └── src/
            └── main/
                ├── index.ts
                ├── database/
                │   └── client.ts
                ├── services/
                │   ├── auth.service.ts
                │   ├── student.service.ts
                │   ├── class.service.ts
                │   ├── grade.service.ts
                │   ├── payment.service.ts
                │   ├── bulletin.service.ts
                │   ├── absence.service.ts
                │   ├── audit.service.ts
                │   └── backup.service.ts
                ├── ipc/
                │   ├── index.ts
                │   ├── auth.ipc.ts
                │   ├── students.ipc.ts
                │   ├── classes.ipc.ts
                │   ├── grades.ipc.ts
                │   ├── payments.ipc.ts
                │   └── backup.ipc.ts
                └── server/
                    ├── index.ts
                    ├── middleware/
                    │   ├── auth.middleware.ts
                    │   └── cors.middleware.ts
                    └── routes/
                        ├── auth.routes.ts
                        ├── students.routes.ts
                        ├── grades.routes.ts
                        └── payments.routes.ts
```

---

## Task 1 : Monorepo root

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.gitignore`

- [ ] **Créer `package.json` racine**

```json
{
  "name": "sgsi",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "db:generate": "npm run generate -w packages/db",
    "db:migrate": "npm run migrate -w packages/db",
    "db:seed": "npm run seed -w packages/db",
    "db:studio": "npm run studio -w packages/db",
    "build": "npm run build --workspaces --if-present",
    "desktop:dev": "npm run dev -w apps/desktop",
    "test": "npm run test --workspaces --if-present",
    "typecheck": "tsc -p tsconfig.base.json --noEmit"
  }
}
```

- [ ] **Créer `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist"
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Créer `.gitignore`**

```
node_modules/
dist/
*.db
*.db-journal
.env
.env.local
*.zip
```

- [ ] **Initialiser git et faire le premier commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git init
git add package.json tsconfig.base.json .gitignore
git commit -m "chore: init monorepo workspace"
```

---

## Task 2 : packages/shared — Types TypeScript

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/user.types.ts`
- Create: `packages/shared/src/types/student.types.ts`
- Create: `packages/shared/src/types/grade.types.ts`
- Create: `packages/shared/src/types/payment.types.ts`
- Create: `packages/shared/src/types/api.types.ts`
- Create: `packages/shared/src/utils/grade.utils.ts`
- Create: `packages/shared/src/utils/matricule.utils.ts`
- Create: `packages/shared/src/utils/date.utils.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Créer `packages/shared/package.json`**

```json
{
  "name": "@sgsi/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Créer `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Créer `packages/shared/src/types/user.types.ts`**

```typescript
export type Role = 'SUPER_ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'ACCOUNTANT' | 'TEACHER'

export interface User {
  id: string
  username: string
  role: Role
  firstName: string
  lastName: string
  phone?: string
  email?: string
  isActive: boolean
  mustChangePassword: boolean
  lastLogin?: Date
  createdAt: Date
}

export interface TokenPayload {
  userId: string
  username: string
  role: Role
  iat: number
  exp: number
}

export interface Permission {
  module: string
  actions: ('read' | 'write' | 'delete' | 'validate')[]
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
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
}
```

- [ ] **Créer `packages/shared/src/types/student.types.ts`**

```typescript
export type Gender = 'MALE' | 'FEMALE'
export type EnrollStatus = 'ACTIVE' | 'TRANSFERRED' | 'GRADUATED' | 'EXPELLED'

export interface Student {
  id: string
  matricule: string
  firstName: string
  lastName: string
  gender: Gender
  birthDate: Date
  birthPlace?: string
  nationality?: string
  address?: string
  phone?: string
  email?: string
  photo?: string
  createdAt: Date
}

export interface Enrollment {
  id: string
  studentId: string
  classId: string
  academicYearId: string
  status: EnrollStatus
  enrolledAt: Date
}

export interface CreateStudentInput {
  firstName: string
  lastName: string
  gender: Gender
  birthDate: Date
  birthPlace?: string
  nationality?: string
  address?: string
  phone?: string
  email?: string
  photo?: string
}
```

- [ ] **Créer `packages/shared/src/types/grade.types.ts`**

```typescript
export type EvalType = 'INTERROGATION' | 'DEVOIR' | 'CONTROLE' | 'TP' | 'EXAM'

export interface Grade {
  id: string
  enrollmentId: string
  subjectId: string
  period: number
  evalType: EvalType
  value: number
  maxValue: number
  weight: number
  isLocked: boolean
  enteredAt: Date
}

export interface SubjectAverage {
  subjectId: string
  subjectName: string
  coefficient: number
  average: number
  grades: Grade[]
}

export interface Ranking {
  enrollmentId: string
  studentId: string
  studentName: string
  generalAverage: number
  rank: number
  isEliminated: boolean
}

export interface EvalWeights {
  INTERROGATION: number
  DEVOIR: number
  CONTROLE: number
  TP: number
  EXAM: number
}

export const DEFAULT_EVAL_WEIGHTS: EvalWeights = {
  INTERROGATION: 1,
  DEVOIR: 2,
  CONTROLE: 2,
  TP: 1,
  EXAM: 3,
}
```

- [ ] **Créer `packages/shared/src/types/payment.types.ts`**

```typescript
export type PayMethod = 'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'MOBILE_MONEY' | 'BANK_CARD' | 'BANK_TRANSFER' | 'CHECK'

export interface Payment {
  id: string
  enrollmentId: string
  feeTypeId: string
  amount: number
  method: PayMethod
  receiptNo: string
  cashierId: string
  note?: string
  paidAt: Date
}

export interface FeeType {
  id: string
  name: string
  amount: number
  levelId?: string
  isRequired: boolean
}

export interface UnpaidStudent {
  studentId: string
  studentName: string
  matricule: string
  className: string
  totalDue: number
  totalPaid: number
  balance: number
}
```

- [ ] **Créer `packages/shared/src/types/api.types.ts`**

```typescript
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export function ok<T>(data: T): IpcResponse<T> {
  return { success: true, data }
}

export function fail(code: string, message: string): IpcResponse<never> {
  return { success: false, error: { code, message } }
}

export class ServiceError extends Error {
  constructor(public code: string, message: string) {
    super(message)
    this.name = 'ServiceError'
  }
}
```

- [ ] **Créer `packages/shared/src/utils/grade.utils.ts`**

```typescript
import type { Grade, SubjectAverage, Ranking, EvalWeights, DEFAULT_EVAL_WEIGHTS } from '../types/grade.types'

export function calcSubjectAverage(grades: Grade[], weights: EvalWeights): number {
  if (grades.length === 0) return 0
  const totalWeight = grades.reduce((sum, g) => sum + weights[g.evalType], 0)
  if (totalWeight === 0) return 0
  const weightedSum = grades.reduce((sum, g) => sum + g.value * weights[g.evalType], 0)
  return Math.round((weightedSum / totalWeight) * 100) / 100
}

export function calcGeneralAverage(subjectAverages: SubjectAverage[]): number {
  if (subjectAverages.length === 0) return 0
  const totalCoeff = subjectAverages.reduce((sum, s) => sum + s.coefficient, 0)
  if (totalCoeff === 0) return 0
  const weightedSum = subjectAverages.reduce((sum, s) => sum + s.average * s.coefficient, 0)
  return Math.round((weightedSum / totalCoeff) * 100) / 100
}

export function calcRankings(averages: { enrollmentId: string; studentName: string; studentId: string; generalAverage: number; isEliminated: boolean }[]): Ranking[] {
  const sorted = [...averages].sort((a, b) => b.generalAverage - a.generalAverage)
  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1,
  }))
}

export function getAppreciation(average: number): string {
  if (average >= 18) return 'Excellent'
  if (average >= 16) return 'Très Bien'
  if (average >= 14) return 'Bien'
  if (average >= 12) return 'Assez Bien'
  if (average >= 10) return 'Passable'
  return 'Insuffisant'
}
```

- [ ] **Créer `packages/shared/src/utils/matricule.utils.ts`**

```typescript
export function generateMatricule(params: {
  schoolSigle: string
  firstName: string
  lastName: string
  year: number
  sequence: number
}): string {
  const { schoolSigle, firstName, lastName, year, sequence } = params
  const initials = `${lastName.charAt(0).toUpperCase()}${firstName.charAt(0).toUpperCase()}`
  const seq = String(sequence).padStart(4, '0')
  return `${schoolSigle.toUpperCase()}${initials}-${year}-${seq}`
}
```

- [ ] **Créer `packages/shared/src/utils/date.utils.ts`**

```typescript
export function formatReceiptNo(date: Date, sequence: number): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const seq = String(sequence).padStart(3, '0')
  return `REC-${month}-${year}-${seq}`
}

export function isTempPasswordExpired(createdAt: Date): boolean {
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  return diffHours > 24
}
```

- [ ] **Créer `packages/shared/src/index.ts`**

```typescript
export * from './types/user.types'
export * from './types/student.types'
export * from './types/grade.types'
export * from './types/payment.types'
export * from './types/api.types'
export * from './utils/grade.utils'
export * from './utils/matricule.utils'
export * from './utils/date.utils'
```

- [ ] **Vérifier la compilation**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\packages\shared"
npx tsc --noEmit
```
Résultat attendu : aucune erreur.

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add packages/shared
git commit -m "feat: add @sgsi/shared types and utils"
```

---

## Task 3 : packages/db — Schéma Prisma

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/.env`
- Create: `packages/db/prisma/schema.prisma`
- Create: `packages/db/src/client.ts`

- [ ] **Créer `packages/db/package.json`**

```json
{
  "name": "@sgsi/db",
  "version": "1.0.0",
  "main": "src/client.ts",
  "scripts": {
    "generate": "prisma generate",
    "migrate": "prisma migrate dev --name init",
    "migrate:deploy": "prisma migrate deploy",
    "studio": "prisma studio",
    "seed": "ts-node --project tsconfig.json src/seed.ts",
    "push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0"
  },
  "devDependencies": {
    "prisma": "^5.14.0",
    "typescript": "^5.4.0",
    "ts-node": "^10.9.2",
    "@types/node": "^20.14.0"
  }
}
```

- [ ] **Créer `packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "module": "CommonJS"
  },
  "include": ["src"]
}
```

- [ ] **Créer `packages/db/.env`**

```
DATABASE_URL="file:./prisma/sgsi.db"
```

- [ ] **Créer `packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

model School {
  id                   String  @id @default(cuid())
  name                 String
  logo                 String?
  address              String?
  phone                String?
  email                String?
  directorName         String?
  stamp                String?
  currency             String  @default("GNF")
  language             String  @default("fr")
  sigle                String  @default("ECO")
  jwtSecret            String  @default("")
  eliminatoryThreshold Float   @default(5.0)
  passingAverage       Float   @default(10.0)
  periodType           String  @default("TRIMESTER")
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model AcademicYear {
  id          String       @id @default(cuid())
  label       String
  startDate   DateTime
  endDate     DateTime
  isCurrent   Boolean      @default(false)
  periodType  String       @default("TRIMESTER")
  classes     Class[]
  enrollments Enrollment[]
}

model License {
  id          String    @id @default(cuid())
  key         String    @unique
  schoolName  String
  issuedAt    DateTime  @default(now())
  expiresAt   DateTime?
  isActive    Boolean   @default(true)
  maxStudents Int       @default(500)
  plan        String    @default("STANDARD")
}

// ─── UTILISATEURS ──────────────────────────────────────────────────────────────

model User {
  id                 String     @id @default(cuid())
  username           String     @unique
  password           String
  role               String
  firstName          String
  lastName           String
  phone              String?
  email              String?
  isActive           Boolean    @default(true)
  mustChangePassword Boolean    @default(false)
  tempPasswordExpiry DateTime?
  lastLogin          DateTime?
  createdAt          DateTime   @default(now())
  auditLogs          AuditLog[]
  teacher            Teacher?
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  action    String
  entity    String
  entityId  String?
  details   String?
  createdAt DateTime @default(now())
}

// ─── STRUCTURE SCOLAIRE ────────────────────────────────────────────────────────

model Level {
  id       String    @id @default(cuid())
  name     String
  order    Int
  classes  Class[]
  feeTypes FeeType[]
}

model Class {
  id             String       @id @default(cuid())
  name           String
  levelId        String
  level          Level        @relation(fields: [levelId], references: [id])
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  maxStudents    Int          @default(40)
  teacherId      String?
  teacher        Teacher?     @relation(fields: [teacherId], references: [id])
  enrollments    Enrollment[]
  schedules      Schedule[]
  subjects       ClassSubject[]
}

model Subject {
  id       String         @id @default(cuid())
  name     String
  code     String         @unique
  classes  ClassSubject[]
  grades   Grade[]
}

model ClassSubject {
  id           String   @id @default(cuid())
  classId      String
  class        Class    @relation(fields: [classId], references: [id])
  subjectId    String
  subject      Subject  @relation(fields: [subjectId], references: [id])
  coefficient  Float    @default(1)
  hoursPerWeek Int      @default(2)
  teacherId    String?
  teacher      Teacher? @relation(fields: [teacherId], references: [id])
}

// ─── ÉLÈVES ────────────────────────────────────────────────────────────────────

model Student {
  id            String            @id @default(cuid())
  matricule     String            @unique
  firstName     String
  lastName      String
  gender        String
  birthDate     DateTime
  birthPlace    String?
  nationality   String?
  address       String?
  phone         String?
  email         String?
  photo         String?
  createdAt     DateTime          @default(now())
  enrollments   Enrollment[]
  parents       StudentParent[]
  documents     StudentDocument[]
  medicalRecord MedicalRecord?
}

model Enrollment {
  id             String        @id @default(cuid())
  studentId      String
  student        Student       @relation(fields: [studentId], references: [id])
  classId        String
  class          Class         @relation(fields: [classId], references: [id])
  academicYearId String
  academicYear   AcademicYear  @relation(fields: [academicYearId], references: [id])
  status         String        @default("ACTIVE")
  enrolledAt     DateTime      @default(now())
  grades         Grade[]
  absences       Absence[]
  bulletins      Bulletin[]
  payments       Payment[]
}

model StudentDocument {
  id         String   @id @default(cuid())
  studentId  String
  student    Student  @relation(fields: [studentId], references: [id])
  type       String
  filePath   String
  uploadedAt DateTime @default(now())
}

// ─── PARENTS ──────────────────────────────────────────────────────────────────

model Parent {
  id         String          @id @default(cuid())
  firstName  String
  lastName   String
  relation   String
  phone      String
  phone2     String?
  address    String?
  profession String?
  email      String?
  accessCode String?         @unique
  students   StudentParent[]
}

model StudentParent {
  studentId String
  parentId  String
  student   Student @relation(fields: [studentId], references: [id])
  parent    Parent  @relation(fields: [parentId], references: [id])

  @@id([studentId, parentId])
}

// ─── ENSEIGNANTS ──────────────────────────────────────────────────────────────

model Teacher {
  id           String         @id @default(cuid())
  matricule    String         @unique
  userId       String         @unique
  user         User           @relation(fields: [userId], references: [id])
  diploma      String?
  hireDate     DateTime?
  contractType String?
  baseSalary   Float          @default(0)
  hoursPerWeek Int            @default(0)
  subjects     ClassSubject[]
  homeClasses  Class[]
  schedules    Schedule[]
  salaries     Salary[]
}

// ─── NOTES ────────────────────────────────────────────────────────────────────

model Grade {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  subjectId    String
  subject      Subject    @relation(fields: [subjectId], references: [id])
  period       Int
  evalType     String
  value        Float
  maxValue     Float      @default(20)
  weight       Float      @default(1)
  isLocked     Boolean    @default(false)
  enteredAt    DateTime   @default(now())
}

model Bulletin {
  id             String     @id @default(cuid())
  enrollmentId   String
  enrollment     Enrollment @relation(fields: [enrollmentId], references: [id])
  period         Int
  generalAverage Float
  rank           Int
  totalStudents  Int
  appreciation   String?
  decision       String?
  isValidated    Boolean    @default(false)
  validatedAt    DateTime?
  pdfPath        String?
  createdAt      DateTime   @default(now())
}

// ─── ABSENCES ─────────────────────────────────────────────────────────────────

model Absence {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  date         DateTime
  type         String
  justified    Boolean    @default(false)
  reason       String?
  justifFile   String?
  recordedAt   DateTime   @default(now())
}

// ─── EMPLOI DU TEMPS ──────────────────────────────────────────────────────────

model Room {
  id        String     @id @default(cuid())
  name      String     @unique
  capacity  Int
  schedules Schedule[]
}

model Schedule {
  id          String   @id @default(cuid())
  classId     String
  class       Class    @relation(fields: [classId], references: [id])
  teacherId   String
  teacher     Teacher  @relation(fields: [teacherId], references: [id])
  roomId      String?
  room        Room?    @relation(fields: [roomId], references: [id])
  dayOfWeek   Int
  startTime   String
  endTime     String
  subjectName String
}

// ─── FINANCES ─────────────────────────────────────────────────────────────────

model FeeType {
  id         String    @id @default(cuid())
  name       String
  amount     Float
  levelId    String?
  level      Level?    @relation(fields: [levelId], references: [id])
  isRequired Boolean   @default(true)
  payments   Payment[]
}

model Payment {
  id             String                @id @default(cuid())
  enrollmentId   String
  enrollment     Enrollment            @relation(fields: [enrollmentId], references: [id])
  feeTypeId      String
  feeType        FeeType               @relation(fields: [feeTypeId], references: [id])
  amount         Float
  method         String
  receiptNo      String                @unique
  cashierId      String
  note           String?
  paidAt         DateTime              @default(now())
  installments   PaymentInstallment[]
}

model PaymentInstallment {
  id          String    @id @default(cuid())
  paymentId   String
  payment     Payment   @relation(fields: [paymentId], references: [id])
  dueDate     DateTime
  amount      Float
  paidAt      DateTime?
  isPaid      Boolean   @default(false)
}

model Expense {
  id          String   @id @default(cuid())
  label       String
  amount      Float
  category    String
  receiptFile String?
  recordedBy  String
  doneAt      DateTime @default(now())
}

model CashRegister {
  id           String    @id @default(cuid())
  date         DateTime  @unique
  openBalance  Float
  closeBalance Float?
  openedBy     String
  closedBy     String?
  isClosed     Boolean   @default(false)
}

// ─── PAIE ─────────────────────────────────────────────────────────────────────

model Salary {
  id         String    @id @default(cuid())
  teacherId  String
  teacher    Teacher   @relation(fields: [teacherId], references: [id])
  month      Int
  year       Int
  baseSalary Float
  bonuses    Float     @default(0)
  advances   Float     @default(0)
  deductions Float     @default(0)
  netSalary  Float
  pdfPath    String?
  paidAt     DateTime?

  @@unique([teacherId, month, year])
}

// ─── BIBLIOTHÈQUE ─────────────────────────────────────────────────────────────

model Book {
  id        String     @id @default(cuid())
  title     String
  author    String?
  isbn      String?    @unique
  category  String?
  copies    Int        @default(1)
  available Int        @default(1)
  loans     BookLoan[]
}

model BookLoan {
  id         String    @id @default(cuid())
  bookId     String
  book       Book      @relation(fields: [bookId], references: [id])
  studentId  String
  borrowedAt DateTime  @default(now())
  dueDate    DateTime
  returnedAt DateTime?
  fine       Float     @default(0)
}

// ─── MÉDICAL ──────────────────────────────────────────────────────────────────

model MedicalRecord {
  id               String         @id @default(cuid())
  studentId        String         @unique
  student          Student        @relation(fields: [studentId], references: [id])
  bloodType        String?
  allergies        String?
  conditions       String?
  emergencyContact String?
  consultations    Consultation[]
}

model Consultation {
  id              String        @id @default(cuid())
  medicalRecordId String
  medicalRecord   MedicalRecord @relation(fields: [medicalRecordId], references: [id])
  date            DateTime      @default(now())
  reason          String
  treatment       String?
  notes           String?
}

// ─── TRANSPORT ────────────────────────────────────────────────────────────────

model Bus {
  id          String  @id @default(cuid())
  plate       String  @unique
  capacity    Int
  driver      String
  driverPhone String?
  routes      Route[]
}

model Route {
  id    String @id @default(cuid())
  busId String
  bus   Bus    @relation(fields: [busId], references: [id])
  name  String
  stops String
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

model Notification {
  id        String   @id @default(cuid())
  target    String
  title     String
  body      String
  type      String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

- [ ] **Créer `packages/db/src/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | undefined

export function getDb(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }
  return prisma
}

export async function closeDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = undefined
  }
}

export type { PrismaClient }
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add packages/db
git commit -m "feat: add @sgsi/db prisma schema (33 models)"
```

---

## Task 4 : Installer les dépendances et migrer la base

- [ ] **Installer toutes les dépendances depuis la racine**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
npm install
```
Résultat attendu : `added XXX packages` sans erreur.

- [ ] **Générer le client Prisma**

```bash
npm run db:generate
```
Résultat attendu : `Generated Prisma Client` dans `packages/db/node_modules/.prisma/client`

- [ ] **Créer la migration initiale**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\packages\db"
npx prisma migrate dev --name init
```
Résultat attendu :
```
Applying migration `20260612_init`
Your database is now in sync with your schema.
```

- [ ] **Vérifier que la base existe**

```bash
dir "C:\Users\LambertMILLIMONO\Desktop\SGSI\packages\db\prisma\sgsi.db"
```
Résultat attendu : fichier `sgsi.db` visible.

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add packages/db/prisma/migrations
git commit -m "feat: add initial prisma migration"
```

---

## Task 5 : Seed — données de démo

**Files:**
- Create: `packages/db/src/seed.ts`

- [ ] **Créer `packages/db/src/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding SGSI demo data...')

  // École
  const school = await prisma.school.upsert({
    where: { id: 'school-demo' },
    update: {},
    create: {
      id: 'school-demo',
      name: 'École Démo SGSI',
      sigle: 'DEMO',
      currency: 'GNF',
      language: 'fr',
      jwtSecret: 'demo-secret-change-in-production',
      eliminatoryThreshold: 5.0,
      passingAverage: 10.0,
      periodType: 'TRIMESTER',
    },
  })

  // Année scolaire
  const year = await prisma.academicYear.upsert({
    where: { id: 'year-2025-2026' },
    update: {},
    create: {
      id: 'year-2025-2026',
      label: '2025-2026',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: true,
      periodType: 'TRIMESTER',
    },
  })

  // Licence démo
  await prisma.license.upsert({
    where: { key: 'DEMO-SGSI-0000-0000' },
    update: {},
    create: {
      key: 'DEMO-SGSI-0000-0000',
      schoolName: 'École Démo SGSI',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 jours
      plan: 'DEMO',
      maxStudents: 50,
    },
  })

  // Super Admin
  const hashedPassword = await bcrypt.hash('Admin@1234', 12)
  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Administrateur',
      mustChangePassword: true,
    },
  })

  // Niveaux
  const primaire = await prisma.level.upsert({
    where: { id: 'level-primaire' },
    update: {},
    create: { id: 'level-primaire', name: 'Primaire', order: 1 },
  })
  const college = await prisma.level.upsert({
    where: { id: 'level-college' },
    update: {},
    create: { id: 'level-college', name: 'Collège', order: 2 },
  })
  const lycee = await prisma.level.upsert({
    where: { id: 'level-lycee' },
    update: {},
    create: { id: 'level-lycee', name: 'Lycée', order: 3 },
  })

  // Classes
  const ce2 = await prisma.class.upsert({
    where: { id: 'class-ce2' },
    update: {},
    create: {
      id: 'class-ce2',
      name: 'CE2',
      levelId: primaire.id,
      academicYearId: year.id,
      maxStudents: 35,
    },
  })
  const classe6e = await prisma.class.upsert({
    where: { id: 'class-6e' },
    update: {},
    create: {
      id: 'class-6e',
      name: '6ème A',
      levelId: college.id,
      academicYearId: year.id,
      maxStudents: 40,
    },
  })

  // Matières
  const math = await prisma.subject.upsert({
    where: { code: 'MATH' },
    update: {},
    create: { code: 'MATH', name: 'Mathématiques' },
  })
  const francais = await prisma.subject.upsert({
    where: { code: 'FR' },
    update: {},
    create: { code: 'FR', name: 'Français' },
  })
  const svt = await prisma.subject.upsert({
    where: { code: 'SVT' },
    update: {},
    create: { code: 'SVT', name: 'SVT' },
  })

  // Association matières ↔ classes
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-math' },
    update: {},
    create: { id: 'cs-6e-math', classId: classe6e.id, subjectId: math.id, coefficient: 3 },
  })
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-fr' },
    update: {},
    create: { id: 'cs-6e-fr', classId: classe6e.id, subjectId: francais.id, coefficient: 3 },
  })
  await prisma.classSubject.upsert({
    where: { id: 'cs-6e-svt' },
    update: {},
    create: { id: 'cs-6e-svt', classId: classe6e.id, subjectId: svt.id, coefficient: 2 },
  })

  // 3 élèves démo
  const students = [
    { id: 'stu-001', firstName: 'Amadou', lastName: 'Bah', gender: 'MALE', matricule: 'DEMOAB-2025-0001' },
    { id: 'stu-002', firstName: 'Fatoumata', lastName: 'Diallo', gender: 'FEMALE', matricule: 'DEMOFD-2025-0002' },
    { id: 'stu-003', firstName: 'Ibrahima', lastName: 'Camara', gender: 'MALE', matricule: 'DEMOIC-2025-0003' },
  ]

  for (const s of students) {
    await prisma.student.upsert({
      where: { matricule: s.matricule },
      update: {},
      create: {
        ...s,
        birthDate: new Date('2010-01-01'),
        nationality: 'Guinéenne',
      },
    })
    await prisma.enrollment.upsert({
      where: { id: `enroll-${s.id}` },
      update: {},
      create: {
        id: `enroll-${s.id}`,
        studentId: s.id,
        classId: classe6e.id,
        academicYearId: year.id,
      },
    })
  }

  // Frais scolaires
  await prisma.feeType.upsert({
    where: { id: 'fee-inscription' },
    update: {},
    create: {
      id: 'fee-inscription',
      name: 'Frais d\'inscription',
      amount: 500000,
      levelId: college.id,
      isRequired: true,
    },
  })
  await prisma.feeType.upsert({
    where: { id: 'fee-scolarite' },
    update: {},
    create: {
      id: 'fee-scolarite',
      name: 'Scolarité trimestrielle',
      amount: 1500000,
      levelId: college.id,
      isRequired: true,
    },
  })

  console.log('✅ Seed terminé avec succès')
  console.log('👤 Connexion admin: username=admin / password=Admin@1234')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
```

- [ ] **Ajouter bcryptjs à packages/db**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\packages\db"
npm install bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Exécuter le seed**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
npm run db:seed
```
Résultat attendu :
```
🌱 Seeding SGSI demo data...
✅ Seed terminé avec succès
👤 Connexion admin: username=admin / password=Admin@1234
```

- [ ] **Vérifier avec Prisma Studio**

```bash
npm run db:studio
```
Ouvrir http://localhost:5555 — vérifier que School, User, Level, Class, Student ont des données.

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add packages/db/src/seed.ts packages/db/package.json packages/db/package-lock.json
git commit -m "feat: add demo seed data"
```

---

## Task 6 : apps/desktop — Squelette Electron + configuration

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/electron.vite.config.ts`
- Create: `apps/desktop/.env`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/main/database/client.ts`

- [ ] **Créer `apps/desktop/package.json`**

```json
{
  "name": "@sgsi/desktop",
  "version": "1.0.0",
  "description": "SGSI — Le numérique au service de l'éducation",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@sgsi/db": "*",
    "@sgsi/shared": "*",
    "@prisma/client": "^5.14.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "archiver": "^7.0.1"
  },
  "devDependencies": {
    "electron": "^31.0.0",
    "electron-vite": "^2.3.0",
    "vite": "^5.3.0",
    "typescript": "^5.4.0",
    "@types/node": "^20.14.0",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/archiver": "^6.0.2",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Créer `apps/desktop/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@sgsi/shared": ["../../packages/shared/src/index.ts"],
      "@sgsi/db": ["../../packages/db/src/client.ts"]
    }
  },
  "include": ["src", "electron.vite.config.ts"]
}
```

- [ ] **Créer `apps/desktop/electron.vite.config.ts`**

```typescript
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@sgsi/shared': resolve('../../packages/shared/src/index.ts'),
        '@sgsi/db': resolve('../../packages/db/src/client.ts'),
      },
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') },
      },
    },
  },
  renderer: {},
})
```

- [ ] **Créer `apps/desktop/.env`**

```
EXPRESS_PORT=3721
NODE_ENV=development
DATABASE_URL=file:../../packages/db/prisma/sgsi.db
```

- [ ] **Créer `apps/desktop/src/main/database/client.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import path from 'path'
import { app } from 'electron'

let _prisma: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!_prisma) {
    const dbPath = process.env.NODE_ENV === 'development'
      ? path.resolve(__dirname, '../../../../packages/db/prisma/sgsi.db')
      : path.join(app.getPath('userData'), 'sgsi.db')

    _prisma = new PrismaClient({
      datasources: { db: { url: `file:${dbPath}` } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }
  return _prisma
}

export async function closeDb(): Promise<void> {
  if (_prisma) {
    await _prisma.$disconnect()
    _prisma = null
  }
}
```

- [ ] **Créer `apps/desktop/src/main/index.ts`**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { getDb, closeDb } from './database/client'
import { registerIpcHandlers } from './ipc'
import { startExpressServer, stopExpressServer } from './server'

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'SGSI — Le numérique au service de l\'éducation',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Phase 2 : charger l'interface React
  // Pour Phase 1, charger une page blanche
  mainWindow.loadURL('about:blank')
}

app.whenReady().then(async () => {
  const db = getDb()
  registerIpcHandlers(db)
  await startExpressServer(db)
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  stopExpressServer()
  await closeDb()
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **Installer les dépendances desktop**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
npm install
```

- [ ] **Commit**

```bash
git add apps/desktop
git commit -m "feat: add electron desktop skeleton"
```

---

## Task 7 : AuthService (TDD)

**Files:**
- Create: `apps/desktop/src/main/services/auth.service.ts`
- Test: `apps/desktop/src/main/services/__tests__/auth.service.test.ts`

- [ ] **Créer `apps/desktop/src/main/services/__tests__/auth.service.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { AuthService } from '../auth.service'

let prisma: PrismaClient
let authService: AuthService

beforeAll(async () => {
  process.env.DATABASE_URL = 'file:./test-auth.db'
  prisma = new PrismaClient()
  await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL')

  // Seed user de test
  const hash = await bcrypt.hash('password123', 4)
  await prisma.user.upsert({
    where: { username: 'testuser' },
    update: {},
    create: {
      username: 'testuser',
      password: hash,
      role: 'SECRETARY',
      firstName: 'Test',
      lastName: 'User',
    },
  })

  authService = new AuthService(prisma, 'test-jwt-secret')
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: 'testuser' } })
  await prisma.$disconnect()
})

describe('AuthService', () => {
  it('login retourne un token JWT valide', async () => {
    const result = await authService.login('testuser', 'password123')
    expect(result.token).toBeDefined()
    expect(result.user.username).toBe('testuser')
    expect(result.user.role).toBe('SECRETARY')
  })

  it('login échoue avec mauvais mot de passe', async () => {
    await expect(authService.login('testuser', 'mauvais')).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('login échoue avec utilisateur inconnu', async () => {
    await expect(authService.login('inconnu', 'password')).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('verifyToken retourne le payload du token', async () => {
    const { token } = await authService.login('testuser', 'password123')
    const payload = authService.verifyToken(token)
    expect(payload.username).toBe('testuser')
    expect(payload.role).toBe('SECRETARY')
  })

  it('verifyToken lève une erreur pour token invalide', () => {
    expect(() => authService.verifyToken('token-bidon')).toThrow()
  })
})
```

- [ ] **Exécuter le test — vérifier qu'il échoue**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\apps\desktop"
npx vitest run src/main/services/__tests__/auth.service.test.ts
```
Résultat attendu : FAIL avec `Cannot find module '../auth.service'`

- [ ] **Créer `apps/desktop/src/main/services/auth.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { TokenPayload } from '@sgsi/shared'
import { ServiceError } from '@sgsi/shared'

export class AuthService {
  constructor(private db: PrismaClient, private jwtSecret: string) {}

  async login(username: string, password: string): Promise<{ token: string; user: { id: string; username: string; role: string; firstName: string; lastName: string } }> {
    const user = await this.db.user.findUnique({ where: { username } })
    if (!user || !user.isActive) throw new ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides')

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) throw new ServiceError('INVALID_CREDENTIALS', 'Identifiants invalides')

    await this.db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })
    await this.db.auditLog.create({
      data: { userId: user.id, action: 'LOGIN', entity: 'user', entityId: user.id },
    })

    const payload: Omit<TokenPayload, 'iat' | 'exp'> = { userId: user.id, username: user.username, role: user.role as any }
    const token = jwt.sign(payload, this.jwtSecret, { expiresIn: '8h' })

    return { token, user: { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName } }
  }

  verifyToken(token: string): TokenPayload {
    return jwt.verify(token, this.jwtSecret) as TokenPayload
  }

  async requestPasswordReset(userId: string, requestedBy: string): Promise<string> {
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase()
    const hashed = await bcrypt.hash(tempPassword, 12)
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await this.db.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: true, tempPasswordExpiry: expiry },
    })
    await this.db.auditLog.create({
      data: { userId: requestedBy, action: 'PASSWORD_RESET_REQUEST', entity: 'user', entityId: userId },
    })
    return tempPassword
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 12)
    await this.db.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false, tempPasswordExpiry: null },
    })
  }

  async checkPermission(userId: string, module: string, action: string): Promise<boolean> {
    const user = await this.db.user.findUnique({ where: { id: userId } })
    if (!user) return false
    if (user.role === 'SUPER_ADMIN') return true
    const { ROLE_PERMISSIONS } = await import('@sgsi/shared')
    const perms = ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? []
    return perms.some(p => (p.module === module || p.module === '*') && (p.actions as string[]).includes(action))
  }
}
```

- [ ] **Exécuter les tests — vérifier qu'ils passent**

```bash
npx vitest run src/main/services/__tests__/auth.service.test.ts
```
Résultat attendu : `5 tests passed`

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/services/
git commit -m "feat: add AuthService with JWT + bcrypt (TDD)"
```

---

## Task 8 : StudentService + ClassService (TDD)

**Files:**
- Create: `apps/desktop/src/main/services/student.service.ts`
- Create: `apps/desktop/src/main/services/class.service.ts`
- Test: `apps/desktop/src/main/services/__tests__/student.service.test.ts`

- [ ] **Créer le test `student.service.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { StudentService } from '../student.service'

let prisma: PrismaClient
let studentService: StudentService
const ACTOR_ID = 'actor-test'

beforeAll(async () => {
  process.env.DATABASE_URL = 'file:./test-student.db'
  prisma = new PrismaClient()
  // Créer un user acteur
  await prisma.user.upsert({
    where: { id: ACTOR_ID },
    update: {},
    create: { id: ACTOR_ID, username: 'actor', password: 'x', role: 'SECRETARY', firstName: 'A', lastName: 'B' },
  })
  await prisma.school.upsert({
    where: { id: 'school-test' },
    update: {},
    create: { id: 'school-test', name: 'Test', sigle: 'TST', jwtSecret: 'x' },
  })
  studentService = new StudentService(prisma)
})

afterAll(async () => {
  await prisma.student.deleteMany()
  await prisma.$disconnect()
})

describe('StudentService', () => {
  it('crée un élève avec un matricule unique', async () => {
    const student = await studentService.create({
      firstName: 'Ibrahima',
      lastName: 'Barry',
      gender: 'MALE',
      birthDate: new Date('2010-05-15'),
    }, ACTOR_ID)

    expect(student.matricule).toMatch(/^TST/)
    expect(student.firstName).toBe('Ibrahima')
  })

  it('liste les élèves', async () => {
    const list = await studentService.list()
    expect(list.length).toBeGreaterThan(0)
  })

  it('retrouve un élève par id', async () => {
    const all = await studentService.list()
    const found = await studentService.findById(all[0].id)
    expect(found.id).toBe(all[0].id)
  })

  it('lève une erreur pour un id inexistant', async () => {
    await expect(studentService.findById('id-inexistant')).rejects.toThrow('STUDENT_NOT_FOUND')
  })
})
```

- [ ] **Exécuter — vérifier FAIL**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\apps\desktop"
npx vitest run src/main/services/__tests__/student.service.test.ts
```
Résultat attendu : FAIL `Cannot find module '../student.service'`

- [ ] **Créer `apps/desktop/src/main/services/student.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'
import { generateMatricule } from '@sgsi/shared'
import type { CreateStudentInput } from '@sgsi/shared'

export class StudentService {
  constructor(private db: PrismaClient) {}

  async list(filters?: { classId?: string; search?: string }) {
    return this.db.student.findMany({
      where: {
        ...(filters?.search && {
          OR: [
            { firstName: { contains: filters.search } },
            { lastName: { contains: filters.search } },
            { matricule: { contains: filters.search } },
          ],
        }),
        ...(filters?.classId && {
          enrollments: { some: { classId: filters.classId } },
        }),
      },
      orderBy: { lastName: 'asc' },
    })
  }

  async findById(id: string) {
    const student = await this.db.student.findUnique({ where: { id } })
    if (!student) throw new ServiceError('STUDENT_NOT_FOUND', `Élève ${id} introuvable`)
    return student
  }

  async create(data: CreateStudentInput, actorId: string) {
    const school = await this.db.school.findFirst()
    if (!school) throw new ServiceError('SCHOOL_NOT_CONFIGURED', 'École non configurée')

    const year = new Date().getFullYear()
    const count = await this.db.student.count()
    const matricule = generateMatricule({
      schoolSigle: school.sigle,
      firstName: data.firstName,
      lastName: data.lastName,
      year,
      sequence: count + 1,
    })

    const student = await this.db.student.create({ data: { ...data, matricule } })

    await this.db.auditLog.create({
      data: { userId: actorId, action: 'CREATE', entity: 'student', entityId: student.id },
    })
    return student
  }

  async update(id: string, data: Partial<CreateStudentInput>, actorId: string) {
    await this.findById(id)
    const student = await this.db.student.update({ where: { id }, data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'UPDATE', entity: 'student', entityId: id },
    })
    return student
  }

  async delete(id: string, actorId: string) {
    await this.findById(id)
    await this.db.student.delete({ where: { id } })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'DELETE', entity: 'student', entityId: id },
    })
  }

  async enroll(studentId: string, classId: string, academicYearId: string, actorId: string) {
    await this.findById(studentId)
    const enrollment = await this.db.enrollment.create({
      data: { studentId, classId, academicYearId },
    })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'ENROLL', entity: 'enrollment', entityId: enrollment.id },
    })
    return enrollment
  }
}
```

- [ ] **Créer `apps/desktop/src/main/services/class.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'

export class ClassService {
  constructor(private db: PrismaClient) {}

  async listLevels() {
    return this.db.level.findMany({ orderBy: { order: 'asc' } })
  }

  async createLevel(data: { name: string; order: number }, actorId: string) {
    const level = await this.db.level.create({ data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'CREATE', entity: 'level', entityId: level.id },
    })
    return level
  }

  async listClasses(academicYearId?: string) {
    return this.db.class.findMany({
      where: academicYearId ? { academicYearId } : undefined,
      include: { level: true, _count: { select: { enrollments: true } } },
      orderBy: { name: 'asc' },
    })
  }

  async createClass(data: { name: string; levelId: string; academicYearId: string; maxStudents?: number }, actorId: string) {
    const cls = await this.db.class.create({ data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'CREATE', entity: 'class', entityId: cls.id },
    })
    return cls
  }

  async findClassById(id: string) {
    const cls = await this.db.class.findUnique({ where: { id }, include: { level: true, subjects: { include: { subject: true } } } })
    if (!cls) throw new ServiceError('CLASS_NOT_FOUND', `Classe ${id} introuvable`)
    return cls
  }
}
```

- [ ] **Exécuter les tests — vérifier PASS**

```bash
npx vitest run src/main/services/__tests__/student.service.test.ts
```
Résultat attendu : `4 tests passed`

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/services/
git commit -m "feat: add StudentService and ClassService (TDD)"
```

---

## Task 9 : GradeService (TDD)

**Files:**
- Create: `apps/desktop/src/main/services/grade.service.ts`
- Test: `apps/desktop/src/main/services/__tests__/grade.service.test.ts`

- [ ] **Créer `__tests__/grade.service.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { calcSubjectAverage, calcGeneralAverage, DEFAULT_EVAL_WEIGHTS } from '@sgsi/shared'

describe('Grade calculations', () => {
  it('calcule la moyenne pondérée d\'une matière', () => {
    const grades = [
      { evalType: 'INTERROGATION' as const, value: 12, weight: 1, maxValue: 20 },
      { evalType: 'DEVOIR' as const, value: 14, weight: 1, maxValue: 20 },
      { evalType: 'EXAM' as const, value: 16, weight: 1, maxValue: 20 },
    ]
    const avg = calcSubjectAverage(grades as any, DEFAULT_EVAL_WEIGHTS)
    // (12*1 + 14*2 + 16*3) / (1+2+3) = (12+28+48)/6 = 88/6 = 14.67
    expect(avg).toBe(14.67)
  })

  it('retourne 0 si pas de notes', () => {
    expect(calcSubjectAverage([], DEFAULT_EVAL_WEIGHTS)).toBe(0)
  })

  it('calcule la moyenne générale pondérée par coefficients', () => {
    const subjectAvgs = [
      { subjectId: '1', subjectName: 'Math', coefficient: 3, average: 14, grades: [] },
      { subjectId: '2', subjectName: 'Français', coefficient: 3, average: 12, grades: [] },
      { subjectId: '3', subjectName: 'SVT', coefficient: 2, average: 16, grades: [] },
    ]
    const gen = calcGeneralAverage(subjectAvgs)
    // (14*3 + 12*3 + 16*2) / (3+3+2) = (42+36+32)/8 = 110/8 = 13.75
    expect(gen).toBe(13.75)
  })
})
```

- [ ] **Exécuter — vérifier PASS** (les utils sont déjà implémentés)

```bash
npx vitest run src/main/services/__tests__/grade.service.test.ts
```
Résultat attendu : `3 tests passed`

- [ ] **Créer `apps/desktop/src/main/services/grade.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { ServiceError, calcSubjectAverage, calcGeneralAverage, calcRankings, DEFAULT_EVAL_WEIGHTS } from '@sgsi/shared'
import type { EvalWeights } from '@sgsi/shared'

export class GradeService {
  constructor(private db: PrismaClient) {}

  async listByEnrollment(enrollmentId: string, period: number) {
    return this.db.grade.findMany({
      where: { enrollmentId, period },
      include: { subject: true },
    })
  }

  async save(data: { enrollmentId: string; subjectId: string; period: number; evalType: string; value: number; maxValue?: number }, actorId: string) {
    if (data.value < 0 || data.value > (data.maxValue ?? 20)) {
      throw new ServiceError('INVALID_GRADE', `Note invalide : ${data.value}`)
    }
    const grade = await this.db.grade.create({ data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'GRADE_SAVED', entity: 'grade', entityId: grade.id },
    })
    return grade
  }

  async computeAverages(enrollmentId: string, period: number, weights: EvalWeights = DEFAULT_EVAL_WEIGHTS) {
    const enrollment = await this.db.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { class: { include: { subjects: { include: { subject: true } } } } },
    })
    if (!enrollment) throw new ServiceError('ENROLLMENT_NOT_FOUND', 'Inscription introuvable')

    const grades = await this.listByEnrollment(enrollmentId, period)
    const school = await this.db.school.findFirst()
    const eliminatoryThreshold = school?.eliminatoryThreshold ?? 5

    const subjectAverages = enrollment.class.subjects.map(cs => {
      const subjectGrades = grades.filter(g => g.subjectId === cs.subjectId)
      const average = calcSubjectAverage(subjectGrades as any, weights)
      return { subjectId: cs.subjectId, subjectName: cs.subject.name, coefficient: cs.coefficient, average, grades: subjectGrades }
    })

    const generalAverage = calcGeneralAverage(subjectAverages)
    const isEliminated = subjectAverages.some(s => s.average < eliminatoryThreshold)

    return { subjectAverages, generalAverage, isEliminated }
  }

  async computeClassRankings(classId: string, period: number) {
    const enrollments = await this.db.enrollment.findMany({
      where: { classId },
      include: { student: true },
    })

    const averages = await Promise.all(enrollments.map(async e => {
      const { generalAverage, isEliminated } = await this.computeAverages(e.id, period)
      return { enrollmentId: e.id, studentId: e.studentId, studentName: `${e.student.firstName} ${e.student.lastName}`, generalAverage, isEliminated }
    }))

    return calcRankings(averages)
  }

  async lockGrades(enrollmentId: string, period: number, actorId: string) {
    await this.db.grade.updateMany({ where: { enrollmentId, period }, data: { isLocked: true } })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'GRADES_LOCKED', entity: 'enrollment', entityId: enrollmentId, details: `period:${period}` },
    })
  }
}
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/services/grade.service.ts apps/desktop/src/main/services/__tests__/grade.service.test.ts
git commit -m "feat: add GradeService with average calculations (TDD)"
```

---

## Task 10 : PaymentService + AuditService + BackupService

**Files:**
- Create: `apps/desktop/src/main/services/payment.service.ts`
- Create: `apps/desktop/src/main/services/audit.service.ts`
- Create: `apps/desktop/src/main/services/backup.service.ts`

- [ ] **Créer `apps/desktop/src/main/services/payment.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { ServiceError } from '@sgsi/shared'
import { formatReceiptNo } from '@sgsi/shared'
import type { PayMethod } from '@sgsi/shared'

export class PaymentService {
  constructor(private db: PrismaClient) {}

  async listByEnrollment(enrollmentId: string) {
    return this.db.payment.findMany({
      where: { enrollmentId },
      include: { feeType: true },
      orderBy: { paidAt: 'desc' },
    })
  }

  async record(data: { enrollmentId: string; feeTypeId: string; amount: number; method: PayMethod; note?: string }, cashierId: string) {
    const now = new Date()
    const count = await this.db.payment.count()
    const receiptNo = formatReceiptNo(now, count + 1)

    const payment = await this.db.payment.create({
      data: { ...data, receiptNo, cashierId, paidAt: now },
      include: { feeType: true },
    })
    await this.db.auditLog.create({
      data: { userId: cashierId, action: 'PAYMENT_RECORDED', entity: 'payment', entityId: payment.id, details: `amount:${data.amount}` },
    })
    return payment
  }

  async listUnpaid(classId?: string) {
    const enrollments = await this.db.enrollment.findMany({
      where: classId ? { classId } : undefined,
      include: {
        student: true,
        class: { include: { level: true } },
        payments: { include: { feeType: true } },
      },
    })

    return enrollments.map(e => {
      const totalPaid = e.payments.reduce((sum, p) => sum + p.amount, 0)
      return {
        studentId: e.studentId,
        studentName: `${e.student.firstName} ${e.student.lastName}`,
        matricule: e.student.matricule,
        className: e.class.name,
        totalPaid,
        balance: totalPaid,
      }
    }).filter(e => e.balance >= 0)
  }

  async listFeeTypes(levelId?: string) {
    return this.db.feeType.findMany({
      where: levelId ? { levelId } : undefined,
    })
  }

  async createFeeType(data: { name: string; amount: number; levelId?: string; isRequired?: boolean }, actorId: string) {
    const feeType = await this.db.feeType.create({ data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'CREATE', entity: 'feeType', entityId: feeType.id },
    })
    return feeType
  }
}
```

- [ ] **Créer `apps/desktop/src/main/services/audit.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

export class AuditService {
  constructor(private db: PrismaClient) {}

  async list(filters?: { userId?: string; entity?: string; from?: Date; to?: Date }) {
    return this.db.auditLog.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.entity && { entity: filters.entity }),
        ...(filters?.from && { createdAt: { gte: filters.from } }),
        ...(filters?.to && { createdAt: { lte: filters.to } }),
      },
      include: { user: { select: { username: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })
  }
}
```

- [ ] **Créer `apps/desktop/src/main/services/backup.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import archiver from 'archiver'

export class BackupService {
  private dbPath: string

  constructor(private db: PrismaClient, dbPath: string) {
    this.dbPath = dbPath
  }

  async createDbBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(app.getPath('documents'), 'SGSI', 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const destPath = path.join(backupDir, `sgsi-${timestamp}.db`)
    fs.copyFileSync(this.dbPath, destPath)
    return destPath
  }

  async createZipBackup(photosDir?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = path.join(app.getPath('documents'), 'SGSI', 'backups')
    fs.mkdirSync(backupDir, { recursive: true })

    const destPath = path.join(backupDir, `sgsi-${timestamp}.zip`)

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => resolve(destPath))
      archive.on('error', reject)
      archive.pipe(output)

      archive.file(this.dbPath, { name: 'sgsi.db' })
      if (photosDir && fs.existsSync(photosDir)) {
        archive.directory(photosDir, 'photos')
      }
      archive.finalize()
    })
  }

  async restore(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Fichier de sauvegarde introuvable : ${backupPath}`)
    }
    await this.db.$disconnect()
    fs.copyFileSync(backupPath, this.dbPath)
  }
}
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/services/
git commit -m "feat: add PaymentService, AuditService, BackupService"
```

---

## Task 11 : BulletinService + AbsenceService

**Files:**
- Create: `apps/desktop/src/main/services/bulletin.service.ts`
- Create: `apps/desktop/src/main/services/absence.service.ts`

- [ ] **Créer `apps/desktop/src/main/services/bulletin.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'
import { ServiceError, getAppreciation } from '@sgsi/shared'
import { GradeService } from './grade.service'

export class BulletinService {
  private gradeService: GradeService

  constructor(private db: PrismaClient) {
    this.gradeService = new GradeService(db)
  }

  async generate(enrollmentId: string, period: number, actorId: string) {
    const { generalAverage, subjectAverages, isEliminated } = await this.gradeService.computeAverages(enrollmentId, period)
    const rankings = await this.gradeService.computeClassRankings(
      (await this.db.enrollment.findUnique({ where: { id: enrollmentId } }))!.classId,
      period
    )

    const myRank = rankings.find(r => r.enrollmentId === enrollmentId)
    const school = await this.db.school.findFirst()
    const passingAverage = school?.passingAverage ?? 10

    const decision = isEliminated
      ? 'Redouble'
      : generalAverage >= passingAverage
        ? 'Admis(e)'
        : 'Passage conditionnel'

    const bulletin = await this.db.bulletin.upsert({
      where: { id: `bulletin-${enrollmentId}-${period}` },
      update: { generalAverage, rank: myRank?.rank ?? 0, totalStudents: rankings.length, appreciation: getAppreciation(generalAverage), decision },
      create: {
        id: `bulletin-${enrollmentId}-${period}`,
        enrollmentId,
        period,
        generalAverage,
        rank: myRank?.rank ?? 0,
        totalStudents: rankings.length,
        appreciation: getAppreciation(generalAverage),
        decision,
      },
    })

    await this.db.auditLog.create({
      data: { userId: actorId, action: 'BULLETIN_GENERATED', entity: 'bulletin', entityId: bulletin.id },
    })
    return { bulletin, subjectAverages }
  }

  async validate(bulletinId: string, directorId: string) {
    const bulletin = await this.db.bulletin.update({
      where: { id: bulletinId },
      data: { isValidated: true, validatedAt: new Date() },
    })
    await this.db.auditLog.create({
      data: { userId: directorId, action: 'BULLETIN_VALIDATED', entity: 'bulletin', entityId: bulletinId },
    })
    return bulletin
  }
}
```

- [ ] **Créer `apps/desktop/src/main/services/absence.service.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

export class AbsenceService {
  constructor(private db: PrismaClient) {}

  async record(data: { enrollmentId: string; date: Date; type: string; justified?: boolean; reason?: string }, actorId: string) {
    const absence = await this.db.absence.create({ data })
    await this.db.auditLog.create({
      data: { userId: actorId, action: 'ABSENCE_RECORDED', entity: 'absence', entityId: absence.id },
    })
    return absence
  }

  async listByEnrollment(enrollmentId: string) {
    return this.db.absence.findMany({ where: { enrollmentId }, orderBy: { date: 'desc' } })
  }

  async listByClass(classId: string, date?: Date) {
    return this.db.absence.findMany({
      where: {
        enrollment: { classId },
        ...(date && { date: { gte: new Date(date.setHours(0,0,0,0)), lte: new Date(date.setHours(23,59,59,999)) } }),
      },
      include: { enrollment: { include: { student: true } } },
    })
  }

  async justify(absenceId: string, reason: string, actorId: string) {
    return this.db.absence.update({
      where: { id: absenceId },
      data: { justified: true, reason },
    })
  }
}
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/services/
git commit -m "feat: add BulletinService and AbsenceService"
```

---

## Task 12 : Couche IPC — handlers Electron

**Files:**
- Create: `apps/desktop/src/main/ipc/index.ts`
- Create: `apps/desktop/src/main/ipc/auth.ipc.ts`
- Create: `apps/desktop/src/main/ipc/students.ipc.ts`
- Create: `apps/desktop/src/main/ipc/grades.ipc.ts`
- Create: `apps/desktop/src/main/ipc/payments.ipc.ts`
- Create: `apps/desktop/src/main/ipc/backup.ipc.ts`

- [ ] **Créer `apps/desktop/src/main/ipc/auth.ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../services/auth.service'
import { ok, fail } from '@sgsi/shared'

export function registerAuthIpc(db: PrismaClient, jwtSecret: string) {
  const auth = new AuthService(db, jwtSecret)

  ipcMain.handle('auth:login', async (_, username: string, password: string) => {
    try { return ok(await auth.login(username, password)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:verifyToken', async (_, token: string) => {
    try { return ok(auth.verifyToken(token)) }
    catch { return fail('INVALID_TOKEN', 'Token invalide') }
  })

  ipcMain.handle('auth:requestReset', async (_, userId: string, requestedBy: string) => {
    try { return ok({ tempPassword: await auth.requestPasswordReset(userId, requestedBy) }) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('auth:changePassword', async (_, userId: string, newPassword: string) => {
    try { await auth.changePassword(userId, newPassword); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
```

- [ ] **Créer `apps/desktop/src/main/ipc/students.ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { StudentService } from '../services/student.service'
import { ok, fail } from '@sgsi/shared'

export function registerStudentsIpc(db: PrismaClient) {
  const service = new StudentService(db)

  ipcMain.handle('students:list', async (_, filters) => {
    try { return ok(await service.list(filters)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:findById', async (_, id: string) => {
    try { return ok(await service.findById(id)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:create', async (_, data, actorId: string) => {
    try { return ok(await service.create(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:update', async (_, id: string, data, actorId: string) => {
    try { return ok(await service.update(id, data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:delete', async (_, id: string, actorId: string) => {
    try { await service.delete(id, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('students:enroll', async (_, studentId: string, classId: string, yearId: string, actorId: string) => {
    try { return ok(await service.enroll(studentId, classId, yearId, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
```

- [ ] **Créer `apps/desktop/src/main/ipc/grades.ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../services/grade.service'
import { ok, fail } from '@sgsi/shared'

export function registerGradesIpc(db: PrismaClient) {
  const service = new GradeService(db)

  ipcMain.handle('grades:list', async (_, enrollmentId: string, period: number) => {
    try { return ok(await service.listByEnrollment(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:save', async (_, data, actorId: string) => {
    try { return ok(await service.save(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:averages', async (_, enrollmentId: string, period: number) => {
    try { return ok(await service.computeAverages(enrollmentId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:ranking', async (_, classId: string, period: number) => {
    try { return ok(await service.computeClassRankings(classId, period)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('grades:lock', async (_, enrollmentId: string, period: number, actorId: string) => {
    try { await service.lockGrades(enrollmentId, period, actorId); return ok(null) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
```

- [ ] **Créer `apps/desktop/src/main/ipc/payments.ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { PaymentService } from '../services/payment.service'
import { ok, fail } from '@sgsi/shared'

export function registerPaymentsIpc(db: PrismaClient) {
  const service = new PaymentService(db)

  ipcMain.handle('payments:record', async (_, data, cashierId: string) => {
    try { return ok(await service.record(data, cashierId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:list', async (_, enrollmentId: string) => {
    try { return ok(await service.listByEnrollment(enrollmentId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('payments:unpaid', async (_, classId?: string) => {
    try { return ok(await service.listUnpaid(classId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('feetypes:list', async (_, levelId?: string) => {
    try { return ok(await service.listFeeTypes(levelId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })

  ipcMain.handle('feetypes:create', async (_, data, actorId: string) => {
    try { return ok(await service.createFeeType(data, actorId)) }
    catch (e: any) { return fail(e.code ?? 'ERROR', e.message) }
  })
}
```

- [ ] **Créer `apps/desktop/src/main/ipc/backup.ipc.ts`**

```typescript
import { ipcMain } from 'electron'
import type { PrismaClient } from '@prisma/client'
import { BackupService } from '../services/backup.service'
import { ok, fail } from '@sgsi/shared'
import path from 'path'

export function registerBackupIpc(db: PrismaClient, dbPath: string) {
  const service = new BackupService(db, dbPath)

  ipcMain.handle('backup:create', async (_, format: 'db' | 'zip') => {
    try {
      const filePath = format === 'zip' ? await service.createZipBackup() : await service.createDbBackup()
      return ok({ filePath })
    } catch (e: any) { return fail('BACKUP_ERROR', e.message) }
  })

  ipcMain.handle('backup:restore', async (_, backupPath: string) => {
    try { await service.restore(backupPath); return ok(null) }
    catch (e: any) { return fail('RESTORE_ERROR', e.message) }
  })
}
```

- [ ] **Créer `apps/desktop/src/main/ipc/index.ts`**

```typescript
import type { PrismaClient } from '@prisma/client'
import { registerAuthIpc } from './auth.ipc'
import { registerStudentsIpc } from './students.ipc'
import { registerGradesIpc } from './grades.ipc'
import { registerPaymentsIpc } from './payments.ipc'
import { registerBackupIpc } from './backup.ipc'
import path from 'path'

export function registerIpcHandlers(db: PrismaClient) {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const dbPath = path.resolve(__dirname, '../../../../packages/db/prisma/sgsi.db')

  registerAuthIpc(db, jwtSecret)
  registerStudentsIpc(db)
  registerGradesIpc(db)
  registerPaymentsIpc(db)
  registerBackupIpc(db, dbPath)
}
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/ipc/
git commit -m "feat: add IPC handlers for all backend services"
```

---

## Task 13 : Serveur Express local (sync mobile)

**Files:**
- Create: `apps/desktop/src/main/server/middleware/auth.middleware.ts`
- Create: `apps/desktop/src/main/server/middleware/cors.middleware.ts`
- Create: `apps/desktop/src/main/server/routes/auth.routes.ts`
- Create: `apps/desktop/src/main/server/routes/students.routes.ts`
- Create: `apps/desktop/src/main/server/routes/grades.routes.ts`
- Create: `apps/desktop/src/main/server/routes/payments.routes.ts`
- Create: `apps/desktop/src/main/server/index.ts`

- [ ] **Créer `server/middleware/auth.middleware.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { TokenPayload } from '@sgsi/shared'

declare global {
  namespace Express {
    interface Request { user?: TokenPayload }
  }
}

export function authMiddleware(jwtSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' })
    }
    try {
      req.user = jwt.verify(header.slice(7), jwtSecret) as TokenPayload
      next()
    } catch {
      res.status(401).json({ error: 'Token invalide' })
    }
  }
}
```

- [ ] **Créer `server/middleware/cors.middleware.ts`**

```typescript
import cors from 'cors'

export const corsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})
```

- [ ] **Créer `server/routes/auth.routes.ts`**

```typescript
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { AuthService } from '../../services/auth.service'

export function authRoutes(db: PrismaClient, jwtSecret: string): Router {
  const router = Router()
  const auth = new AuthService(db, jwtSecret)

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body
      const result = await auth.login(username, password)
      res.json(result)
    } catch (e: any) {
      res.status(401).json({ error: e.message })
    }
  })

  return router
}
```

- [ ] **Créer `server/routes/students.routes.ts`**

```typescript
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { StudentService } from '../../services/student.service'
import { GradeService } from '../../services/grade.service'
import { AbsenceService } from '../../services/absence.service'
import { BulletinService } from '../../services/bulletin.service'
import type { Request, Response } from 'express'

export function studentRoutes(db: PrismaClient): Router {
  const router = Router()
  const students = new StudentService(db)
  const grades = new GradeService(db)
  const absences = new AbsenceService(db)
  const bulletins = new BulletinService(db)

  router.get('/:id/grades', async (req: Request, res: Response) => {
    try {
      const { period } = req.query
      const enrollment = await db.enrollment.findFirst({ where: { studentId: req.params.id } })
      if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable' })
      const data = await grades.listByEnrollment(enrollment.id, Number(period ?? 1))
      res.json(data)
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  router.get('/:id/absences', async (req: Request, res: Response) => {
    try {
      const enrollment = await db.enrollment.findFirst({ where: { studentId: req.params.id } })
      if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable' })
      res.json(await absences.listByEnrollment(enrollment.id))
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  router.get('/:id/bulletin/:period', async (req: Request, res: Response) => {
    try {
      const enrollment = await db.enrollment.findFirst({ where: { studentId: req.params.id } })
      if (!enrollment) return res.status(404).json({ error: 'Inscription introuvable' })
      const result = await bulletins.generate(enrollment.id, Number(req.params.period), req.user!.userId)
      res.json(result)
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  return router
}
```

- [ ] **Créer `server/routes/grades.routes.ts`**

```typescript
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { GradeService } from '../../services/grade.service'
import { AbsenceService } from '../../services/absence.service'

export function teacherRoutes(db: PrismaClient): Router {
  const router = Router()
  const gradeService = new GradeService(db)
  const absenceService = new AbsenceService(db)

  // Saisie de notes depuis mobile (offline sync)
  router.post('/:id/grades', async (req, res) => {
    try {
      const { grades } = req.body as { grades: any[] }
      const saved = await Promise.all(grades.map(g => gradeService.save(g, req.user!.userId)))
      res.json({ saved: saved.length })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  // Saisie d'absences depuis mobile
  router.post('/:id/absences', async (req, res) => {
    try {
      const { absences } = req.body as { absences: any[] }
      const saved = await Promise.all(absences.map(a => absenceService.record(a, req.user!.userId)))
      res.json({ saved: saved.length })
    } catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  return router
}
```

- [ ] **Créer `server/routes/payments.routes.ts`**

```typescript
import { Router } from 'express'
import type { PrismaClient } from '@prisma/client'
import { PaymentService } from '../../services/payment.service'

export function paymentRoutes(db: PrismaClient): Router {
  const router = Router()
  const service = new PaymentService(db)

  router.get('/student/:enrollmentId', async (req, res) => {
    try { res.json(await service.listByEnrollment(req.params.enrollmentId)) }
    catch (e: any) { res.status(500).json({ error: e.message }) }
  })

  return router
}
```

- [ ] **Créer `server/index.ts`**

```typescript
import express from 'express'
import type { PrismaClient } from '@prisma/client'
import http from 'http'
import { corsMiddleware } from './middleware/cors.middleware'
import { authMiddleware } from './middleware/auth.middleware'
import { authRoutes } from './routes/auth.routes'
import { studentRoutes } from './routes/students.routes'
import { teacherRoutes } from './routes/grades.routes'
import { paymentRoutes } from './routes/payments.routes'

let server: http.Server | null = null

export async function startExpressServer(db: PrismaClient): Promise<void> {
  const jwtSecret = process.env.JWT_SECRET ?? 'change-me-in-production'
  const port = Number(process.env.EXPRESS_PORT ?? 3721)

  const app = express()
  app.use(corsMiddleware)
  app.use(express.json())

  // Route de santé (sans auth)
  app.get('/api/status', (_, res) => res.json({ status: 'ok', name: 'SGSI', version: '1.0.0' }))

  // Auth mobile (sans middleware)
  app.use('/api/auth', authRoutes(db, jwtSecret))

  // Routes protégées
  const auth = authMiddleware(jwtSecret)
  app.use('/api/student', auth, studentRoutes(db))
  app.use('/api/teacher', auth, teacherRoutes(db))
  app.use('/api/payments', auth, paymentRoutes(db))

  server = http.createServer(app)
  server.listen(port, '0.0.0.0', () => {
    console.log(`✅ Serveur mobile démarré sur le port ${port}`)
  })
}

export function stopExpressServer(): void {
  server?.close()
  server = null
}
```

- [ ] **Commit**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add apps/desktop/src/main/server/
git commit -m "feat: add Express local server for mobile sync"
```

---

## Task 14 : Validation finale — critères de succès

- [ ] **Vérifier la compilation TypeScript complète**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
npx tsc -p apps/desktop/tsconfig.json --noEmit
npx tsc -p packages/shared/tsconfig.json --noEmit
npx tsc -p packages/db/tsconfig.json --noEmit
```
Résultat attendu : aucune erreur sur aucun package.

- [ ] **Exécuter tous les tests**

```bash
npm run test --workspaces --if-present
```
Résultat attendu : tous les tests passent.

- [ ] **Vérifier que la base a toutes les tables**

```bash
npm run db:studio
```
Ouvrir http://localhost:5555, vérifier les 33 modèles dans la barre latérale.

- [ ] **Tester le serveur Express manuellement**

```bash
# Dans un terminal, démarrer le serveur (via script de test)
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI\apps\desktop"
npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const { startExpressServer } = require('./src/main/server/index');
const db = new PrismaClient();
startExpressServer(db);
"

# Dans un autre terminal, tester les endpoints
curl http://localhost:3721/api/status
```
Résultat attendu : `{"status":"ok","name":"SGSI","version":"1.0.0"}`

- [ ] **Tester le login mobile**

```bash
curl -X POST http://localhost:3721/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"Admin@1234\"}"
```
Résultat attendu : `{"token":"eyJ...","user":{...}}`

- [ ] **Commit final**

```bash
cd "C:\Users\LambertMILLIMONO\Desktop\SGSI"
git add .
git commit -m "feat: complete backend phase 1 — all services, IPC, Express server"
```

---

## Résumé des tâches

| # | Tâche | Durée estimée |
|---|---|---|
| 1 | Monorepo root | 15 min |
| 2 | packages/shared | 30 min |
| 3 | packages/db schéma | 30 min |
| 4 | Migration + dépendances | 15 min |
| 5 | Seed données démo | 20 min |
| 6 | Electron skeleton | 20 min |
| 7 | AuthService (TDD) | 25 min |
| 8 | StudentService + ClassService (TDD) | 25 min |
| 9 | GradeService (TDD) | 20 min |
| 10 | PaymentService + Audit + Backup | 25 min |
| 11 | BulletinService + AbsenceService | 20 min |
| 12 | Couche IPC | 20 min |
| 13 | Serveur Express | 25 min |
| 14 | Validation finale | 15 min |
| **Total** | | **~5h** |
