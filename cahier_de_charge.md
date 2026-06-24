# CAHIER DES CHARGES COMPLET
# SYSTÈME DE GESTION SCOLAIRE INTÉGRÉ (SGSI)
# SchoolManager Pro — Application Exécutable Desktop & Mobile

---

## 1. PRÉSENTATION DU PROJET

### 1.1 Nom du projet

**SchoolManager Pro**

### 1.2 Contexte

Les établissements scolaires, notamment en Afrique, rencontrent des difficultés dans la gestion administrative, pédagogique et financière. Les données sont souvent dispersées entre plusieurs outils ou enregistrées manuellement. La connexion internet est parfois instable ou inexistante.

L'objectif est de développer une **application exécutable installable** (Windows + Mobile Android/iOS) fonctionnant **entièrement hors ligne**, centralisant l'ensemble des activités d'un établissement scolaire dans un seul logiciel professionnel.

### 1.3 Objectifs

* Fournir une application installable sur PC Windows (fichier `.exe`) et sur téléphone (Android/iOS).
* Fonctionner **sans connexion internet** (mode hors ligne total).
* Digitaliser et automatiser tous les processus scolaires.
* Réduire les erreurs humaines.
* Faciliter la communication entre l'école, les enseignants, les élèves et les parents.
* Produire automatiquement les documents officiels (bulletins, reçus, certificats).
* Améliorer le suivi pédagogique et financier.
* Protéger les données avec des sauvegardes locales (USB, disque externe).

### 1.4 Périmètre

* **Une installation = un établissement scolaire.**
* Chaque école installe sa propre copie du logiciel.
* Pas de gestion multi-écoles sur une même installation.
* Les données restent sur l'ordinateur/téléphone de l'école.

---

## 2. ARCHITECTURE TECHNIQUE

### 2.1 Type d'application

| Plateforme | Type | Format de distribution |
|---|---|---|
| Windows | Application desktop | Installateur `.exe` (NSIS/Squirrel) |
| Android | Application mobile | Fichier `.apk` / Google Play Store |
| iOS | Application mobile | App Store |

### 2.2 Stack technologique

#### Application Desktop (Windows)

| Composant | Technologie |
|---|---|
| Framework desktop | **Electron.js** |
| Interface (UI) | **React.js + Vite** |
| Style | **Tailwind CSS** |
| Gestion d'état | **Redux Toolkit** |
| Base de données locale | **SQLite** via `better-sqlite3` |
| ORM | **Prisma** (avec SQLite) |
| Génération PDF | **React-PDF** ou **Puppeteer** |
| Génération Excel | **ExcelJS** |
| QR Code | **qrcode** |
| Graphiques | **Recharts** |
| Impression | API impression Electron |
| Mise à jour automatique | **electron-updater** |
| Packaging | **electron-builder** |

#### Application Mobile (Android & iOS)

| Composant | Technologie |
|---|---|
| Framework | **React Native + Expo** |
| Interface (UI) | **NativeWind** (Tailwind pour React Native) |
| Gestion d'état | **Redux Toolkit** |
| Base de données locale | **expo-sqlite** |
| Génération PDF | **expo-print** + **expo-sharing** |
| QR Code | **react-native-qrcode-svg** |
| Notifications | **expo-notifications** |
| Stockage fichiers | **expo-file-system** |

#### Partagé (Desktop + Mobile)

| Composant | Technologie |
|---|---|
| Langage | **TypeScript** |
| Logique métier commune | Bibliothèque partagée (monorepo) |
| Authentification | **JWT local** (stocké en base SQLite) |
| Sécurité | **bcrypt** pour les mots de passe |

### 2.3 Base de données

* **SQLite** embarqué — aucun serveur de base de données requis.
* Toutes les données sont stockées dans un fichier `.db` local sur l'appareil.
* Migrations gérées via **Prisma Migrate**.
* Sauvegarde = copie du fichier `.db` (vers USB, disque externe, dossier partagé).

### 2.4 Architecture Electron (Desktop)

```
Application Electron
├── Main Process (Node.js)
│   ├── Gestion de la base de données SQLite
│   ├── Génération des PDF
│   ├── Impression
│   ├── Sauvegarde / Restauration
│   └── IPC (communication avec le renderer)
└── Renderer Process (React)
    ├── Interface utilisateur
    ├── Redux Store
    └── Appels IPC vers le main process
```

### 2.5 Distribution et installation

**Windows :**
* Installateur `.exe` généré avec `electron-builder` (NSIS).
* Installation silencieuse possible pour déploiement en masse.
* Mise à jour automatique via `electron-updater` (serveur de mise à jour local ou GitHub Releases).
* Icône dans la barre des tâches.
* Raccourci sur le bureau et dans le menu Démarrer.

**Mobile :**
* Fichier `.apk` distribué directement ou via Google Play.
* Application iOS distribuée via App Store ou TestFlight.
* Expo EAS Build pour la compilation.

---

## 3. TYPES D'UTILISATEURS

### 3.1 Super Administrateur (local)

Responsable de la configuration initiale du logiciel.

Fonctionnalités :
* Configuration de l'établissement (nom, logo, adresse, contacts)
* Création des comptes utilisateurs
* Paramétrage de l'année scolaire
* Sauvegarde et restauration de la base de données
* Gestion des licences du logiciel
* Paramètres système (langue, devise, fuseau horaire)
* Journal d'activité complet
* Réinitialisation des mots de passe

---

### 3.2 Directeur

Responsable de l'établissement.

Fonctionnalités :
* Tableau de bord complet en temps réel
* Gestion du personnel (enseignants, staff)
* Validation et signature électronique des bulletins
* Consultation des statistiques et rapports
* Gestion des emplois du temps
* Validation des paiements importants
* Accès à tous les modules en lecture
* Impression et export de tous les rapports

---

### 3.3 Secrétaire

Fonctionnalités :
* Inscription et réinscription des élèves
* Gestion des dossiers scolaires
* Impression des documents officiels
* Gestion des absences
* Accueil et communication avec les parents
* Gestion du registre des élèves

---

### 3.4 Comptable

Fonctionnalités :
* Encaissement des frais scolaires
* Gestion des différents types de frais
* Impression des reçus de paiement
* Gestion des dépenses de l'établissement
* Rapports financiers (journalier, mensuel, annuel)
* Suivi des impayés
* Gestion de la caisse

---

### 3.5 Enseignant

Fonctionnalités :
* Consultation de son emploi du temps
* Saisie des notes par matière et par évaluation
* Saisie des absences et présences
* Cahier de texte numérique
* Consultation de ses classes et élèves
* (Mobile) Saisie des notes depuis le téléphone

---

### 3.6 Parent (Mobile uniquement)

Accès via l'application mobile avec un code d'accès fourni par l'école.

Fonctionnalités :
* Consultation des notes et moyennes de son enfant
* Consultation des absences
* Consultation et téléchargement des bulletins PDF
* Réception des notifications push (absences, résultats, paiements)
* Consultation des paiements effectués et restants
* Messagerie avec la direction

---

### 3.7 Élève (Mobile uniquement)

Fonctionnalités :
* Consultation des notes
* Emploi du temps
* Bulletins téléchargeables
* Documents scolaires
* Notifications

---

## 4. MODULE DE GESTION DES ÉLÈVES

### 4.1 Inscription

Informations obligatoires :
* Matricule automatique (format configurable : ex. `ECO-2024-0001`)
* Nom et prénom
* Sexe
* Date et lieu de naissance
* Nationalité
* Adresse complète
* Téléphone (élève / tuteur)
* Email (optionnel)
* Photo (depuis webcam ou fichier)
* Niveau et classe
* Année scolaire

Documents à scanner/attacher :
* Extrait de naissance (PDF/image)
* Certificat de transfert
* Photos d'identité
* Certificat médical
* Tout autre document configurable

Fonctionnalités :
* Génération automatique du matricule unique
* QR Code unique par élève (contient les informations de base)
* Archivage électronique de tous les documents
* Impression de la fiche d'inscription
* Vérification des doublons (même nom + date de naissance)

---

### 4.2 Réinscription

* Passage automatique vers la classe suivante (promotion)
* Conservation de tout l'historique
* Modification de classe possible (redoublement, changement)
* Historique complet des années précédentes accessible

---

### 4.3 Dossier scolaire complet

Contient :
* Informations personnelles
* Historique de toutes les années scolaires
* Notes et moyennes par période
* Bulletins générés
* Absences et retards
* Historique des paiements
* Sanctions disciplinaires
* Récompenses et distinctions
* Documents attachés

---

### 4.4 Carte scolaire

* Générée automatiquement en PDF
* Contient : photo, nom, matricule, classe, année scolaire, QR Code
* Impression directe depuis le logiciel

---

## 5. MODULE DE GESTION DES PARENTS

Chaque élève peut avoir :
* Père
* Mère
* Tuteur légal

Informations :
* Nom complet
* Téléphone (principal + secondaire)
* Adresse
* Profession
* Email

Fonctionnalités :
* Liaison à un ou plusieurs élèves
* Génération d'un code d'accès unique pour l'application mobile parent
* Historique des contacts avec l'école
* Notifications configurables (absences, résultats, paiements)

---

## 6. MODULE DE GESTION DES ENSEIGNANTS

Informations :
* Matricule
* Nom et prénom
* Diplôme(s)
* Matière(s) enseignée(s)
* Date d'embauche
* Type de contrat (permanent, vacataire, stagiaire)
* Téléphone et adresse
* Salaire de base
* Heures par semaine
* Photo

Fonctionnalités :
* Affectation aux classes et aux matières
* Gestion du planning et des présences
* Historique des cours dispensés
* Calcul automatique des heures effectuées
* Génération de code d'accès pour l'application mobile

---

## 7. MODULE DE GESTION DES CLASSES

Fonctionnalités :
* Création des niveaux (ex. : Primaire, Collège, Lycée)
* Création des classes avec capacité maximale
* Affectation des élèves aux classes
* Désignation du professeur principal
* Suivi du taux de remplissage
* Liste de classe imprimable
* Photo de classe

Exemples de niveaux configurables :
* 1ère Année, 2ème Année... (Primaire)
* 6ème, 5ème, 4ème, 3ème (Collège)
* 2nde, 1ère, Terminale (Lycée)
* Terminale A, Terminale C, Terminale D (filières)

---

## 8. MODULE DE GESTION DES MATIÈRES

Informations :
* Nom de la matière
* Code court (ex. : MATH, FR, SVT)
* Coefficient (par classe/niveau)
* Enseignant(s) responsable(s)
* Volume horaire hebdomadaire
* Type (fondamentale, optionnelle)

Fonctionnalités :
* Association à plusieurs classes avec coefficients différents
* Historique des notes par matière
* Statistiques de performance par matière

---

## 9. MODULE DE GESTION DES NOTES

### 9.1 Types d'évaluations (configurables)

* Interrogation
* Devoir surveillé
* Contrôle continu
* Travaux pratiques (TP)
* Examen semestriel / trimestriel
* Composition finale

### 9.2 Fonctionnalités

* Saisie des notes par l'enseignant (desktop ou mobile)
* Saisie par classe et par matière
* Import de notes depuis Excel (fichier `.xlsx`)
* Calcul automatique des moyennes par matière
* Calcul automatique de la moyenne générale pondérée par les coefficients
* Classement automatique des élèves dans la classe
* Classement dans le niveau
* Détection des meilleures notes (1er, 2ème, 3ème)
* Appréciations automatiques configurables
* Verrouillage des notes après validation par le directeur

### 9.3 Calculs automatiques

| Calcul | Formule |
|---|---|
| Moyenne matière | (somme des notes × pondération) / nombre d'évaluations |
| Moyenne générale | Σ(moyenne matière × coefficient) / Σ coefficients |
| Rang | Classement par moyenne générale décroissante |
| Appréciation | Configurée par tranches (ex : 16-20 = Très Bien) |

### 9.4 Périodes scolaires

Configurables selon le système de l'établissement :
* **Trimestriel** : 3 trimestres
* **Semestriel** : 2 semestres
* **Annuel** : 1 seule période

---

## 10. MODULE DES BULLETINS

### 10.1 Génération automatique

* Bulletin trimestriel
* Bulletin semestriel
* Bulletin de fin d'année

### 10.2 Contenu du bulletin

* En-tête avec logo et informations de l'école
* Informations de l'élève (nom, classe, matricule, photo optionnelle)
* Tableau des notes par matière (notes, coefficients, moyennes, appréciations)
* Moyenne générale et rang dans la classe
* Appréciation du conseil de classe / professeur principal
* Nombre d'absences de la période
* Décision de passage (Admis, Redouble, Passage conditionnel)
* Signature numérique du directeur
* QR Code de vérification d'authenticité

### 10.3 Export et impression

* Export PDF haute qualité
* Impression directe depuis le logiciel
* Impression en masse (toute une classe en un clic)
* Envoi vers l'application mobile des parents

### 10.4 Validation

* Workflow de validation : Enseignant → Directeur
* Verrouillage après signature du directeur
* Traçabilité de la validation

---

## 11. MODULE DE GESTION DES ABSENCES

### 11.1 Fonctionnalités

* Saisie des absences par cours, par demi-journée ou par journée
* Gestion des retards
* Gestion des sorties anticipées
* Justification des absences (avec pièce jointe possible)

### 11.2 Types d'absences

* Justifiée (avec motif et justificatif)
* Non justifiée
* Retard
* Sortie anticipée

### 11.3 Alertes et seuils

* Alerte automatique à partir d'un nombre d'absences configurable
* Notification au parent via l'application mobile
* Notification SMS (optionnel, via modem GSM local)

### 11.4 Rapports

* Rapport quotidien des absences
* Rapport hebdomadaire
* Rapport mensuel
* Rapport par élève
* Rapport par classe
* Liste des élèves dépassant le seuil d'absences

---

## 12. MODULE D'EMPLOI DU TEMPS

### 12.1 Fonctionnalités

* Création graphique de l'emploi du temps (drag & drop)
* Gestion des salles (affectation, capacité)
* Détection automatique des conflits horaires (enseignant, salle, classe)
* Copie de l'emploi du temps d'une semaine à l'autre

### 12.2 Affichages disponibles

* Par enseignant
* Par classe
* Par salle
* Vue semaine complète

### 12.3 Export et impression

* Export PDF par classe ou par enseignant
* Affichage sur l'application mobile des enseignants et élèves

---

## 13. MODULE FINANCIER

### 13.1 Types de frais scolaires (configurables)

* Frais d'inscription (nouvel élève)
* Frais de réinscription
* Frais de scolarité (trimestriel/mensuel/annuel)
* Frais de cantine
* Frais de transport
* Frais d'uniforme
* Frais d'examens
* Autres frais personnalisables

### 13.2 Modes de paiement

* Espèces
* Orange Money
* Wave
* Mobile Money
* Carte bancaire
* Virement bancaire
* Chèque

### 13.3 Fonctionnalités paiements

* Paiement partiel avec solde restant
* Paiement complet
* Historique complet des paiements
* Suivi des impayés par élève
* Relances automatiques (notification mobile)
* Remises et exonérations (avec motif)
* Plan de paiement échelonné

### 13.4 Reçus de paiement

Contenu :
* Numéro de reçu unique (séquentiel)
* Nom et matricule de l'élève
* Classe
* Type de frais payé
* Montant payé
* Solde restant
* Date et heure
* Nom du caissier
* QR Code de vérification
* Signature numérique

Export : PDF — Impression directe (ticket ou format A5/A4)

### 13.5 Gestion de la caisse

* Ouverture et fermeture de caisse journalière
* Solde d'ouverture et de fermeture
* Rapport journalier de caisse
* Contrôle des écarts

### 13.6 Rapports financiers

* Rapport journalier des encaissements
* Rapport mensuel
* Rapport annuel
* Rapport par type de frais
* Tableau des impayés (avec montants et délais)
* Prévisions de recettes
* Export Excel et PDF

---

## 14. MODULE DE PAIE DU PERSONNEL

### 14.1 Fonctionnalités

* Gestion des salaires de base
* Ajout de primes (transport, logement, performance)
* Gestion des avances sur salaire
* Déductions (absences, sanctions, cotisations)
* Calcul automatique du net à payer

### 14.2 Bulletins de salaire

Contenu :
* Informations de l'employé
* Détail des éléments de rémunération
* Total brut et net
* Déductions
* Signature

Export PDF et impression.

---

## 15. MODULE DE BIBLIOTHÈQUE

### 15.1 Gestion du fonds documentaire

* Catalogue des livres (titre, auteur, ISBN, catégorie, nombre d'exemplaires)
* QR Code par exemplaire
* Localisation dans les rayons

### 15.2 Prêts et retours

* Enregistrement des emprunts (élève + livre + date de retour prévue)
* Enregistrement des retours
* Alertes pour les retards de retour
* Amendes pour retard (configurable)
* Historique des emprunts par élève

---

## 16. MODULE D'INFIRMERIE

### 16.1 Fonctionnalités

* Dossier médical de base par élève (allergies, groupe sanguin, antécédents)
* Enregistrement des consultations
* Suivi des vaccinations
* Gestion des urgences avec alerte aux parents
* Stock de médicaments de base

---

## 17. MODULE DE TRANSPORT SCOLAIRE

### 17.1 Fonctionnalités

* Gestion des bus et véhicules (immatriculation, capacité)
* Gestion des chauffeurs
* Définition des circuits et arrêts
* Affectation des élèves aux circuits
* Suivi des présences dans le bus
* Facturation du transport (liée au module financier)

---

## 18. MODULE DE COMMUNICATION

### 18.1 Notifications internes (application mobile)

* Notifications push vers les parents
* Notifications push vers les élèves
* Notifications push vers les enseignants

### 18.2 Types de notifications automatiques

* Absence de l'élève détectée
* Résultats disponibles (bulletin publié)
* Paiement en retard (relance)
* Emploi du temps modifié
* Convocation (réunion parents-professeurs)
* Fermeture exceptionnelle de l'école

### 18.3 SMS (optionnel)

* Envoi via modem GSM connecté au PC
* Ou via API SMS locale (Twilio, etc.)

### 18.4 Messagerie interne

* Messagerie entre la direction et les parents
* Messagerie entre la direction et les enseignants
* Conservée localement

---

## 19. MODULE DE DOCUMENTS OFFICIELS

### 19.1 Documents générés automatiquement

Tous les documents sont générés en PDF, prêts à imprimer :

* **Certificat de scolarité** (avec QR Code de vérification)
* **Attestation de fréquentation**
* **Relevé de notes** (cumulatif)
* **Attestation de réussite**
* **Carte scolaire** (format carte de crédit, avec photo et QR Code)
* **Attestation de transfert** (pour les élèves quittant l'école)
* **Convocation aux examens**

### 19.2 Personnalisation

* En-tête configurable (logo, nom de l'école, adresse)
* Pied de page configurable
* Signature numérique du directeur
* Cachet de l'école (image uploadée)

---

## 20. MODULE DE TABLEAU DE BORD

### 20.1 Statistiques en temps réel

Indicateurs affichés :
* Nombre total d'élèves inscrits (par sexe)
* Nombre d'enseignants
* Taux d'occupation des classes
* Recettes du mois (encaissé vs attendu)
* Dépenses du mois
* Taux de présence du jour
* Nombre d'absences non justifiées
* Taux de réussite global

### 20.2 Graphiques

* Évolution des résultats scolaires (par trimestre)
* Évolution financière (recettes vs dépenses)
* Répartition des élèves par classe et par sexe
* Taux de paiement par type de frais
* Évolution du taux de présence

### 20.3 Alertes du tableau de bord

* Élèves avec trop d'absences
* Paiements en retard dépassant un seuil
* Bulletins non encore validés
* Emplois du temps incomplets

---

## 21. MODULE DE SÉCURITÉ ET SAUVEGARDE

### 21.1 Authentification

* Login / mot de passe pour chaque utilisateur
* Mots de passe hashés avec **bcrypt**
* Session locale avec **JWT** (expirant après inactivité)
* Double authentification optionnelle (code PIN envoyé par SMS)

### 21.2 Gestion des permissions

* Permissions fines par rôle (lecture, écriture, validation, suppression)
* Permissions personnalisables par utilisateur
* Accès restreint aux données sensibles (salaires, finances)

### 21.3 Journal d'activité (Audit Log)

* Toutes les actions importantes sont enregistrées
* Qui a fait quoi et quand
* Impossible de modifier ou supprimer le journal
* Export du journal en CSV

### 21.4 Sauvegarde et restauration

* **Sauvegarde manuelle** : export du fichier `.db` vers USB ou dossier local
* **Sauvegarde automatique** : copie planifiée (quotidienne, hebdomadaire)
* **Restauration** : import d'une sauvegarde `.db`
* **Export complet** : toutes les données en Excel/CSV
* Notification si aucune sauvegarde depuis X jours

### 21.5 Mise à jour du logiciel

* Vérification automatique des mises à jour au démarrage (si internet disponible)
* Mise à jour silencieuse en arrière-plan
* Ou mise à jour manuelle via fichier d'installation `.exe`

---

## 22. APPLICATION MOBILE (React Native + Expo)

### 22.1 Profil Parent

* Connexion avec code d'accès fourni par l'école
* Tableau de bord de l'enfant (ou des enfants)
* Notes et moyennes par matière
* Bulletins téléchargeables (PDF)
* Absences et retards
* Paiements effectués et solde restant
* Notifications push
* Messagerie avec la direction

### 22.2 Profil Enseignant

* Connexion avec identifiants fournis par l'école
* Emploi du temps de la semaine
* Saisie des notes (par classe, par matière)
* Saisie des absences
* Cahier de texte numérique
* Notifications importantes

### 22.3 Profil Élève

* Consultation des notes
* Emploi du temps
* Bulletins
* Documents téléchargeables
* Notifications

### 22.4 Synchronisation Mobile ↔ Desktop

* Le mobile **lit les données** depuis le même réseau local (WiFi de l'école)
* L'application desktop agit comme **serveur local** sur le réseau Wi-Fi
* Pas besoin d'internet : tout fonctionne sur le réseau local de l'école
* Ou synchronisation via export/import de fichiers

---

## 23. FONCTIONNALITÉS AVANCÉES

* QR Code sur chaque carte scolaire et chaque bulletin
* Signature électronique des bulletins et documents officiels
* Archivage numérique illimité (limité par la capacité du disque)
* Scan des documents (intégration webcam/scanner)
* Export Excel/PDF pour tous les rapports
* Multi-années scolaires (historique conservé)
* Mode sombre / mode clair
* Interface multilingue (Français, Anglais — extensible)
* Multi-devises (configurable selon le pays)
* **Intelligence artificielle** : détection des élèves à risque d'échec (basée sur l'historique des notes)
* Génération automatique des appréciations selon les moyennes
* Portail parent dédié (application mobile)
* Portail enseignant dédié (application mobile)
* Gestion des concours et examens nationaux
* Gestion des internats (chambres, pensionnaires)
* Gestion de la cantine scolaire (menus, abonnements)
* Gestion des clubs et activités parascolaires
* Gestion des sanctions disciplinaires (conseil de discipline)
* Gestion des récompenses et distinctions (palmarès)
* Gestion des réunions parents-professeurs (convocations, comptes rendus)
* Raccourcis clavier pour les actions fréquentes
* Aide contextuelle intégrée

---

## 24. SPÉCIFICATIONS TECHNIQUES DÉTAILLÉES

### 24.0 Paramètres spécifiques au déploiement

| Paramètre | Valeur |
|---|---|
#### Identité

| Paramètre | Valeur confirmée |
|---|---|
| Nom de l'application | **SGSI** (Système de Gestion Scolaire Intégré) |
| Logo | À créer (pas de logo existant) |
| Slogan | **"Le numérique au service de l'éducation"** |
| Pays cible | **Guinée (République de Guinée)** |
| Devise par défaut | **GNF (Franc Guinéen)** |
| Langue par défaut | **Français** |

#### Interface

| Paramètre | Valeur confirmée |
|---|---|
| Couleur primaire | **Bleu professionnel** (#1E40AF / #3B82F6) |
| Thème | **Clair et Sombre** — l'utilisateur peut basculer à tout moment |

#### Pédagogie

| Paramètre | Valeur confirmée |
|---|---|
| Échelle de notation | **0 à 20** (Très Bien ≥ 16 / Bien ≥ 14 / Assez Bien ≥ 12 / Passable ≥ 10 / Insuffisant < 10) |
| Calcul moyenne matière | **Pondéré configurable** par type d'évaluation |
| Coefficients évaluations | **Configurables** par école (ex : Interro=1, Devoir=2, Examen=3) |
| Note éliminatoire | **Oui** — seuil configurable par école (ex : < 5/20 → redoublement automatique) |
| Règle de passage | **Configurable** par école dans les paramètres |
| Découpage de l'année | **Configurable** (Trimestriel ou Semestriel) |
| Niveaux scolaires | **Entièrement configurables** par l'administrateur |
| Historique années | **Complet** — toutes les années conservées et imprimables |
| Examens nationaux | **Oui** — CFEE, BEPC, BAC (système guinéen) |
| Appréciation bulletin | Saisie par le **professeur principal** |
| Modèle de bulletin | À reproduire — modèle existant à transmettre |

#### Élèves & Matricule

| Paramètre | Valeur confirmée |
|---|---|
| Format matricule | `[SIGLE_ÉCOLE][1ère lettre Nom][1ère lettre Prénom]-[ANNÉE]-[0001]` |
| Exemple | `LGAB-2024-0001` (Lycée Gamal · Amadou Bah · 2024 · 1er élève) |

#### Finance

| Paramètre | Valeur confirmée |
|---|---|
| Frais scolaires | Définis **par niveau** (pas par classe) |
| Paiement échelonné | **Configurable** — calendrier de paiement en plusieurs tranches |
| Format numéro de reçu | `REC-[MOIS]-[ANNÉE]-[001]` ex : `REC-06-2024-001` |
| Bourses / exonérations | **Configurables** par école |

#### Utilisateurs & Sécurité

| Paramètre | Valeur confirmée |
|---|---|
| Multi-rôles | **Configurable** — un utilisateur peut avoir plusieurs rôles |
| Session automatique | **Oui** — l'utilisateur reste connecté entre les redémarrages |
| Récupération mot de passe | Double auth → Super Admin approuve → mot de passe temporaire **valable 24h** à changer obligatoirement |

#### Documents

| Paramètre | Valeur confirmée |
|---|---|
| QR Code | **Sur tous les documents** officiels |
| Format légal | **Configurable** par école |

#### Mobile

| Paramètre | Valeur confirmée |
|---|---|
| Saisie notes hors ligne | **Oui** — synchronisation différée quand Wi-Fi disponible |
| Bulletins PDF mobile | **Oui** — téléchargeables par les parents |
| Code accès parent | Distribué par **SMS** — login = **matricule de l'enfant** |

#### Sauvegarde

| Paramètre | Valeur confirmée |
|---|---|
| Fréquence auto | **Quotidienne** |
| Format | **Deux formats** : fichier `.db` seul + fichier `.zip` (avec photos et documents) |

#### Déploiement & Licence

| Paramètre | Valeur confirmée |
|---|---|
| Distribution | **Multi-écoles** — vendu/distribué à plusieurs établissements |
| Système de licence | **Oui** — activation par clé de licence |
| Version démo | **Oui** — avec données fictives pour présentation commerciale |

#### Technique

| Paramètre | Valeur confirmée |
|---|---|
| Package manager | **npm** (npm workspaces) |
| Node.js | **v24.14.1** |
| Internet pendant dev | **Oui** |
| Dossier projet | `C:\Users\LambertMILLIMONO\Desktop\SGSI` |

---

### 24.1 Configuration minimale recommandée (Desktop)

| Composant | Minimum | Recommandé |
|---|---|---|
| OS | Windows 10 64-bit | Windows 11 64-bit |
| RAM | 4 Go | 8 Go |
| Disque | 2 Go libres | 10 Go libres |
| Processeur | Intel Core i3 | Intel Core i5 |
| Résolution | 1280×720 | 1920×1080 |
| Réseau local | Optionnel | Wi-Fi pour mobile |

### 24.2 Configuration mobile

| Composant | Minimum |
|---|---|
| Android | Version 8.0 (Oreo) |
| iOS | Version 13 |
| RAM | 2 Go |
| Stockage | 200 Mo libres |

### 24.3 Structure du projet (Monorepo)

```
schoolmanager-pro/
├── apps/
│   ├── desktop/          # Application Electron
│   │   ├── src/
│   │   │   ├── main/     # Main process Electron
│   │   │   └── renderer/ # React UI
│   │   └── electron-builder.config.js
│   └── mobile/           # Application React Native + Expo
│       └── src/
├── packages/
│   ├── shared/           # Logique métier partagée (TypeScript)
│   ├── db/               # Schéma Prisma + migrations SQLite
│   └── ui/               # Composants UI partagés (si possible)
├── package.json          # Workspace (pnpm ou npm workspaces)
└── turbo.json            # Turborepo (build orchestration)
```

---

## 25. PLANNING DE DÉVELOPPEMENT SUGGÉRÉ

### Phase 1 — Fondations (2-3 semaines)
* Mise en place du monorepo
* Configuration Electron + React + Vite + Tailwind
* Mise en place de Prisma + SQLite
* Système d'authentification (login, rôles, permissions)
* Tableau de bord vide

### Phase 2 — Modules de base (4-6 semaines)
* Module Élèves (inscription, réinscription, dossier)
* Module Classes et Matières
* Module Enseignants
* Module Notes et Bulletins

### Phase 3 — Modules financiers (2-3 semaines)
* Module Paiements et Reçus
* Module Comptabilité et Rapports financiers
* Module Paie du personnel

### Phase 4 — Modules secondaires (3-4 semaines)
* Module Absences
* Module Emploi du temps
* Module Documents officiels
* Module Communication

### Phase 5 — Application mobile (3-4 semaines)
* Application React Native (Expo)
* Profils Parent, Enseignant, Élève
* Synchronisation réseau local

### Phase 6 — Finitions (2 semaines)
* Génération des installateurs (`.exe`, `.apk`)
* Tests complets
* Documentation utilisateur
* Système de mise à jour automatique

---

---

## 26. ARCHITECTURE TECHNIQUE COMPLÈTE

---

### 26.1 Vue d'ensemble du système

```
┌─────────────────────────────────────────────────────────────────┐
│                        RÉSEAU LOCAL (Wi-Fi)                      │
│                                                                   │
│  ┌──────────────────────────────┐   ┌──────────────────────────┐ │
│  │     PC WINDOWS (Desktop)     │   │    TÉLÉPHONE (Mobile)    │ │
│  │                              │   │                          │ │
│  │  ┌────────────────────────┐  │   │  ┌────────────────────┐  │ │
│  │  │   Electron App (.exe)  │  │   │  │  Expo App (.apk)   │  │ │
│  │  │                        │  │   │  │                    │  │ │
│  │  │  ┌──────────────────┐  │  │   │  │  React Native UI   │  │ │
│  │  │  │  React UI        │  │  │   │  │  expo-sqlite       │  │ │
│  │  │  │  (Renderer)      │  │◄─┼───┼─►│  (cache local)     │  │ │
│  │  │  └────────┬─────────┘  │  │   │  └────────────────────┘  │ │
│  │  │           │ IPC        │  │   └──────────────────────────┘ │
│  │  │  ┌────────▼─────────┐  │  │                                │
│  │  │  │  Node.js Main    │  │  │                                │
│  │  │  │  Process         │  │  │                                │
│  │  │  │  ┌─────────────┐ │  │  │                                │
│  │  │  │  │ SQLite DB   │ │  │  │                                │
│  │  │  │  │ (Prisma)    │ │  │  │                                │
│  │  │  │  └─────────────┘ │  │  │                                │
│  │  │  │  ┌─────────────┐ │  │  │                                │
│  │  │  │  │ HTTP Server │ │  │  │                                │
│  │  │  │  │ (Express)   │─┼──┼──┤                                │
│  │  │  │  └─────────────┘ │  │  │                                │
│  │  │  └──────────────────┘  │  │                                │
│  │  └────────────────────────┘  │                                │
│  └──────────────────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

### 26.2 Structure complète du monorepo

```
schoolmanager-pro/
│
├── apps/
│   │
│   ├── desktop/                          # Application Electron
│   │   ├── src/
│   │   │   ├── main/                     # Main Process (Node.js)
│   │   │   │   ├── index.ts              # Point d'entrée Electron
│   │   │   │   ├── window.ts             # Création fenêtre BrowserWindow
│   │   │   │   ├── tray.ts               # Icône systray
│   │   │   │   ├── updater.ts            # Mise à jour automatique
│   │   │   │   │
│   │   │   │   ├── ipc/                  # Handlers IPC (pont main ↔ renderer)
│   │   │   │   │   ├── index.ts          # Enregistrement de tous les handlers
│   │   │   │   │   ├── auth.ipc.ts       # IPC authentification
│   │   │   │   │   ├── students.ipc.ts   # IPC élèves
│   │   │   │   │   ├── classes.ipc.ts    # IPC classes
│   │   │   │   │   ├── grades.ipc.ts     # IPC notes
│   │   │   │   │   ├── payments.ipc.ts   # IPC paiements
│   │   │   │   │   ├── reports.ipc.ts    # IPC rapports/PDF
│   │   │   │   │   ├── backup.ipc.ts     # IPC sauvegarde
│   │   │   │   │   └── print.ipc.ts      # IPC impression
│   │   │   │   │
│   │   │   │   ├── services/             # Logique métier côté main
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── student.service.ts
│   │   │   │   │   ├── class.service.ts
│   │   │   │   │   ├── grade.service.ts
│   │   │   │   │   ├── bulletin.service.ts
│   │   │   │   │   ├── payment.service.ts
│   │   │   │   │   ├── report.service.ts
│   │   │   │   │   ├── backup.service.ts
│   │   │   │   │   └── pdf.service.ts    # Génération PDF (Puppeteer)
│   │   │   │   │
│   │   │   │   ├── database/             # Connexion Prisma
│   │   │   │   │   ├── client.ts         # Instance Prisma singleton
│   │   │   │   │   └── seed.ts           # Données initiales
│   │   │   │   │
│   │   │   │   └── server/               # Serveur HTTP local (sync mobile)
│   │   │   │       ├── index.ts          # Express app
│   │   │   │       ├── middleware/
│   │   │   │       │   ├── auth.middleware.ts
│   │   │   │       │   └── cors.middleware.ts
│   │   │   │       └── routes/
│   │   │   │           ├── students.routes.ts
│   │   │   │           ├── grades.routes.ts
│   │   │   │           ├── bulletins.routes.ts
│   │   │   │           └── payments.routes.ts
│   │   │   │
│   │   │   └── renderer/                 # Renderer Process (React)
│   │   │       ├── index.html
│   │   │       ├── main.tsx              # Point d'entrée React
│   │   │       │
│   │   │       ├── pages/                # Pages de l'application
│   │   │       │   ├── auth/
│   │   │       │   │   └── LoginPage.tsx
│   │   │       │   ├── dashboard/
│   │   │       │   │   └── DashboardPage.tsx
│   │   │       │   ├── students/
│   │   │       │   │   ├── StudentsListPage.tsx
│   │   │       │   │   ├── StudentFormPage.tsx
│   │   │       │   │   └── StudentProfilePage.tsx
│   │   │       │   ├── classes/
│   │   │       │   ├── grades/
│   │   │       │   ├── bulletins/
│   │   │       │   ├── payments/
│   │   │       │   ├── absences/
│   │   │       │   ├── schedule/
│   │   │       │   ├── staff/
│   │   │       │   ├── reports/
│   │   │       │   └── settings/
│   │   │       │
│   │   │       ├── components/           # Composants réutilisables
│   │   │       │   ├── layout/
│   │   │       │   │   ├── Sidebar.tsx
│   │   │       │   │   ├── Header.tsx
│   │   │       │   │   ├── MainLayout.tsx
│   │   │       │   │   └── AuthLayout.tsx
│   │   │       │   ├── ui/               # Atomes UI (boutons, inputs...)
│   │   │       │   │   ├── Button.tsx
│   │   │       │   │   ├── Input.tsx
│   │   │       │   │   ├── Modal.tsx
│   │   │       │   │   ├── Table.tsx
│   │   │       │   │   ├── Card.tsx
│   │   │       │   │   ├── Badge.tsx
│   │   │       │   │   ├── Select.tsx
│   │   │       │   │   └── DatePicker.tsx
│   │   │       │   ├── forms/            # Formulaires métier
│   │   │       │   │   ├── StudentForm.tsx
│   │   │       │   │   ├── GradeForm.tsx
│   │   │       │   │   └── PaymentForm.tsx
│   │   │       │   └── charts/           # Graphiques dashboard
│   │   │       │       ├── RevenueChart.tsx
│   │   │       │       ├── GradesChart.tsx
│   │   │       │       └── AttendanceChart.tsx
│   │   │       │
│   │   │       ├── store/                # Redux Store
│   │   │       │   ├── index.ts          # Configuration du store
│   │   │       │   └── slices/
│   │   │       │       ├── authSlice.ts
│   │   │       │       ├── studentSlice.ts
│   │   │       │       ├── classSlice.ts
│   │   │       │       ├── gradeSlice.ts
│   │   │       │       ├── paymentSlice.ts
│   │   │       │       ├── absenceSlice.ts
│   │   │       │       └── uiSlice.ts
│   │   │       │
│   │   │       ├── hooks/                # Custom React hooks
│   │   │       │   ├── useIpc.ts         # Hook pour appels IPC
│   │   │       │   ├── useStudents.ts
│   │   │       │   ├── useAuth.ts
│   │   │       │   └── usePrint.ts
│   │   │       │
│   │   │       ├── bridge/               # Pont IPC renderer → main
│   │   │       │   ├── index.ts
│   │   │       │   ├── auth.bridge.ts
│   │   │       │   ├── students.bridge.ts
│   │   │       │   └── payments.bridge.ts
│   │   │       │
│   │   │       ├── router/               # React Router
│   │   │       │   └── index.tsx
│   │   │       │
│   │   │       └── utils/
│   │   │           ├── formatters.ts     # Formatage dates, montants
│   │   │           ├── validators.ts     # Validation formulaires
│   │   │           └── constants.ts
│   │   │
│   │   ├── electron-builder.config.js    # Config packaging .exe
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── mobile/                           # Application React Native + Expo
│       ├── app/                          # Expo Router (file-based routing)
│       │   ├── _layout.tsx               # Layout racine
│       │   ├── (auth)/
│       │   │   └── login.tsx
│       │   ├── (parent)/
│       │   │   ├── _layout.tsx
│       │   │   ├── dashboard.tsx
│       │   │   ├── grades.tsx
│       │   │   ├── absences.tsx
│       │   │   ├── payments.tsx
│       │   │   └── bulletins.tsx
│       │   ├── (teacher)/
│       │   │   ├── _layout.tsx
│       │   │   ├── dashboard.tsx
│       │   │   ├── schedule.tsx
│       │   │   ├── grades-entry.tsx
│       │   │   └── absences-entry.tsx
│       │   └── (student)/
│       │       ├── dashboard.tsx
│       │       ├── grades.tsx
│       │       └── schedule.tsx
│       │
│       ├── components/
│       │   ├── ui/
│       │   ├── GradeCard.tsx
│       │   ├── AbsenceItem.tsx
│       │   └── PaymentStatus.tsx
│       │
│       ├── store/                        # Redux (partagé avec desktop)
│       ├── services/
│       │   └── api.service.ts            # Appels HTTP vers desktop
│       ├── hooks/
│       ├── app.json                      # Config Expo
│       ├── eas.json                      # Config Expo EAS Build
│       └── package.json
│
├── packages/
│   │
│   ├── shared/                           # Code partagé TypeScript
│   │   ├── src/
│   │   │   ├── types/                    # Interfaces TypeScript
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── student.types.ts
│   │   │   │   ├── class.types.ts
│   │   │   │   ├── grade.types.ts
│   │   │   │   ├── payment.types.ts
│   │   │   │   ├── bulletin.types.ts
│   │   │   │   ├── absence.types.ts
│   │   │   │   └── api.types.ts          # Types requêtes/réponses API
│   │   │   └── utils/
│   │   │       ├── grade.utils.ts        # Calcul moyennes, rangs
│   │   │       ├── date.utils.ts
│   │   │       └── string.utils.ts
│   │   └── package.json
│   │
│   └── db/                               # Base de données (Prisma)
│       ├── prisma/
│       │   ├── schema.prisma             # Schéma complet SQLite
│       │   └── migrations/               # Historique des migrations
│       ├── src/
│       │   └── client.ts                 # Export du client Prisma
│       └── package.json
│
├── package.json                          # Workspace racine (pnpm)
├── pnpm-workspace.yaml
├── turbo.json                            # Turborepo
└── tsconfig.base.json                    # TypeScript config partagée
```

---

### 26.3 Architecture Electron — Flux IPC

Le cœur du desktop repose sur la communication entre deux processus Electron :

```
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSUS RENDERER (React)                │
│                                                             │
│   Page/Component → Redux Action → Bridge IPC → window.api  │
│                                                             │
│   Exemple :                                                 │
│   StudentForm.tsx                                           │
│     → dispatch(createStudent(data))                         │
│     → createAsyncThunk → window.api.students.create(data)  │
└──────────────────────────┬──────────────────────────────────┘
                           │  contextBridge (preload.ts)
                           │  ipcRenderer.invoke('students:create', data)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PROCESSUS MAIN (Node.js)                  │
│                                                             │
│   ipcMain.handle('students:create', async (event, data) => {│
│     return await studentService.create(data)                │
│   })                                                        │
│                                                             │
│   studentService.create(data)                               │
│     → validation des données                                │
│     → prisma.student.create({ data })                       │
│     → auditLog.record('CREATE', 'student', userId)          │
│     → return student                                        │
└─────────────────────────────────────────────────────────────┘
```

**Canaux IPC définis :**

| Canal | Direction | Description |
|---|---|---|
| `auth:login` | R → M | Connexion utilisateur |
| `auth:logout` | R → M | Déconnexion |
| `students:list` | R → M | Liste des élèves |
| `students:create` | R → M | Créer un élève |
| `students:update` | R → M | Modifier un élève |
| `students:delete` | R → M | Supprimer un élève |
| `grades:save` | R → M | Enregistrer des notes |
| `bulletins:generate` | R → M | Générer un bulletin PDF |
| `payments:record` | R → M | Enregistrer un paiement |
| `reports:export` | R → M | Exporter un rapport Excel/PDF |
| `backup:create` | R → M | Créer une sauvegarde |
| `backup:restore` | R → M | Restaurer une sauvegarde |
| `print:document` | R → M | Imprimer un document |
| `db:notify` | M → R | Notification changement BDD |

---

### 26.4 Schéma de base de données (Prisma SQLite)

```prisma
// ─── CONFIGURATION ───────────────────────────────────────────

model School {
  id          String   @id @default(cuid())
  name        String
  logo        String?  // chemin fichier local
  address     String?
  phone       String?
  email       String?
  director    String?
  stamp       String?  // cachet numérique (image)
  currency    String   @default("XOF")
  language    String   @default("fr")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AcademicYear {
  id          String    @id @default(cuid())
  label       String    // ex: "2024-2025"
  startDate   DateTime
  endDate     DateTime
  isCurrent   Boolean   @default(false)
  periodType  String    @default("TRIMESTER") // TRIMESTER | SEMESTER
  students    Enrollment[]
  classes     Class[]
}

// ─── UTILISATEURS & SÉCURITÉ ─────────────────────────────────

model User {
  id          String    @id @default(cuid())
  username    String    @unique
  password    String    // bcrypt hash
  role        Role
  firstName   String
  lastName    String
  phone       String?
  email       String?
  isActive    Boolean   @default(true)
  lastLogin   DateTime?
  createdAt   DateTime  @default(now())
  auditLogs   AuditLog[]
  teacher     Teacher?
}

enum Role {
  SUPER_ADMIN
  DIRECTOR
  SECRETARY
  ACCOUNTANT
  TEACHER
}

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String   // CREATE | UPDATE | DELETE | LOGIN | LOGOUT | PRINT
  entity      String   // ex: "student", "payment"
  entityId    String?
  details     String?  // JSON des changements
  createdAt   DateTime @default(now())
}

// ─── NIVEAUX & CLASSES ───────────────────────────────────────

model Level {
  id      String  @id @default(cuid())
  name    String  // ex: "Primaire", "Collège"
  order   Int
  classes Class[]
}

model Class {
  id             String       @id @default(cuid())
  name           String       // ex: "6ème A"
  levelId        String
  level          Level        @relation(fields: [levelId], references: [id])
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  maxStudents    Int          @default(40)
  teacherId      String?      // professeur principal
  teacher        Teacher?     @relation(fields: [teacherId], references: [id])
  enrollments    Enrollment[]
  schedules      Schedule[]
  subjects       ClassSubject[]
}

// ─── MATIÈRES ────────────────────────────────────────────────

model Subject {
  id       String         @id @default(cuid())
  name     String
  code     String         @unique
  classes  ClassSubject[]
  grades   Grade[]
}

model ClassSubject {
  id          String   @id @default(cuid())
  classId     String
  class       Class    @relation(fields: [classId], references: [id])
  subjectId   String
  subject     Subject  @relation(fields: [subjectId], references: [id])
  coefficient Float    @default(1)
  hoursPerWeek Int     @default(2)
  teacherId   String?
  teacher     Teacher? @relation(fields: [teacherId], references: [id])
}

// ─── ÉLÈVES ──────────────────────────────────────────────────

model Student {
  id           String       @id @default(cuid())
  matricule    String       @unique
  firstName    String
  lastName     String
  gender       Gender
  birthDate    DateTime
  birthPlace   String?
  nationality  String?
  address      String?
  phone        String?
  email        String?
  photo        String?      // chemin fichier local
  qrCode       String?
  createdAt    DateTime     @default(now())
  enrollments  Enrollment[]
  parents      StudentParent[]
  documents    StudentDocument[]
  medicalRecord MedicalRecord?
}

enum Gender {
  MALE
  FEMALE
}

model Enrollment {
  id             String       @id @default(cuid())
  studentId      String
  student        Student      @relation(fields: [studentId], references: [id])
  classId        String
  class          Class        @relation(fields: [classId], references: [id])
  academicYearId String
  academicYear   AcademicYear @relation(fields: [academicYearId], references: [id])
  enrolledAt     DateTime     @default(now())
  status         EnrollStatus @default(ACTIVE)
  grades         Grade[]
  absences       Absence[]
  bulletins      Bulletin[]
  payments       Payment[]
}

enum EnrollStatus {
  ACTIVE
  TRANSFERRED
  GRADUATED
  EXPELLED
}

model StudentDocument {
  id         String   @id @default(cuid())
  studentId  String
  student    Student  @relation(fields: [studentId], references: [id])
  type       String   // "birth_certificate" | "transfer" | "photo" | "medical"
  filePath   String
  uploadedAt DateTime @default(now())
}

// ─── PARENTS ─────────────────────────────────────────────────

model Parent {
  id          String         @id @default(cuid())
  firstName   String
  lastName    String
  relation    String         // "FATHER" | "MOTHER" | "GUARDIAN"
  phone       String
  phone2      String?
  address     String?
  profession  String?
  email       String?
  accessCode  String?        @unique // Code accès app mobile
  students    StudentParent[]
}

model StudentParent {
  studentId  String
  parentId   String
  student    Student @relation(fields: [studentId], references: [id])
  parent     Parent  @relation(fields: [parentId], references: [id])
  @@id([studentId, parentId])
}

// ─── ENSEIGNANTS ─────────────────────────────────────────────

model Teacher {
  id          String         @id @default(cuid())
  matricule   String         @unique
  userId      String         @unique
  user        User           @relation(fields: [userId], references: [id])
  diploma     String?
  hireDate    DateTime?
  contractType String?       // "PERMANENT" | "PART_TIME" | "INTERN"
  baseSalary  Float          @default(0)
  hoursPerWeek Int           @default(0)
  subjects    ClassSubject[]
  homeClasses Class[]
  schedules   Schedule[]
  salaries    Salary[]
}

// ─── NOTES ───────────────────────────────────────────────────

model Grade {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  subjectId    String
  subject      Subject    @relation(fields: [subjectId], references: [id])
  period       Int        // 1, 2 ou 3 (trimestre/semestre)
  evalType     EvalType
  value        Float
  maxValue     Float      @default(20)
  weight       Float      @default(1)
  enteredAt    DateTime   @default(now())
  isLocked     Boolean    @default(false)
}

enum EvalType {
  INTERROGATION
  DEVOIR
  CONTROLE
  TP
  EXAM
}

// ─── BULLETINS ───────────────────────────────────────────────

model Bulletin {
  id              String     @id @default(cuid())
  enrollmentId    String
  enrollment      Enrollment @relation(fields: [enrollmentId], references: [id])
  period          Int
  generalAverage  Float
  rank            Int
  totalStudents   Int
  appreciation    String?
  decision        String?    // "Admis" | "Redouble" | "Passage conditionnel"
  isValidated     Boolean    @default(false)
  validatedAt     DateTime?
  pdfPath         String?
  createdAt       DateTime   @default(now())
}

// ─── ABSENCES ────────────────────────────────────────────────

model Absence {
  id           String        @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment    @relation(fields: [enrollmentId], references: [id])
  date         DateTime
  type         AbsenceType
  justified    Boolean       @default(false)
  reason       String?
  justifFile   String?       // pièce jointe
  recordedAt   DateTime      @default(now())
}

enum AbsenceType {
  ABSENCE
  LATE
  EARLY_LEAVE
}

// ─── EMPLOI DU TEMPS ─────────────────────────────────────────

model Room {
  id        String     @id @default(cuid())
  name      String     @unique
  capacity  Int
  schedules Schedule[]
}

model Schedule {
  id         String   @id @default(cuid())
  classId    String
  class      Class    @relation(fields: [classId], references: [id])
  teacherId  String
  teacher    Teacher  @relation(fields: [teacherId], references: [id])
  roomId     String?
  room       Room?    @relation(fields: [roomId], references: [id])
  dayOfWeek  Int      // 1=Lundi ... 6=Samedi
  startTime  String   // "08:00"
  endTime    String   // "09:00"
  subjectName String
}

// ─── FINANCES ────────────────────────────────────────────────

model FeeType {
  id          String    @id @default(cuid())
  name        String    // "Scolarité", "Inscription", "Cantine"...
  amount      Float
  isRequired  Boolean   @default(true)
  payments    Payment[]
}

model Payment {
  id           String     @id @default(cuid())
  enrollmentId String
  enrollment   Enrollment @relation(fields: [enrollmentId], references: [id])
  feeTypeId    String
  feeType      FeeType    @relation(fields: [feeTypeId], references: [id])
  amount       Float
  method       PayMethod
  receiptNo    String     @unique
  cashierId    String
  note         String?
  paidAt       DateTime   @default(now())
}

enum PayMethod {
  CASH
  ORANGE_MONEY
  WAVE
  MOBILE_MONEY
  BANK_CARD
  BANK_TRANSFER
  CHECK
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
  id           String   @id @default(cuid())
  date         DateTime @unique
  openBalance  Float
  closeBalance Float?
  openedBy     String
  closedBy     String?
  isClosed     Boolean  @default(false)
}

// ─── PAIE ────────────────────────────────────────────────────

model Salary {
  id          String   @id @default(cuid())
  teacherId   String
  teacher     Teacher  @relation(fields: [teacherId], references: [id])
  month       Int
  year        Int
  baseSalary  Float
  bonuses     Float    @default(0)
  advances    Float    @default(0)
  deductions  Float    @default(0)
  netSalary   Float
  pdfPath     String?
  paidAt      DateTime?
  @@unique([teacherId, month, year])
}

// ─── BIBLIOTHÈQUE ────────────────────────────────────────────

model Book {
  id          String     @id @default(cuid())
  title       String
  author      String?
  isbn        String?    @unique
  category    String?
  copies      Int        @default(1)
  available   Int        @default(1)
  loans       BookLoan[]
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

// ─── MÉDICAL ─────────────────────────────────────────────────

model MedicalRecord {
  id           String    @id @default(cuid())
  studentId    String    @unique
  student      Student   @relation(fields: [studentId], references: [id])
  bloodType    String?
  allergies    String?
  conditions   String?
  emergencyContact String?
  consultations Consultation[]
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

// ─── TRANSPORT ───────────────────────────────────────────────

model Bus {
  id          String   @id @default(cuid())
  plate       String   @unique
  capacity    Int
  driver      String
  driverPhone String?
  routes      Route[]
}

model Route {
  id       String @id @default(cuid())
  busId    String
  bus      Bus    @relation(fields: [busId], references: [id])
  name     String
  stops    String // JSON array des arrêts
}

// ─── NOTIFICATIONS ───────────────────────────────────────────

model Notification {
  id        String   @id @default(cuid())
  target    String   // parentId | teacherId | "all"
  title     String
  body      String
  type      String   // "absence" | "grade" | "payment" | "bulletin"
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

### 26.5 Architecture Redux (State Management)

```
Redux Store
│
├── authSlice
│   ├── user: User | null
│   ├── isAuthenticated: boolean
│   └── permissions: string[]
│
├── studentSlice
│   ├── list: Student[]
│   ├── selected: Student | null
│   ├── loading: boolean
│   └── filters: { class, level, search }
│
├── classSlice
│   ├── classes: Class[]
│   ├── levels: Level[]
│   └── currentClass: Class | null
│
├── gradeSlice
│   ├── grades: Grade[]
│   ├── averages: { [enrollmentId]: number }
│   └── rankings: { [classId]: Ranking[] }
│
├── paymentSlice
│   ├── payments: Payment[]
│   ├── unpaid: UnpaidStudent[]
│   └── cashRegister: CashRegister | null
│
├── absenceSlice
│   ├── absences: Absence[]
│   └── dailySummary: DailySummary[]
│
├── bulletinSlice
│   ├── bulletins: Bulletin[]
│   └── pending: Bulletin[]       // bulletins à valider
│
└── uiSlice
    ├── theme: 'light' | 'dark'
    ├── sidebar: boolean
    ├── activeModal: string | null
    └── notifications: AppNotif[]
```

---

### 26.6 Architecture du serveur local (Sync Mobile)

```
Desktop (Express.js — port 3721)
│
├── GET  /api/status              → Vérification disponibilité
├── POST /api/auth/mobile-login   → Connexion parent/enseignant/élève
│
├── GET  /api/student/:id/grades  → Notes d'un élève
├── GET  /api/student/:id/absences → Absences
├── GET  /api/student/:id/payments → Paiements
├── GET  /api/student/:id/bulletin/:period → Bulletin PDF
│
├── GET  /api/teacher/:id/schedule → Emploi du temps
├── POST /api/teacher/:id/grades   → Saisie notes (mobile)
├── POST /api/teacher/:id/absences → Saisie absences (mobile)
│
└── GET  /api/notifications/:userId → Notifications

Sécurité du serveur local :
- Uniquement accessible sur le réseau local (bind sur 0.0.0.0)
- Token JWT avec expiration courte (2h)
- Rate limiting (éviter abus)
- HTTPS avec certificat auto-signé (optionnel)
```

**Découverte automatique du serveur (mobile) :**
```
Mobile (React Native)
  → Scan du réseau local (UDP broadcast)
  → Trouve l'IP du PC de l'école
  → Se connecte automatiquement
  → Ou : l'utilisateur saisit l'IP manuellement
```

---

### 26.7 Architecture Mobile (Expo Router)

```
apps/mobile/app/
│
├── _layout.tsx           → Provider Redux + thème + navigation
│
├── (auth)/
│   └── login.tsx         → Saisie code d'accès + IP du serveur
│
├── (parent)/             → Profil parent
│   ├── _layout.tsx       → Tab navigation (bas de l'écran)
│   ├── index.tsx         → Dashboard enfant (résumé)
│   ├── grades.tsx        → Notes par matière et période
│   ├── absences.tsx      → Historique absences
│   ├── payments.tsx      → Paiements effectués / restants
│   └── bulletins.tsx     → Bulletins PDF téléchargeables
│
├── (teacher)/            → Profil enseignant
│   ├── _layout.tsx
│   ├── index.tsx         → Emploi du temps du jour
│   ├── schedule.tsx      → Planning semaine complète
│   ├── classes.tsx       → Mes classes
│   ├── grades-entry.tsx  → Saisie des notes
│   └── absences-entry.tsx → Saisie des présences/absences
│
└── (student)/            → Profil élève
    ├── index.tsx         → Résumé
    ├── grades.tsx        → Mes notes
    ├── schedule.tsx      → Mon emploi du temps
    └── documents.tsx     → Mes documents
```

---

### 26.8 Flux de données complet — Exemple : Saisie d'une note

```
DESKTOP
  Enseignant ouvre la page "Saisie des notes"
    → React: dispatch(loadClass({ classId, subjectId, period }))
    → Redux Thunk → bridge.grades.list({ classId, subjectId, period })
    → IPC: ipcRenderer.invoke('grades:list', params)
    → Main Process: gradesService.list(params)
    → Prisma: prisma.grade.findMany({ where: { ... } })
    → Retourne les notes existantes
    → Redux: gradeSlice.setGrades(grades)
    → React: affiche le tableau de notes

  Enseignant saisit une note et valide
    → React: dispatch(saveGrade({ enrollmentId, value, ... }))
    → Redux Thunk → bridge.grades.save(gradeData)
    → IPC: ipcRenderer.invoke('grades:save', gradeData)
    → Main Process:
        gradeService.save(gradeData)
          → validate(gradeData)
          → prisma.grade.upsert({ ... })
          → auditLog.record('GRADE_SAVED', ...)
          → recalculate averages
        → return updatedGrade
    → Redux: gradeSlice.updateGrade(updatedGrade)
    → React: mise à jour en temps réel du tableau

MOBILE (parent consulte les notes)
  Parent ouvre l'app → notes de son enfant
    → API GET /api/student/:id/grades
    → Express → gradeService.getByStudent(studentId)
    → Prisma → retourne les notes
    → Mobile affiche les notes
```

---

### 26.9 Sécurité — Modèle de permissions

```
SUPER_ADMIN    → Tout (lecture + écriture + suppression + config)
DIRECTOR       → Tout en lecture + validation bulletins + rapports
SECRETARY      → Élèves (CRUD) + documents + absences
ACCOUNTANT     → Paiements (CRUD) + rapports financiers
TEACHER        → Notes (CRUD ses matières) + absences ses classes

Matrice des permissions :

Module          SUPER_ADMIN  DIRECTOR  SECRETARY  ACCOUNTANT  TEACHER
─────────────────────────────────────────────────────────────────────
Élèves          ✅ CRUD      ✅ Read    ✅ CRUD    ✅ Read     ✅ Read
Classes         ✅ CRUD      ✅ CRUD    ✅ Read    ✅ Read     ✅ Read
Notes           ✅ CRUD      ✅ Read    ✅ Read    ❌          ✅ CRUD*
Bulletins       ✅ CRUD      ✅ Valid.  ✅ Print   ❌          ✅ Read
Paiements       ✅ CRUD      ✅ Valid.  ✅ Read    ✅ CRUD     ❌
Salaires        ✅ CRUD      ✅ Read    ❌         ✅ CRUD     ✅ Read*
Rapports        ✅ Tout      ✅ Tout    ✅ Partiel ✅ Financ.  ✅ Partiel
Configuration   ✅ Tout      ✅ Partiel ❌         ❌          ❌
Sauvegarde      ✅ Tout      ✅ Tout    ❌         ❌          ❌

* = uniquement ses propres données (ses matières / son salaire)
```

---

### 26.10 Packaging et distribution

```
DESKTOP — Windows .exe
─────────────────────
electron-builder génère :
  ├── SchoolManagerPro-Setup-1.0.0.exe   (installateur NSIS)
  ├── SchoolManagerPro-1.0.0-win.zip     (portable, sans install)
  └── latest.yml                          (métadonnées mise à jour)

Installation :
  → Double-clic sur le .exe
  → Sélection du dossier d'installation
  → Raccourci bureau + menu Démarrer
  → Premier lancement → assistant de configuration
      → Nom de l'école, logo, année scolaire
      → Création du compte Super Admin

MOBILE — Android .apk
─────────────────────
Expo EAS Build génère :
  ├── SchoolManagerPro.apk    (distribution directe USB/WhatsApp)
  └── SchoolManagerPro.aab    (Google Play Store)

Installation :
  → Activer "Sources inconnues" sur Android
  → Installer le .apk
  → Saisir le code d'accès fourni par l'école
  → Saisir l'IP du PC de l'école (ou scan auto)
```

---

*Ce cahier des charges définit une solution de niveau professionnel adaptée aux établissements scolaires africains et internationaux, fonctionnant de manière autonome sans dépendance à internet.*
