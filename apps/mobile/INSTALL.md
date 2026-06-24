# Installation de l'Application Mobile SGSI

## Option 1 — Installation standard (recommandée)

```bash
cd apps/mobile
npm install
npm start
```

## Option 2 — Si problème de réseau (ECONNRESET)

### Étape 1 : Créer un projet Expo vide d'abord
```bash
cd apps/
npx create-expo-app@latest mobile-temp --template blank-typescript
```

### Étape 2 : Copier les sources SGSI dans le projet créé
```bash
# Copier les fichiers sources
xcopy mobile\src mobile-temp\src /E /I
copy mobile\App.tsx mobile-temp\App.tsx
copy mobile\babel.config.js mobile-temp\babel.config.js
```

### Étape 3 : Installer les dépendances supplémentaires
```bash
cd mobile-temp
npm install zustand expo-secure-store
```

### Étape 4 : Lancer
```bash
npm start
```

## Option 3 — Via Expo Go (recommandée pour test rapide)

1. Installez **Expo Go** sur votre téléphone
   - Android : https://play.google.com/store/apps/details?id=host.exp.exponent
   - iOS : https://apps.apple.com/app/expo-go/id982107779

2. Lancez le desktop SGSI (assure que le serveur port 3721 tourne)

3. Dans le terminal mobile :
   ```bash
   npm start
   ```

4. Scannez le QR code avec Expo Go

## Build APK Android (distribution)

```bash
# 1. Créer un compte Expo : https://expo.dev/signup

# 2. Installer EAS CLI
npm install -g eas-cli

# 3. Connexion
eas login

# 4. Configurer
eas build:configure

# 5. Build APK
eas build --platform android --profile preview
```

## Variables de configuration

L'app se connecte automatiquement au serveur desktop.
Aucune variable d'environnement requise — l'IP est saisie au premier lancement.

## Architecture réseau

```
Téléphone (WiFi) ──── réseau local ──── PC (SGSI Desktop)
                                              │
                                         Port 3721
                                      (Express Server)
```

**Important** : Le téléphone et le PC doivent être sur le **même réseau Wi-Fi**.
