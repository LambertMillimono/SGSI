# Déploiement du serveur de licences SGSI sur Render.com

## Étapes (5 minutes)

### 1. Créer un compte GitHub (si pas encore fait)
→ https://github.com

### 2. Créer un dépôt GitHub pour le serveur
1. Sur GitHub → New repository → Nom: `sgsi-license-server`
2. Cochez "Private" (ne pas rendre public)

### 3. Pousser le code vers GitHub
Ouvrez PowerShell dans `apps/license-server/` et tapez :
```bash
git init
git add .
git commit -m "SGSI License Server v2"
git branch -M main
git remote add origin https://github.com/VOTRE-USERNAME/sgsi-license-server.git
git push -u origin main
```

### 4. Déployer sur Render.com
1. Allez sur https://render.com → Sign Up (avec GitHub)
2. New → Web Service
3. Connectez votre dépôt `sgsi-license-server`
4. Configuration :
   - **Name**: sgsi-license-server
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node src/index.js`
   - **Plan**: Free
5. Ajoutez les variables d'environnement :
   - `ADMIN_SECRET` = `sgsi-admin-lambert-2024`
   - `BREVO_API_KEY` = `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`
   - `ADMIN_EMAIL` = `lambertmillimono8@gmail.com`
6. Cliquez **Create Web Service**

### 5. Récupérez l'URL
Render vous donne une URL du type :
```
https://sgsi-license-server.onrender.com
```

### 6. Mettez à jour l'app SGSI Desktop
Dans `apps/desktop/src/main/license/license.service.ts`, ligne 1 :
```typescript
const LICENSE_SERVER = 'https://sgsi-license-server.onrender.com'
```

### Notes
- Le serveur gratuit s'éteint après 15 min d'inactivité
- Il redémarre automatiquement à la première requête (délai ~30s)
- Pour garder le serveur actif 24/7 → Plan Starter ($7/mois)
