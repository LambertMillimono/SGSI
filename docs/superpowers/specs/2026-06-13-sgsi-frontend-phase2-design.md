# SGSI — Frontend Phase 2 Design Spec
**Date:** 2026-06-13  
**Auteur:** LambertMillimono  
**Statut:** Approuvé — prêt pour implémentation

---

## 1. Résumé des décisions de brainstorming

| # | Question | Décision |
|---|----------|----------|
| 1 | Layout global | **A — Sidebar fixe + header** |
| 2 | Scope Phase 2 | **Login + Dashboard + Élèves complet + Notes + Paiements + Reçus** |
| 3 | Dashboard | **C — Par rôle** (Directeur, Secrétaire, Enseignant) |
| 4 | Liste élèves | **A — Tableau dense** (style Excel, avec filtres + pagination) |
| 5 | Formulaire élève | **A — Page unique avec sections** |
| 6 | Composants UI | **B — Ant Design** |

---

## 2. Stack technique

```
apps/desktop/src/renderer/
├── Framework     : React 18 + TypeScript strict
├── Build         : Vite 5
├── Routing       : React Router v6 (hash router pour Electron)
├── State         : Redux Toolkit (RTK Query pour IPC calls)
├── UI            : Ant Design 5.x + Tailwind CSS (utilitaires only)
├── Icons         : Ant Design Icons
├── Forms         : Ant Design Form + Zod (validation)
├── PDF           : @react-pdf/renderer (bulletins + reçus)
├── Charts        : Recharts (stats dashboard)
└── Tests         : Vitest + React Testing Library
```

### Tailwind + Ant Design : cohabitation

- Tailwind en **mode utilitaire uniquement** : layout, spacing, flex/grid
- Désactiver le preflight Tailwind (`corePlugins: { preflight: false }`)  
  pour éviter les conflits avec les styles de base Ant Design
- Le token de couleur primaire Ant Design est surchargé à `#1E40AF` (bleu SGSI)
- Dark/Light mode via `ConfigProvider` Ant Design + classe `dark` sur `<html>`

---

## 3. Architecture du renderer

```
apps/desktop/src/renderer/
├── main.tsx                    # Point d'entrée React
├── App.tsx                     # Router + ConfigProvider AntD
├── store/
│   ├── index.ts                # Redux store
│   ├── authSlice.ts            # Auth state (user, token, role)
│   ├── uiSlice.ts              # Theme dark/light, sidebar collapsed
│   └── api/
│       └── ipcApi.ts           # RTK Query baseQuery → window.electron.ipc
├── hooks/
│   ├── useAuth.ts              # Auth context hook
│   ├── useIpc.ts               # Typed IPC caller
│   └── useRole.ts              # Role-based access helpers
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx       # Sidebar + Header + Outlet
│   │   ├── Sidebar.tsx         # Navigation latérale fixe
│   │   └── Header.tsx          # Titre page + user menu + theme toggle
│   └── shared/
│       ├── PageHeader.tsx      # Titre + breadcrumb + actions
│       ├── DataTable.tsx       # Wrapper AntD Table avec config commune
│       ├── StatusBadge.tsx     # Badge statut (inscrit/impayé/suspendu)
│       └── ConfirmModal.tsx    # Modal de confirmation générique
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx
│   ├── dashboard/
│   │   └── DashboardPage.tsx   # Composé selon rôle
│   ├── students/
│   │   ├── StudentListPage.tsx
│   │   ├── StudentCreatePage.tsx
│   │   └── StudentProfilePage.tsx
│   ├── grades/
│   │   ├── GradeEntryPage.tsx
│   │   └── BulletinPage.tsx
│   └── payments/
│       ├── PaymentListPage.tsx
│       ├── PaymentCreatePage.tsx
│       └── ReceiptPage.tsx
└── utils/
    ├── formatters.ts           # formatGNF, formatDate, formatMatricule
    ├── roleGuard.tsx           # HOC protection par rôle
    └── ipcBridge.ts            # Typage fort des appels IPC
```

---

## 4. Routing

Hash Router (requis pour Electron — pas de serveur HTTP).

```
/login                          → LoginPage (public)

/ (AppLayout — protégé)
  /dashboard                   → DashboardPage
  /students                    → StudentListPage
  /students/new                → StudentCreatePage
  /students/:id                → StudentProfilePage
  /grades                      → GradeEntryPage
  /grades/bulletins/:studentId → BulletinPage
  /payments                    → PaymentListPage
  /payments/new                → PaymentCreatePage
  /payments/:id/receipt        → ReceiptPage
```

**Protection de routes :** `<RoleGuard allowedRoles={[...]}>` redirige vers `/dashboard` si rôle insuffisant.

---

## 5. Layout global (AppLayout)

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER : [≡] Logo SGSI          [Nom école]   [🌙] [👤 Admin ▼]│
├────────────────┬────────────────────────────────────────────────┤
│                │                                                 │
│   SIDEBAR      │   CONTENT AREA (Outlet)                        │
│   200px fixe   │   padding: 24px                                 │
│                │                                                 │
│   🏠 Dashboard │   ┌─ PageHeader ────────────────────────────┐  │
│   👥 Élèves    │   │  Titre page    [Actions]                 │  │
│   📝 Notes     │   └──────────────────────────────────────────┘  │
│   💰 Paiements │                                                 │
│   ─────────    │   [Contenu de la page]                          │
│   ⚙️ Paramètres│                                                 │
│   🚪 Déconnex. │                                                 │
│                │                                                 │
└────────────────┴────────────────────────────────────────────────┘
```

- Sidebar collapsible (icônes seulement à 64px) via bouton `≡`
- Active link highlight avec couleur primaire `#1E40AF`
- Icône de badge rouge sur "Paiements" si impayés en attente
- Sidebar état persisté dans Redux (`uiSlice`)

---

## 6. Page : Login

### Comportement
- Page plein écran, centré, fond dégradé bleu foncé
- Logo SGSI + slogan "Le numérique au service de l'éducation"
- Champs : Email/Username + Mot de passe
- Bouton "Se connecter"
- Message d'erreur inline (mauvais identifiants)
- Si première connexion ou mot de passe temporaire → modal "Changer votre mot de passe"
- Stockage du JWT dans `authSlice` (Redux, pas localStorage pour sécurité Electron)

### Wireframe
```
┌───────────────────────────────────────────────────┐
│                                                   │
│              [Logo SGSI]                          │
│         SchoolManager Pro                         │
│   Le numérique au service de l'éducation          │
│                                                   │
│   ┌──────────────────────────────────────┐        │
│   │   Identifiant                        │        │
│   │   [_________________________________]│        │
│   │   Mot de passe                       │        │
│   │   [_________________________________]│        │
│   │                                      │        │
│   │   [      Se connecter       ]        │        │
│   └──────────────────────────────────────┘        │
│                                                   │
│   v1.0.0 — Licence: École XYZ                     │
└───────────────────────────────────────────────────┘
```

---

## 7. Page : Dashboard (par rôle)

### Rôle DIRECTEUR
```
Cartes KPI (4 colonnes) :
  [Total Élèves: 247]  [Classes: 12]  [Recettes mois: 3.2M GNF]  [Alertes: 5]

Section gauche (60%) — Activité financière (Recharts BarChart mensuel)
Section droite (40%) — Alertes impayés (AntD List avec badge rouge)

Tableau bas — Derniers paiements (5 lignes, lien vers module Paiements)
```

### Rôle SECRETAIRE
```
Cartes KPI (3 colonnes) :
  [Élèves inscrits: 247]  [Paiements du jour: 8]  [Impayés: 23]

Tableau — Paiements du jour (colonnes: élève, classe, montant, heure)
Accès rapide — [+ Nouvel élève]  [+ Paiement]
```

### Rôle ENSEIGNANT
```
Cartes — Mes classes (ex: 3ème B — 32 élèves, 4ème A — 28 élèves)
Alerte — Notes à saisir cette semaine (période en cours)
Tableau — Absences récentes dans ses classes
```

---

## 8. Page : Liste des Élèves (`StudentListPage`)

### Fonctionnalités
- Recherche full-text (nom, prénom, matricule) — debounce 300ms
- Filtres : Classe (Select), Statut (inscrit/impayé/suspendu/radié), Année scolaire
- Tri sur toutes les colonnes cliquables
- Pagination : 20 élèves/page (configurable 10/20/50)
- Sélection multiple → actions groupées (export CSV, changer statut)
- Double-clic sur une ligne → `StudentProfilePage`

### Colonnes du tableau
| Colonne | Source | Largeur | Sortable |
|---------|--------|---------|----------|
| # (checkbox) | — | 40px | non |
| Photo | student.photoUrl | 50px | non |
| Nom complet | lastName + firstName | auto | oui |
| Matricule | matricule | 130px | oui |
| Classe | class.name | 100px | oui |
| Statut | enrollmentStatus | 110px | oui |
| Actions | — | 90px | non |

### Actions par ligne
- `👁` Voir profil
- `✏️` Modifier  
- `💳` Ajouter paiement

### Barre d'actions globales
```
[🔍 Rechercher...]  [Classe ▼]  [Statut ▼]  [Année ▼]    [+ Nouvel élève] [↓ Export CSV]
```

---

## 9. Page : Création d'un élève (`StudentCreatePage`)

### Sections (page unique, scroll)

**Section 1 — Informations personnelles**
| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| Nom | Text | ✅ | min 2 chars |
| Prénom | Text | ✅ | min 2 chars |
| Date de naissance | DatePicker | ✅ | ≤ aujourd'hui |
| Lieu de naissance | Text | ✅ | — |
| Sexe | Radio (M/F) | ✅ | — |
| Photo | Upload (jpg/png, max 2MB) | ❌ | — |

**Section 2 — Scolarité**
| Champ | Type | Requis | Note |
|-------|------|--------|------|
| Année scolaire | Select | ✅ | Ex: 2024-2025 |
| Classe | Select (filtré par année) | ✅ | — |
| Matricule | Text (readonly) | auto | Généré automatiquement |
| Date d'inscription | DatePicker | ✅ | Par défaut: aujourd'hui |
| Statut | Select | ✅ | Par défaut: Inscrit |

**Matricule auto-généré :** `[SIGLE][1ère lettre nom][1ère lettre prénom]-[ANNÉE]-[0001]`  
Exemple : `LMD-2024-0001` (École Lycée, Mamadou Diallo)

**Section 3 — Contact parent/tuteur**
| Champ | Type | Requis |
|-------|------|--------|
| Nom du père | Text | ❌ |
| Téléphone père | Tel (format GN) | ❌ |
| Nom de la mère | Text | ❌ |
| Téléphone mère | Tel | ❌ |
| Nom tuteur | Text | ❌ (si pas de parents) |
| Téléphone tuteur | Tel | ❌ |
| Adresse famille | Textarea | ❌ |

**Section 4 — Documents** (optionnel)
- Upload acte de naissance, certificat de scolarité précédent
- Formats : PDF, JPG, PNG — max 5MB par fichier

### Actions
```
[Annuler]                              [Enregistrer et continuer →]
                                       [Enregistrer et nouveau]
```

### Comportement post-création
- Notification AntD `message.success("Élève créé — Matricule: LMD-2024-0001")`
- Redirect vers `StudentProfilePage` du nouvel élève

---

## 10. Page : Profil d'un élève (`StudentProfilePage`)

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Retour liste          Diallo Mamadou        [Modifier] [...]  │
├──────────────┬──────────────────────────────────────────────────┤
│  [Photo]     │  Matricule : LMD-2024-0001                       │
│  Diallo      │  Classe    : 3ème B — Année 2024-2025            │
│  Mamadou     │  Statut    : ✅ Inscrit                          │
│  3ème B      │  Né le     : 15/03/2010 à Conakry               │
│              │  Père      : Mamadou Sr. — 622 xx xx xx          │
└──────────────┴──────────────────────────────────────────────────┤
│  [Historique scolaire] [Paiements] [Notes] [Documents]          │
├─────────────────────────────────────────────────────────────────┤
│  Onglet actif (AntD Tabs)                                       │
│  [Contenu de l'onglet]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Onglets
1. **Historique scolaire** — années passées, classes, résultats par période
2. **Paiements** — tableau des paiements avec statut, bouton "+ Paiement"
3. **Notes** — tableau notes par matière/période, lien vers bulletin PDF
4. **Documents** — liste des documents uploadés, téléchargement

---

## 11. Page : Saisie des notes (`GradeEntryPage`)

### Sélecteurs (Header de page)
```
[Classe: 3ème B ▼]  [Matière: Mathématiques ▼]  [Période: Trimestre 1 ▼]
```

### Tableau de saisie
```
┌──────────────────────┬────────┬────────┬──────────┬───────────┐
│ Élève                │ Note/20│ Coeff  │ Remarque │ Statut    │
├──────────────────────┼────────┼────────┼──────────┼───────────┤
│ Bah Ibrahim          │ [15  ] │  2     │ [_____]  │ ✅ Sauvé  │
│ Camara Fatoumata     │ [  _] │  2     │ [_____]  │ ○ Non saisi│
│ Diallo Mamadou       │ [18  ] │  2     │ [Excellent]│ ✅ Sauvé │
└──────────────────────┴────────┴────────┴──────────┴───────────┘
```
- Navigation au clavier (Tab entre les cellules)
- Auto-save après chaque saisie (debounce 1s)
- Validation : 0 ≤ note ≤ 20
- Indicateur de progression : "23/32 notes saisies"

---

## 12. Page : Paiements (`PaymentListPage` + `PaymentCreatePage`)

### Liste paiements
- Colonnes : Date, Élève, Classe, Motif, Montant (GNF), Reçu N°, Actions
- Filtres : Période (mois), Classe, Motif (frais scolarité/inscription/autre)
- Total en bas : somme des montants filtrés
- Bouton "📄 Reçu" sur chaque ligne → ouvre le PDF

### Formulaire paiement (Modal AntD — pas de page dédiée)
```
┌──────────────────────────────────────────┐
│  Nouveau paiement               [×]      │
│                                          │
│  Élève*    [Rechercher élève...    ▼]    │
│  Motif*    [Frais de scolarité     ▼]    │
│  Montant*  [________________] GNF        │
│  Date*     [13/06/2026          📅]      │
│  Remarque  [________________________________]│
│                                          │
│  Reçu N° : REC-06-2026-042 (auto)       │
│                                          │
│  [Annuler]    [Enregistrer + Imprimer reçu]│
└──────────────────────────────────────────┘
```

### Reçu PDF (`ReceiptPage`)
- Généré avec `@react-pdf/renderer`
- Format : A5 ou A4
- Contenu : Logo école, Nom élève, Matricule, Motif, Montant en lettres, Date, N° reçu, Signature
- Deux exemplaires sur une page A4 (original + copie)
- Bouton "🖨 Imprimer" → `window.print()` via Electron

---

## 13. IPC Bridge (Renderer ↔ Main)

Le renderer communique avec le main process via un bridge typé exposé par `preload.ts`.

```typescript
// preload.ts expose :
window.electron = {
  ipc: {
    invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>
  }
}

// ipcBridge.ts dans renderer — wrapper typé :
export const ipc = {
  auth: {
    login: (email: string, password: string) =>
      window.electron.ipc.invoke<AuthResult>('auth:login', email, password),
    logout: () => window.electron.ipc.invoke<void>('auth:logout'),
    changePassword: (old: string, next: string) =>
      window.electron.ipc.invoke<void>('auth:changePassword', old, next),
  },
  students: {
    list: (filters: StudentFilters) =>
      window.electron.ipc.invoke<PaginatedResult<Student>>('students:list', filters),
    getById: (id: string) =>
      window.electron.ipc.invoke<Student>('students:getById', id),
    create: (data: CreateStudentDto) =>
      window.electron.ipc.invoke<Student>('students:create', data),
    update: (id: string, data: UpdateStudentDto) =>
      window.electron.ipc.invoke<Student>('students:update', id, data),
    delete: (id: string) =>
      window.electron.ipc.invoke<void>('students:delete', id),
  },
  grades: {
    list: (filters: GradeFilters) =>
      window.electron.ipc.invoke<Grade[]>('grades:list', filters),
    upsert: (data: UpsertGradeDto) =>
      window.electron.ipc.invoke<Grade>('grades:upsert', data),
    getBulletin: (studentId: string, periodId: string) =>
      window.electron.ipc.invoke<BulletinData>('bulletins:get', studentId, periodId),
  },
  payments: {
    list: (filters: PaymentFilters) =>
      window.electron.ipc.invoke<PaginatedResult<Payment>>('payments:list', filters),
    create: (data: CreatePaymentDto) =>
      window.electron.ipc.invoke<Payment>('payments:create', data),
    getReceipt: (id: string) =>
      window.electron.ipc.invoke<ReceiptData>('payments:receipt', id),
  },
  classes: {
    list: () => window.electron.ipc.invoke<Class[]>('classes:list'),
  },
  dashboard: {
    getStats: (role: UserRole) =>
      window.electron.ipc.invoke<DashboardStats>('dashboard:stats', role),
  },
}
```

---

## 14. Thème couleurs

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#1E40AF` | Boutons, liens actifs, sidebar active |
| `success` | `#16A34A` | Statut inscrit, paiements OK |
| `warning` | `#D97706` | Statut impayé, alertes |
| `error` | `#DC2626` | Erreurs, statut radié |
| `bg-dark` | `#0F172A` | Fond dark mode |
| `bg-light` | `#F8FAFC` | Fond light mode |

Configuration Ant Design :
```typescript
const theme = {
  token: {
    colorPrimary: '#1E40AF',
    colorSuccess: '#16A34A',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    borderRadius: 6,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  }
}
```

---

## 15. Critères d'acceptation Phase 2

- [ ] Login fonctionnel avec JWT (succès + erreur + mot de passe temporaire)
- [ ] Dashboard affiche les bonnes données selon le rôle connecté
- [ ] Liste élèves : recherche + filtres + pagination opérationnels
- [ ] Création élève : validation, matricule auto-généré, redirect profil
- [ ] Profil élève : 4 onglets avec données réelles
- [ ] Saisie notes : navigation clavier, auto-save, validation 0-20
- [ ] Bulletin PDF : généré et imprimable
- [ ] Paiement : création via modal, reçu PDF généré
- [ ] Dark/Light toggle persistent
- [ ] Sidebar collapsible
- [ ] Toutes les routes protégées par rôle
- [ ] TypeScript strict — zéro erreur `tsc --noEmit`
- [ ] Tests : couverture > 70% sur les composants critiques
