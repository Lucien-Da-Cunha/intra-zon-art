# 🚂 Guide de déploiement sur Railway

## 📋 Prérequis
- Compte GitHub (votre repo : Lucien-Da-Cunha/intra-zon-art)
- Compte Railway.app (gratuit pour commencer)

## 🚀 Étapes de déploiement

### 1. Pousser le code sur GitHub

```bash
cd /Users/luciendacunha/Work/intra-zon-art
git add .
git commit -m "Préparation pour déploiement Railway"
git push origin main
```

### 2. Créer un projet Railway

1. Allez sur https://railway.app/
2. Cliquez sur **"Start a New Project"**
3. Sélectionnez **"Deploy from GitHub repo"**
4. Choisissez votre repository **intra-zon-art**

### 3. Configurer la base de données PostgreSQL

1. Dans votre projet Railway, cliquez sur **"+ New"**
2. Sélectionnez **"Database"** → **"Add PostgreSQL"**
3. Railway créera automatiquement une base de données
4. Notez l'URL de connexion (disponible dans les variables)

### 4. Déployer le Backend

1. Cliquez sur **"+ New"** → **"GitHub Repo"**
2. Sélectionnez votre repo
3. Configurez les **variables d'environnement** :

```
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=votre-secret-jwt-tres-securise-changez-moi
```

4. Dans **Settings** :
   - **Root Directory** : `intranet-entreprise`
   - **Dockerfile Path** : `Dockerfile.backend`
   - **Start Command** : `node dist/server.js`

5. Cliquez sur **"Deploy"**

### 5. Déployer le Frontend

1. Cliquez sur **"+ New"** → **"GitHub Repo"**
2. Sélectionnez le même repo
3. Configurez les **variables d'environnement** :

```
VITE_API_URL=${{Backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_WS_URL=wss://${{Backend.RAILWAY_PUBLIC_DOMAIN}}
```

4. Dans **Settings** :
   - **Root Directory** : `intranet-entreprise`
   - **Dockerfile Path** : `Dockerfile.frontend`
   - **Port** : `80`

5. Cliquez sur **"Deploy"**

### 6. Initialiser la base de données

Une fois le backend déployé, vous devez initialiser la base de données :

1. Dans Railway, allez dans votre service **PostgreSQL**
2. Cliquez sur **"Data"** ou **"Connect"**
3. Utilisez le **Query** tab pour exécuter `backend/database/init.sql`

Ou via le CLI Railway :
```bash
railway link
railway run psql $DATABASE_URL < backend/database/init.sql
```

## 🌐 Accès à votre application

Une fois déployé, Railway vous fournira des URLs :
- **Frontend** : `https://votre-frontend.up.railway.app`
- **Backend** : `https://votre-backend.up.railway.app`

## 🔄 Déploiement automatique

Railway déploie automatiquement à chaque push sur la branche `main` !

```bash
git add .
git commit -m "Mise à jour"
git push
# → Railway déploie automatiquement
```

## 💰 Coûts

- **Gratuit** : 500 heures/mois (suffisant pour les tests)
- **Developer** : $5/mois (usage modéré)
- **Team** : $20/mois (usage professionnel)

## 🛠️ Dépannage

### Problème de connexion à la base de données
- Vérifiez que `DATABASE_URL` est bien configuré
- Assurez-vous que la base de données est initialisée

### Erreur CORS
- Vérifiez que `VITE_API_URL` pointe vers le bon domaine
- Le backend doit autoriser l'origine du frontend

### WebSocket ne fonctionne pas
- Utilisez `wss://` (avec SSL) au lieu de `ws://`
- Vérifiez les ports et les configurations

## 📞 Support

- Documentation Railway : https://docs.railway.app/
- Discord Railway : https://discord.gg/railway
