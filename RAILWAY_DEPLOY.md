# 🚂 Déployer votre Intranet sur Railway

Guide complet pour mettre en ligne votre application sur Railway.app

## 📋 Ce que vous allez obtenir

✅ Application accessible publiquement sur Internet  
✅ Base de données PostgreSQL hébergée  
✅ HTTPS automatique (SSL gratuit)  
✅ Déploiement automatique à chaque push Git  
✅ 500h gratuites/mois pour commencer  

---

## 🚀 GUIDE RAPIDE (5 minutes)

### Étape 1️⃣ : Pousser votre code sur GitHub

```bash
cd /Users/luciendacunha/Work/intra-zon-art
git add .
git commit -m "Préparation déploiement Railway"
git push origin main
```

### Étape 2️⃣ : Créer un compte Railway

1. Allez sur **https://railway.app/**
2. Cliquez sur **"Login"** → Connectez-vous avec GitHub
3. Autorisez Railway à accéder à vos repos

### Étape 3️⃣ : Créer un nouveau projet

1. Cliquez sur **"New Project"**
2. Sélectionnez **"Deploy from GitHub repo"**
3. Choisissez **`Lucien-Da-Cunha/intra-zon-art`**
4. Railway va détecter automatiquement votre projet

### Étape 4️⃣ : Ajouter PostgreSQL

1. Dans votre projet, cliquez sur **"+ New"**
2. Sélectionnez **"Database"** → **"Add PostgreSQL"**
3. Railway crée automatiquement la base de données
4. ✅ Notez l'URL (sera disponible comme variable `DATABASE_URL`)

### Étape 5️⃣ : Configurer le Backend

1. Cliquez sur **"+ New"** → **"Service"** → **"GitHub Repo"**
2. Sélectionnez votre repo **intra-zon-art**
3. Railway détecte le Dockerfile

**Variables d'environnement à ajouter** :
```
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=VotreSecretTresTresSecuriseChangezMoi123!
```

**Paramètres du service** :
- **Root Directory** : `backend`
- **Dockerfile Path** : `Dockerfile`
- Cliquez sur **"Deploy"**

### Étape 6️⃣ : Configurer le Frontend

1. Cliquez sur **"+ New"** → **"Service"** → **"GitHub Repo"**
2. Sélectionnez à nouveau votre repo
3. Railway détecte le Dockerfile

**Variables d'environnement** :

Remplacez `VOTRE_BACKEND_URL` par l'URL publique du backend (visible dans Railway) :

```
VITE_API_URL=https://votre-backend-url.up.railway.app
VITE_WS_URL=wss://votre-backend-url.up.railway.app
```

**Paramètres du service** :
- **Root Directory** : `frontend`
- **Dockerfile Path** : `Dockerfile`
- **Port** : `80`
- Cliquez sur **"Deploy"**

### Étape 7️⃣ : Initialiser la base de données

**Option A - Via l'interface Railway** :
1. Cliquez sur votre service **PostgreSQL**
2. Allez dans l'onglet **"Data"**
3. Cliquez sur **"Query"**
4. Copiez/collez le contenu de `backend/database/init.sql`
5. Exécutez

**Option B - Via Railway CLI** :
```bash
# Installer Railway CLI
npm i -g @railway/cli

# Se connecter
railway login

# Lier le projet
railway link

# Exécuter le script SQL
railway run psql $DATABASE_URL -f backend/database/init.sql
```

### Étape 8️⃣ : Générer les domaines publics

1. Cliquez sur votre service **Backend**
2. Allez dans **"Settings"** → **"Networking"**
3. Cliquez sur **"Generate Domain"**
4. Copiez l'URL (ex: `https://backend-production-abc123.up.railway.app`)

5. Faites de même pour le **Frontend**
6. Copiez l'URL (ex: `https://frontend-production-xyz789.up.railway.app`)

7. **IMPORTANT** : Retournez dans les variables du Frontend et mettez à jour :
```
VITE_API_URL=https://backend-production-abc123.up.railway.app
VITE_WS_URL=wss://backend-production-abc123.up.railway.app
```

8. Le frontend va se redéployer automatiquement

---

## 🎉 TERMINÉ !

Votre intranet est maintenant en ligne ! 

Accédez à : **`https://frontend-production-xyz789.up.railway.app`**

Connectez-vous avec :
- **Email** : `admin@company.com`
- **Mot de passe** : `password123`

---

## 🔄 Mise à jour automatique

Chaque fois que vous faites un `git push`, Railway redéploie automatiquement :

```bash
# Faire des modifications
git add .
git commit -m "Nouvelle fonctionnalité"
git push

# → Railway détecte le push et redéploie automatiquement
```

---

## 💰 Coûts Railway

| Plan | Prix | Inclus |
|------|------|--------|
| **Trial** | Gratuit | 500h/mois (~20 jours) |
| **Developer** | $5/mois | $5 de crédit + $5/mois |
| **Team** | $20/mois | Usage illimité |

**Estimation pour votre projet** :
- Backend : ~$3-5/mois
- Frontend : ~$1-2/mois  
- PostgreSQL : Inclus
- **Total** : ~$5-7/mois

---

## 🛠️ Configuration avancée (Optionnel)

### Domaine personnalisé

1. Achetez un domaine (ex: monentreprise.com)
2. Dans Railway, allez dans **Settings** → **Networking**
3. Cliquez sur **"Custom Domain"**
4. Ajoutez `intranet.monentreprise.com`
5. Configurez les DNS selon les instructions Railway

### Variables d'environnement supplémentaires

**Backend** :
```
# Email (si vous ajoutez des notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre@email.com
SMTP_PASS=votre_mot_de_passe

# Stockage fichiers (si vous utilisez S3)
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_BUCKET_NAME=intranet-uploads
```

### Logs et monitoring

1. Dans Railway, cliquez sur votre service
2. Allez dans **"Deployments"**
3. Cliquez sur le déploiement actif
4. Consultez les **"Logs"** en temps réel

---

## 🐛 Dépannage

### ❌ Le backend ne démarre pas

**Vérifiez** :
1. Les logs dans Railway : cherchez les erreurs
2. Que `DATABASE_URL` est bien défini
3. Que le script SQL a bien été exécuté
4. Le port est bien `3001`

**Solution** :
```bash
# Dans les logs Railway, si erreur de connexion DB :
railway run psql $DATABASE_URL -f backend/database/init.sql
```

### ❌ Le frontend ne se connecte pas au backend

**Vérifiez** :
1. `VITE_API_URL` pointe vers la bonne URL Railway du backend
2. Le backend est bien démarré (voyant vert dans Railway)
3. Les variables incluent `https://` et non `http://`

**Solution** :
Reconfigurez les variables dans Railway et redéployez.

### ❌ Erreur CORS

**Vérifiez dans backend/src/server.ts** :
```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://votre-frontend-railway.up.railway.app' // Ajoutez votre URL Railway
  ],
  credentials: true
}));
```

### ❌ WebSocket ne fonctionne pas

**Vérifiez** :
1. `VITE_WS_URL` utilise bien `wss://` (avec SSL)
2. Le backend expose bien le port WebSocket
3. Testez la connexion manuellement

---

## 📱 Commandes Railway CLI utiles

```bash
# Installer
npm i -g @railway/cli

# Se connecter
railway login

# Lier un projet
railway link

# Voir les logs
railway logs

# Ouvrir l'interface web
railway open

# Voir les variables
railway variables

# Exécuter une commande
railway run node script.js

# Déployer manuellement
railway up
```

---

## 🔐 Sécurité Production

### Changez les mots de passe !

Une fois déployé, **connectez-vous à la base de données** et changez les mots de passe :

```sql
-- Via Railway PostgreSQL Query
UPDATE users 
SET password = '$2b$10$NouveauHashBcrypt...' 
WHERE email = 'admin@company.com';
```

### Générez un nouveau JWT_SECRET

```bash
# Générer un secret aléatoire sécurisé
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiez le résultat et mettez-le dans `JWT_SECRET` sur Railway.

---

## 📞 Support

- **Documentation Railway** : https://docs.railway.app/
- **Discord Railway** : https://discord.gg/railway
- **Status Railway** : https://status.railway.app/

---

## ✅ Checklist finale

Avant de partager votre intranet :

- [ ] Backend déployé et accessible
- [ ] Frontend déployé et accessible
- [ ] Base de données initialisée
- [ ] Connexion fonctionne
- [ ] Messagerie temps réel OK
- [ ] Mots de passe changés
- [ ] JWT_SECRET sécurisé
- [ ] HTTPS activé (automatique sur Railway)
- [ ] Logs surveillés

---

🎊 **Félicitations ! Votre intranet est en production !**
