# SGSI Mobile — React Native + Expo

Application mobile pour parents, enseignants et élèves de SchoolManager Pro.

## Prérequis

- Node.js 18+
- Expo CLI : `npm install -g expo-cli`
- Application **Expo Go** sur le téléphone (App Store / Play Store)
- L'application **SGSI Desktop** doit être ouverte sur le PC

## Installation

```bash
cd apps/mobile
npm install
```

## Lancement

```bash
npm start
# Scannez le QR code avec l'app Expo Go (Android) ou l'app Appareil photo (iOS)
```

## Architecture

```
apps/mobile/
├── App.tsx                    # Point d'entrée
├── src/
│   ├── api/
│   │   └── client.ts          # Client HTTP → serveur desktop (port 3721)
│   ├── store/
│   │   └── auth.store.ts      # État global (Zustand) — auth + session
│   ├── utils/
│   │   └── theme.ts           # Design tokens (couleurs, typo, espacement)
│   ├── navigation/
│   │   └── AppNavigator.tsx   # Routage basé sur le rôle
│   └── screens/
│       ├── ConnectScreen.tsx  # Connexion serveur + login
│       ├── parent/
│       │   └── ParentDashboard.tsx  # Notes, absences, paiements de l'enfant
│       └── teacher/
│           ├── TeacherDashboard.tsx  # Emploi du temps + accès rapide
│           ├── GradeEntryScreen.tsx  # Saisie des notes
│           └── AbsenceScreen.tsx     # Feuille de présence
```

## Connexion

1. L'app demande l'adresse IP du PC (ex: `192.168.1.10`)
2. Le téléphone et le PC doivent être sur le **même réseau Wi-Fi**
3. Le serveur mobile SGSI tourne sur le port **3721**

### Rôles

| Rôle | Accès |
|------|-------|
| TEACHER | Emploi du temps · Saisie notes · Feuille absences |
| PARENT | Notes enfant · Absences · Paiements |
| STUDENT | Notes · Absences |

## Build APK (Android)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Configurer EAS
eas login
eas build:configure

# Build APK
eas build --platform android --profile preview
```

## API Server (desktop)

Le serveur Express sur le desktop écoute sur `0.0.0.0:3721` avec les routes :

| Route | Description |
|-------|-------------|
| `GET /api/status` | Vérification serveur |
| `POST /api/auth/login` | Login (token JWT) |
| `GET /api/student/:id/grades?period=N` | Notes par période |
| `GET /api/student/:id/absences` | Absences |
| `GET /api/student/:id/payments` | Paiements |
| `GET /api/teacher/schedule` | Emploi du temps enseignant |
| `GET /api/teacher/classes` | Classes de l'enseignant |
| `POST /api/teacher/grades` | Saisir des notes |
| `POST /api/teacher/absences` | Enregistrer absences |
