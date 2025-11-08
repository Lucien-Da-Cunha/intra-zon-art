# 🎨 Déployer votre Intranet sur Render.com

Guide ultra-simple pour mettre en ligne votre application en 10 minutes !

---

## ✨ Pourquoi Render ?

✅ Interface la plus simple  
✅ PostgreSQL gratuit inclus  
✅ SSL/HTTPS automatique  
✅ Détection Docker automatique  
✅ Déploiement Git automatique  
✅ **Pas de carte bancaire pour commencer**  

---

## 🚀 DÉPLOIEMENT EN 5 ÉTAPES

### Étape 1️⃣ : Créer un compte Render

1. Allez sur **https://render.com/**
2. Cliquez sur **"Get Started for Free"**
3. Connectez-vous avec **GitHub** (le plus simple)
4. Autorisez Render à accéder à vos repos

---

### Étape 2️⃣ : Pousser le code sur GitHub

```bash
cd /Users/luciendacunha/Work/intra-zon-art
git add .
git commit -m "Configuration Render.com"
git push origin main
```

---

### Étape 3️⃣ : Créer la base de données PostgreSQL

1. Dans le **Dashboard Render**, cliquez sur **"New +"**
2. Sélectionnez **"PostgreSQL"**
3. Configurez :
   - **Name** : `intranet-db`
   - **Database** : `intranet_db`
   - **User** : `intranet`
   - **Region** : Choisissez le plus proche (ex: Frankfurt)
   - **Plan** : **Free** (gratuit)
4. Cliquez sur **"Create Database"**
5. ✅ Attendez ~1 minute que la base soit créée

**⚠️ IMPORTANT** : Notez les informations de connexion :
- **Internal Database URL** (pour le backend)
- **External Database URL** (pour se connecter depuis votre Mac)

---

### Étape 4️⃣ : Initialiser la base de données

**Option A - Via l'interface Render (Simple)** :

1. Allez dans votre base de données **intranet-db**
2. Cliquez sur **"Connect"** → **"External Connection"**
3. Copiez la commande `psql`
4. Sur votre Mac, dans le terminal :

```bash
# Installer psql si nécessaire
brew install postgresql

# Se connecter (collez la commande de Render)
psql postgresql://intranet:MOT_DE_PASSE@XXXXX.oregon-postgres.render.com/intranet_db

# Puis dans psql, copiez/collez le contenu de backend/database/init.sql
\i /Users/luciendacunha/Work/intra-zon-art/backend/database/init.sql

# Ou directement :
\q
```

**Option B - En une commande** :

```bash
# Remplacez l'URL par celle de Render
psql "postgresql://intranet:PASSWORD@XXXXX.render.com/intranet_db" -f backend/database/init.sql
```

---

### Étape 5️⃣ : Déployer le Backend

1. Dans Render, cliquez sur **"New +"** → **"Web Service"**
2. Connectez votre repo **"Lucien-Da-Cunha/intra-zon-art"**
3. Configurez le service :

**Paramètres de base :**
- **Name** : `intranet-backend`
- **Region** : Même région que la base de données
- **Branch** : `main`
- **Root Directory** : `backend`
- **Runtime** : **Docker**
- **Dockerfile Path** : `backend/Dockerfile` (ou juste `Dockerfile`)

**Variables d'environnement :**

Cliquez sur **"Advanced"** → **"Add Environment Variable"** :

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | *Collez l'Internal Database URL de votre base* |
| `JWT_SECRET` | `changez-moi-secret-super-securise-123456` |

**Plan :** **Free** (gratuit)

4. Cliquez sur **"Create Web Service"**
5. ✅ Render va builder et déployer automatiquement (~2-3 minutes)

**📝 Notez l'URL du backend** : `https://intranet-backend.onrender.com`

---

### Étape 6️⃣ : Déployer le Frontend

1. Dans Render, cliquez sur **"New +"** → **"Web Service"**
2. Sélectionnez à nouveau votre repo **"intra-zon-art"**
3. Configurez le service :

**Paramètres de base :**
- **Name** : `intranet-frontend`
- **Region** : Même région que le backend
- **Branch** : `main`
- **Root Directory** : `frontend`
- **Runtime** : **Docker**
- **Dockerfile Path** : `frontend/Dockerfile`

**Variables d'environnement :**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://intranet-backend.onrender.com` |
| `VITE_WS_URL` | `wss://intranet-backend.onrender.com` |

*⚠️ Remplacez par l'URL réelle de votre backend Render*

**Plan :** **Free**

4. Cliquez sur **"Create Web Service"**
5. ✅ Render va builder et déployer (~2-3 minutes)

**📝 Notez l'URL du frontend** : `https://intranet-frontend.onrender.com`

---

## 🎉 TERMINÉ ! Votre intranet est en ligne !

🌐 **Accédez à votre application** : `https://intranet-frontend.onrender.com`

**Connexion :**
- **Email** : `admin@company.com`
- **Mot de passe** : `password123`

---

## 🔄 Mise à jour automatique

Chaque fois que vous faites un `git push`, Render redéploie automatiquement :

```bash
git add .
git commit -m "Nouvelle fonctionnalité"
git push origin main
# → Render détecte et redéploie automatiquement ! ✨
```

---

## 💰 Coûts Render

| Service | Plan Free | Plan Paid |
|---------|-----------|-----------|
| **PostgreSQL** | Gratuit (1GB) | $7/mois (10GB) |
| **Backend** | Gratuit* | $7/mois |
| **Frontend** | Gratuit* | $7/mois |

*\*Services gratuits dorment après 15 min d'inactivité. Réveil automatique en ~30 secondes.*

**Pour usage professionnel** : ~$21/mois (tous les services en payant)

---

## ⚡ Garder les services actifs (Plan gratuit)

Les services gratuits dorment après inactivité. Pour les garder actifs :

### Option 1 : Cron Job externe (Gratuit)

Utilisez **UptimeRobot** ou **Cron-job.org** :

1. Inscrivez-vous sur **https://uptimerobot.com/** (gratuit)
2. Ajoutez un monitor :
   - **URL** : `https://intranet-backend.onrender.com`
   - **Interval** : 5 minutes
3. Le site sera pingé régulièrement et restera actif

### Option 2 : Passer en plan payant ($7/mois par service)

Services payants = toujours actifs, plus performants.

---

## 🔐 Sécurité Production

### 1. Changez le JWT_SECRET

```bash
# Générer un secret sécurisé
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiez le résultat et mettez-le dans la variable `JWT_SECRET` sur Render.

### 2. Changez les mots de passe

Une fois déployé, connectez-vous à la base et changez les mots de passe :

```bash
# Se connecter à la base Render
psql "VOTRE_EXTERNAL_DATABASE_URL"

# Changer le mot de passe admin (générez un hash bcrypt avant)
# Utilisez https://bcrypt-generator.com/ avec password123
UPDATE users 
SET password = '$2b$10$NouveauHashBcrypt' 
WHERE email = 'admin@company.com';
```

---

## 🛠️ Configuration avancée

### Domaine personnalisé

1. Dans Render, allez dans votre service **intranet-frontend**
2. **Settings** → **Custom Domain**
3. Ajoutez `intranet.votredomaine.com`
4. Configurez les DNS selon les instructions Render
5. ✅ SSL automatique !

### Variables d'environnement supplémentaires

Pour le **Backend** :

```env
# CORS - Ajoutez votre domaine custom
FRONTEND_URL=https://intranet.votredomaine.com

# Email (optionnel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre@email.com
SMTP_PASS=votre_mot_de_passe
```

Puis modifiez `backend/src/server.ts` pour utiliser `process.env.FRONTEND_URL` dans CORS.

---

## 📊 Monitoring et Logs

### Voir les logs en temps réel

1. Dans Render, cliquez sur votre service
2. Onglet **"Logs"**
3. Logs en temps réel ! 📝

### Métriques

Dans **"Metrics"** :
- CPU usage
- Memory usage
- Request count
- Response time

---

## 🐛 Dépannage

### ❌ Le backend ne démarre pas

**Vérifiez dans les logs Render :**

1. Erreur de connexion DB → Vérifiez `DATABASE_URL`
2. Erreur de build Docker → Vérifiez que `backend/Dockerfile` existe
3. Port error → Assurez-vous que `PORT=3001` est défini

**Solution** :
- Allez dans **Settings** → **Environment Variables**
- Vérifiez toutes les variables
- Cliquez sur **"Manual Deploy"** → **"Deploy latest commit"**

### ❌ Le frontend ne se connecte pas au backend

**Vérifiez :**

1. `VITE_API_URL` pointe vers la bonne URL Render du backend
2. Le backend est bien en ligne (voyant vert)
3. Les URLs incluent `https://` et `wss://` (pas `http://` ou `ws://`)

**Solution** :
- Allez dans **Settings** du frontend
- Corrigez `VITE_API_URL` avec l'URL exacte du backend
- Redéployez

### ❌ Service dormant (Free plan)

C'est normal ! Il se réveille en ~30 secondes.

**Solutions** :
- Utilisez UptimeRobot pour garder actif
- Passez en plan payant ($7/mois)

### ❌ Erreur CORS

Modifiez `backend/src/server.ts` :

```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://intranet-frontend.onrender.com', // Ajoutez votre URL Render
    'https://votre-domaine-custom.com' // Si vous en avez un
  ],
  credentials: true
}));
```

Puis push sur GitHub → Render redéploie automatiquement.

---

## 📱 Dashboard Render

Toutes vos applications au même endroit :
- État des services (online/offline)
- Logs en temps réel
- Métriques de performance
- Historique des déploiements

---

## 🔗 Liens utiles

- **Dashboard Render** : https://dashboard.render.com/
- **Documentation** : https://render.com/docs
- **Status** : https://status.render.com/
- **Support** : https://community.render.com/

---

## ✅ Checklist finale

Avant de partager votre intranet :

- [ ] Backend déployé et accessible
- [ ] Frontend déployé et accessible
- [ ] Base de données initialisée avec init.sql
- [ ] Connexion fonctionne (testez avec admin@company.com)
- [ ] Messagerie temps réel fonctionne
- [ ] JWT_SECRET changé et sécurisé
- [ ] Mots de passe des comptes changés
- [ ] HTTPS activé (automatique sur Render)
- [ ] Domaine custom configuré (optionnel)
- [ ] Monitoring actif

---

## 🎊 Félicitations !

Votre intranet est maintenant en production sur Render ! 🚀

**Besoin d'aide ?**
- Documentation Render : https://render.com/docs
- Community : https://community.render.com/

**Questions ?** Demandez-moi ! 😊
