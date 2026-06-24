# SGSI — Backend Phase 1 Design Spec
**Date:** 2026-06-12
**Statut:** Approuvé

---

## 1. Objectif

Construire la fondation technique complète du backend SGSI :
- Monorepo npm workspaces structuré
- Schéma Prisma SQLite complet (toutes les entités du cahier des charges)
- Couche de services métier typée
- Couche IPC Electron (pont Main ↔ Renderer)
- Serveur HTTP Express local (pour synchronisation mobile)
- Authentification locale (bcrypt + JWT)

Cette phase ne produit pas d'interface utilisateur. Elle produit un backend fonctionnel testable via des scripts.

---

## 2. Contexte projet

| Paramètre | Valeur |
|---|---|
| Pays | Guinée — devise GNF |
| Langage | TypeScript strict |
| Runtime desktop | Electron (Node.js main process) |
| Base de données | SQLite via Prisma |
| ORM | Prisma 5.x |
| Auth | JWT local + bcrypt |
| Serveur mobile | Express 4.x |
| Package manager | npm workspaces |
| Node.js | v24.14.1 |

---

## 3. Structure du monorepo

```
sgsi/                                  ← racine du workspace
├── package.json                       ← workspaces: ["apps/*", "packages/*"]
├── tsconfig.base.json                 ← TypeScript config partagée
├── .gitignore
│
├── packages/
│   ├── shared/                        ← Types TypeScript partagés
│   │   ├── src/
│   │   │   ├── types/                 ← interfaces métier
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── student.types.ts
│   │   │   │   ├── grade.types.ts
│   │   │   │   ├── payment.types.ts
│   │   │   │   └── api.types.ts       ← types requêtes IPC/HTTP
│   │   │   └── utils/
│   │   │       ├── grade.utils.ts     ← calcul moyennes, rangs
│   │   │       ├── matricule.utils.ts ← génération matricule
│   │   │       └── date.utils.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── db/                            ← Prisma + SQLite
│       ├── prisma/
│       │   ├── schema.prisma          ← schéma complet
│       │   └── migrations/            ← historique migrations
│       ├── src/
│       │   ├── client.ts              ← singleton PrismaClient
│       │   └── seed.ts                ← données initiales (école demo)
│       ├── package.json
│       └── tsconfig.json
│
└── apps/
    └── desktop/                       ← Application Electron
        ├── src/
        │   └── main/                  ← Main Process uniquement (Phase 1)
        │       ├── index.ts           ← point d'entrée Electron
        │       ├── database/
        │       │   └── client.ts      ← import depuis packages/db
        │       ├── services/
        │       │   ├── auth.service.ts
        │       │   ├── student.service.ts
        │       │   ├── class.service.ts
        │       │   ├── grade.service.ts
        │       │   ├── payment.service.ts
        │       │   ├── bulletin.service.ts
        │       │   ├── absence.service.ts
        │       │   ├── audit.service.ts
        │       │   └── backup.service.ts
        │       ├── ipc/
        │       │   ├── index.ts       ← enregistrement de tous les handlers
        │       │   ├── auth.ipc.ts
        │       │   ├── students.ipc.ts
        │       │   ├── classes.ipc.ts
        │       │   ├── grades.ipc.ts
        │       │   ├── payments.ipc.ts
        │       │   └── backup.ipc.ts
        │       └── server/            ← Express HTTP pour mobile
        │           ├── index.ts
        │           ├── middleware/
        │           │   ├── auth.middleware.ts
        │           │   └── cors.middleware.ts
        │           └── routes/
        │               ├── students.routes.ts
        │               ├── grades.routes.ts
        │               ├── bulletins.routes.ts
        │               └── payments.routes.ts
        ├── package.json
        └── tsconfig.json
```

---

## 4. Schéma Prisma complet

Le fichier `packages/db/prisma/schema.prisma` doit contenir les modèles suivants. L'ordre respecte les dépendances (pas de références circulaires).

### 4.1 Configuration générale

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

`DATABASE_URL` = `file:./sgsi.db` (chemin relatif à l'emplacement du fichier db au runtime).

### 4.2 Modèles — ordre de création

1. **School** — configuration de l'établissement (singleton, 1 seule ligne)
2. **AcademicYear** — année scolaire (1 active à la fois)
3. **User** — tous les utilisateurs (admin, directeur, secrétaire, comptable, enseignant)
4. **AuditLog** — journal d'activité (append-only)
5. **Level** — niveaux scolaires (configurables)
6. **Class** — classes (liées à Level + AcademicYear)
7. **Subject** — matières
8. **ClassSubject** — matière affectée à une classe (avec coefficient + enseignant)
9. **Student** — élèves
10. **Enrollment** — inscription d'un élève dans une classe pour une année
11. **StudentDocument** — documents attachés à un élève
12. **Parent** — parents/tuteurs
13. **StudentParent** — relation élève ↔ parent
14. **Teacher** — enseignants (lié à User)
15. **Grade** — notes
16. **Bulletin** — bulletins générés
17. **Absence** — absences/retards
18. **Room** — salles de classe
19. **Schedule** — emploi du temps
20. **FeeType** — types de frais scolaires (par niveau)
21. **Payment** — paiements
22. **PaymentInstallment** — échéances de paiement échelonné
23. **Expense** — dépenses
24. **CashRegister** — registre de caisse journalier
25. **Salary** — salaires du personnel
26. **Book** — bibliothèque
27. **BookLoan** — emprunts de livres
28. **MedicalRecord** — dossier médical
29. **Consultation** — consultations infirmerie
30. **Bus** — transport scolaire
31. **Route** — circuits de transport
32. **Notification** — notifications internes
33. **License** — clé de licence du logiciel

### 4.3 Enums

```
Role: SUPER_ADMIN | DIRECTOR | SECRETARY | ACCOUNTANT | TEACHER
Gender: MALE | FEMALE
EnrollStatus: ACTIVE | TRANSFERRED | GRADUATED | EXPELLED
EvalType: INTERROGATION | DEVOIR | CONTROLE | TP | EXAM
AbsenceType: ABSENCE | LATE | EARLY_LEAVE
PayMethod: CASH | ORANGE_MONEY | WAVE | MOBILE_MONEY | BANK_CARD | BANK_TRANSFER | CHECK
PeriodType: TRIMESTER | SEMESTER
```

### 4.4 Règles métier encodées dans le schéma

- `School` : pas de `@default` sur les champs obligatoires — la configuration initiale est obligatoire
- `AcademicYear.isCurrent` : un seul `true` à la fois (enforced dans le service, pas dans Prisma)
- `Grade.isLocked` : `false` par défaut, `true` après validation directeur
- `CashRegister` : unique sur `date` (une seule caisse par jour)
- `Salary` : unique sur `(teacherId, month, year)`
- `Receipt` : unique sur `receiptNo`
- `Student.matricule` : unique — format `[SIGLE][NOM1][PRENOM1]-[YYYY]-[0001]`
- `Parent.accessCode` : unique — login mobile des parents

---

## 5. Couche services

Chaque service suit ce contrat :

```typescript
// Convention : toutes les méthodes sont async
// Toutes les erreurs sont typées (ServiceError)
// Toutes les mutations écrivent dans AuditLog

class XxxService {
  constructor(private db: PrismaClient) {}

  async list(filters?: XxxFilters): Promise<Xxx[]>
  async findById(id: string): Promise<Xxx>
  async create(data: CreateXxxInput, actorId: string): Promise<Xxx>
  async update(id: string, data: UpdateXxxInput, actorId: string): Promise<Xxx>
  async delete(id: string, actorId: string): Promise<void>
}
```

### 5.1 Services à implémenter en Phase 1

| Service | Responsabilités clés |
|---|---|
| `AuthService` | login, logout, hashPassword, verifyToken, resetPassword (mot de passe temporaire 24h) |
| `StudentService` | CRUD élèves, génération matricule, inscription/réinscription |
| `ClassService` | CRUD classes, niveaux, affectation élèves |
| `GradeService` | saisie notes, calcul moyennes pondérées, calcul rangs, note éliminatoire |
| `PaymentService` | encaissement, paiement échelonné, numérotation reçus (`REC-MM-YYYY-001`) |
| `BulletinService` | génération bulletin, calcul période, validation directeur |
| `AbsenceService` | saisie absences, alertes seuils, rapports |
| `AuditService` | enregistrement de toutes les actions (append-only) |
| `BackupService` | export `.db`, export `.zip` (db + photos + docs) |

### 5.2 AuthService — détail

```typescript
interface AuthService {
  login(username: string, password: string): Promise<{ token: string; user: User }>
  logout(userId: string): Promise<void>
  verifyToken(token: string): Promise<TokenPayload>
  requestPasswordReset(userId: string, requestedBy: string): Promise<string>  // retourne mot de passe temp
  changePassword(userId: string, tempPassword: string, newPassword: string): Promise<void>
  checkPermission(userId: string, module: string, action: string): Promise<boolean>
}
```

- Mot de passe hashé avec **bcrypt** (cost factor 12)
- JWT signé avec clé secrète stockée dans `School.jwtSecret` (généré à l'installation)
- JWT expiration : **8 heures** (session journée de travail)
- Session persistante : token stocké dans un fichier local chiffré (electron-store)
- Mot de passe temporaire : valable **24 heures**, `User.mustChangePassword = true`

### 5.3 GradeService — calculs

```typescript
// Moyenne d'une matière pour une période
// Pondérée par le poids du type d'évaluation (configurable)
function calcSubjectAverage(grades: Grade[], weights: EvalWeights): number

// Moyenne générale
// Σ(moyenne_matière × coefficient_matière) / Σ(coefficients)
function calcGeneralAverage(subjectAverages: SubjectAverage[], classSubjects: ClassSubject[]): number

// Rang dans la classe
function calcRank(enrollmentId: string, classAverages: Map<string, number>): number

// Note éliminatoire (seuil configurable dans School.eliminatoryThreshold)
function isEliminated(grades: Grade[], threshold: number): boolean
```

---

## 6. Couche IPC

### 6.1 Architecture

```
Renderer (React)          preload.ts              Main Process
─────────────────         ──────────              ─────────────
window.api.auth.login()  →  ipcRenderer.invoke  →  ipcMain.handle
                         ←  return value         ←  authService.login()
```

### 6.2 Canaux IPC Phase 1

Tous les canaux suivent le format `module:action`.

**Auth**
- `auth:login` — `(username, password)` → `{ token, user }`
- `auth:logout` — `(userId)` → `void`
- `auth:me` — `(token)` → `User`
- `auth:requestReset` — `(userId)` → `{ tempPassword }`
- `auth:changePassword` — `(userId, temp, new)` → `void`

**Students**
- `students:list` — `(filters)` → `Student[]`
- `students:findById` — `(id)` → `Student`
- `students:create` — `(data)` → `Student`
- `students:update` — `(id, data)` → `Student`
- `students:delete` — `(id)` → `void`
- `students:enroll` — `(studentId, classId, yearId)` → `Enrollment`

**Classes**
- `classes:list` — `(yearId?)` → `Class[]`
- `classes:create` — `(data)` → `Class`
- `classes:update` — `(id, data)` → `Class`
- `levels:list` — `()` → `Level[]`
- `levels:create` — `(data)` → `Level`

**Grades**
- `grades:list` — `(enrollmentId, period)` → `Grade[]`
- `grades:save` — `(data)` → `Grade`
- `grades:average` — `(enrollmentId, period)` → `SubjectAverages`
- `grades:ranking` — `(classId, period)` → `Ranking[]`

**Payments**
- `payments:record` — `(data)` → `Payment`
- `payments:list` — `(enrollmentId)` → `Payment[]`
- `payments:unpaid` — `(classId?)` → `UnpaidStudent[]`
- `feetypes:list` — `(levelId?)` → `FeeType[]`
- `feetypes:create` — `(data)` → `FeeType`

**Backup**
- `backup:create` — `(format: 'db' | 'zip')` → `{ filePath }`
- `backup:restore` — `(filePath)` → `void`

**Config**
- `school:get` — `()` → `School`
- `school:update` — `(data)` → `School`
- `years:list` — `()` → `AcademicYear[]`
- `years:create` — `(data)` → `AcademicYear`
- `years:setCurrent` — `(id)` → `void`

### 6.3 Format des erreurs IPC

```typescript
interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string      // ex: "STUDENT_NOT_FOUND", "INVALID_PASSWORD"
    message: string   // message lisible
  }
}
```

Tous les handlers retournent `IpcResponse<T>`. Jamais de throw non-catchée.

---

## 7. Serveur Express local (sync mobile)

### 7.1 Configuration

- Port : **3721** (fixe, documenté)
- Bind : `0.0.0.0` (accessible sur le réseau local)
- Démarrage : automatique avec l'app Electron
- Arrêt : à la fermeture de l'app

### 7.2 Authentification mobile

Les parents/enseignants/élèves se connectent avec :
- **Login** : matricule de l'élève (pour parent) ou username (pour enseignant)
- **Mot de passe** : code d'accès généré par l'école (pour parent) ou mot de passe normal (pour enseignant)
- Retourne un JWT mobile avec expiration **2 heures**

### 7.3 Routes Phase 1

```
POST   /api/auth/mobile-login
GET    /api/status

GET    /api/student/:id/grades?period=1
GET    /api/student/:id/absences
GET    /api/student/:id/payments
GET    /api/student/:id/bulletin/:period

GET    /api/teacher/:id/schedule
POST   /api/teacher/:id/grades        ← saisie offline (sync différée)
POST   /api/teacher/:id/absences      ← saisie offline (sync différée)

GET    /api/notifications/:userId
```

### 7.4 Sync offline mobile

Les enseignants peuvent saisir notes/absences sans Wi-Fi. La sync se fait quand le Wi-Fi est retrouvé :

```
Mobile (expo-sqlite) → queue locale des mutations
  → reconnexion Wi-Fi détectée
  → POST /api/teacher/:id/grades (batch)
  → serveur applique les mutations dans l'ordre
  → retourne les conflits éventuels
```

En Phase 1, implémenter uniquement la réception des mutations (côté serveur). La logique mobile vient en Phase 6.

---

## 8. Configuration TypeScript

### tsconfig.base.json (racine)
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

Chaque package étend cette config avec `"extends": "../../tsconfig.base.json"`.

---

## 9. Variables d'environnement

Fichier `.env` dans `packages/db/` :
```
DATABASE_URL="file:./sgsi.db"
```

Fichier `.env` dans `apps/desktop/` :
```
JWT_SECRET=""           # généré automatiquement au premier démarrage
EXPRESS_PORT=3721
NODE_ENV=development
```

En production (Electron packagé), les variables sont lues depuis `electron-store` chiffré.

---

## 10. Seed (données initiales)

Le script `packages/db/src/seed.ts` crée :
1. Une école de démo (`School`)
2. Une année scolaire courante
3. Un compte Super Admin (`admin` / `Admin@1234` — à changer au premier login)
4. 3 niveaux (Primaire, Collège, Lycée)
5. 3 classes (une par niveau)
6. 5 matières avec coefficients
7. 10 élèves fictifs avec inscriptions
8. Quelques paiements et notes fictifs

Ce seed est utilisé pour la **version démo** commerciale.

---

## 11. Scripts npm

### Racine (`package.json`)
```json
{
  "scripts": {
    "db:generate": "npm run db:generate -w packages/db",
    "db:migrate": "npm run migrate -w packages/db",
    "db:seed": "npm run seed -w packages/db",
    "db:studio": "npm run studio -w packages/db",
    "build": "npm run build --workspaces",
    "desktop:dev": "npm run dev -w apps/desktop",
    "desktop:build": "npm run build -w apps/desktop",
    "typecheck": "tsc --noEmit --project tsconfig.base.json"
  }
}
```

---

## 11.bis Modèle License

```prisma
model License {
  id          String   @id @default(cuid())
  key         String   @unique         // clé d'activation (ex: SGSI-XXXX-XXXX-XXXX)
  schoolName  String                   // nom de l'école licenciée
  issuedAt    DateTime @default(now())
  expiresAt   DateTime?                // null = licence perpétuelle
  isActive    Boolean  @default(true)
  maxStudents Int      @default(500)   // limite du plan
  plan        String   @default("STANDARD") // DEMO | STANDARD | PREMIUM
}
```

- Vérifiée au démarrage de l'app
- Si expirée ou absente → mode lecture seule
- La version DEMO utilise une clé pré-installée valable 30 jours

---

## 12. Critères de succès Phase 1

La phase est complète quand :
- [ ] `npm install` depuis la racine installe tout sans erreur
- [ ] `npm run db:migrate` crée le fichier `sgsi.db` avec toutes les tables
- [ ] `npm run db:seed` peuple la base sans erreur
- [ ] `npm run db:studio` affiche toutes les tables avec les données seed
- [ ] Le serveur Express démarre sur le port 3721
- [ ] `POST /api/auth/mobile-login` retourne un JWT valide
- [ ] Les services `AuthService.login()` et `StudentService.list()` fonctionnent via un script de test manuel
- [ ] L'audit log enregistre chaque action
- [ ] Le backup `.db` produit un fichier SQLite valide

---

## 13. Ce qui n'est PAS dans cette phase

- Interface React (renderer process) — Phase 2
- Génération PDF (bulletins, reçus) — Phase 3
- Application mobile React Native — Phase 6
- Système de licence — Phase 7
- SMS (notifications parents) — Phase 5
- Emploi du temps graphique — Phase 5
