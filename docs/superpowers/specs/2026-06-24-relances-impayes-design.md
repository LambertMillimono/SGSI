# Spec — Relances Impayés Automatiques
**Date :** 2026-06-24
**Statut :** Approuvé

## Objectif

Permettre à l'école d'envoyer des relances (SMS, email, lettre imprimée) aux parents dont les paiements sont en retard, avec une alerte au démarrage de l'app et une page dédiée de gestion.

---

## Architecture

### Nouveaux fichiers
| Fichier | Rôle |
|---------|------|
| `src/main/services/relance.service.ts` | Logique métier : calcul retards, envoi, historique |
| `src/main/ipc/relances.ipc.ts` | Pont IPC : list, send, history, printLetters |
| `src/renderer/pages/relances/RelancesPage.tsx` | Page UI avec 2 onglets |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `src/main/ipc/index.ts` | Enregistrer relancesIpc |
| `src/main/index.ts` | Check au démarrage (impayés > seuil) |
| `src/renderer/App.tsx` | Route `/relances` |
| `src/renderer/components/layout/Sidebar.tsx` | Entrée menu "Relances" avec badge |
| `packages/db/prisma/schema.prisma` | Ajouter modèle `ReminderLog` |

---

## Modèle de données

### Nouveau modèle Prisma : `ReminderLog`
```prisma
model ReminderLog {
  id          Int      @id @default(autoincrement())
  parentId    Int
  studentId   Int
  amountDue   Float
  channel     String   // SMS | EMAIL | BOTH
  status      String   // SENT | FAILED | SKIPPED
  sentAt      DateTime @default(now())
  errorMsg    String?
  schoolYear  String

  parent  Parent  @relation(fields: [parentId], references: [id])
  student Student @relation(fields: [studentId], references: [id])
}
```

---

## Service : `relance.service.ts`

### Fonctions
- **`getOverdueParents(thresholdDays: number)`** — joint `listUnpaid()` avec les données parents, filtre par retard > seuil, retourne la liste enrichie avec statut "déjà relancé" si envoi < 7 jours
- **`sendReminders(parentIds: number[])`** — envoie SMS si phone dispo, email si email dispo, via `email.service.ts` existant, enregistre dans `ReminderLog`
- **`getReminderHistory()`** — liste l'historique des envois
- **`generateLetterHtml(parentId: number)`** — génère HTML de la lettre formelle pour impression Electron

### Règles métier
- Seuil par défaut : 30 jours (configurable dans Paramètres)
- Anti-doublon : pas d'envoi auto si déjà relancé dans les 7 derniers jours (envoi manuel possible)
- Si Brevo non configuré → erreur explicite "Configurez Brevo dans les Paramètres"

### Priorité des canaux
```
phone + email  →  SMS + Email
phone only     →  SMS
email only     →  Email
aucun          →  "Non joignable" (affiché, pas envoyé)
```

---

## IPC : `relances.ipc.ts`

| Endpoint | Paramètres | Retour |
|----------|-----------|--------|
| `relances:list` | `{ thresholdDays }` | Liste parents en retard + montant + statut |
| `relances:send` | `{ parentIds }` | `{ sent, failed, skipped }` |
| `relances:history` | — | Liste ReminderLog |
| `relances:printLetters` | `{ parentIds }` | HTML multi-pages pour impression |

---

## Page UI : `RelancesPage.tsx`

### Onglet 1 — Impayés
- Tableau : Élève | Parent | Téléphone | Montant dû | Retard (jours) | Canal dispo | Dernière relance
- Filtres rapides : > 15j / > 30j / > 60j
- Sélection : cases à cocher + "Tout sélectionner"
- Boutons :
  - **Envoyer SMS/Email** → `relances:send` pour les sélectionnés
  - **Imprimer les lettres** → `relances:printLetters` → `window.print()`
- Badge rouge sur l'icône menu (nombre de parents en retard > seuil)

### Onglet 2 — Historique
- Tableau : Date | Parent | Élève | Montant | Canal | Statut (Envoyé / Échoué)

---

## Lettre imprimée

Générée en HTML, imprimée via `window.print()` dans une fenêtre Electron dédiée.

**Contenu :**
```
[NOM DE L'ÉCOLE]                          [Ville], le [Date]
[Adresse école] | [Tél école]

Objet : Rappel de paiement — [Nom Élève]

Monsieur/Madame [Nom Parent],

Nous vous informons que le compte de votre enfant [Nom Élève],
inscrit en classe de [Classe], présente un solde impayé de
[Montant] GNF à la date du [Date].

Nous vous prions de bien vouloir régulariser votre situation
dans un délai de 7 jours à compter de la réception de ce courrier.

Pour tout renseignement, veuillez contacter notre service comptable
au [Tél École].

Nous vous remercions de votre compréhension.

                                    Le Directeur,
                                    [Nom Directeur]
                                    _________________
                                    (Signature et cachet)
```

---

## Alerte au démarrage

- Vérifie les impayés > seuil au lancement de l'app (main process)
- Si ≥ 1 parent en retard → envoie notification IPC vers le renderer
- Renderer affiche un modal/banner :
  - "⚠️ X parents ont des impayés en retard — Total : Y GNF"
  - Bouton **Voir les relances** → navigate vers `/relances`
  - Bouton **Plus tard** → supprime l'alerte pour 24h (stocké en localStorage)
- L'alerte ne s'affiche pas si "Plus tard" a été cliqué il y a moins de 24h

---

## Gestion des erreurs

| Situation | Comportement |
|-----------|-------------|
| Brevo non configuré | Message "Configurez Brevo dans Paramètres > Notifications" |
| SMS échoué | Marqué FAILED dans ReminderLog, affiché en rouge dans historique |
| Parent sans contact | Ligne grisée "Non joignable", non sélectionnable pour envoi |
| Aucun impayé | Page affiche "Aucun impayé en retard. Bonne gestion !" |
