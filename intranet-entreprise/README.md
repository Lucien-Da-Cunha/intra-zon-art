# 🏢 Intranet d'Entreprise

Plateforme intranet complète avec messagerie temps réel, gestion des ventes et administration.

## 🚀 Fonctionnalités

- ✅ **Authentification** : Système de connexion sécurisé avec JWT
- 📨 **Messagerie** : Chat temps réel avec WebSocket
- 💰 **Chiffre d'affaires** : Suivi des ventes et statistiques
- 👑 **Administration** : Gestion des utilisateurs et logs d'activité
- 🏢 **Départements** : Organisation par départements
- 📊 **Tableaux de bord** : Vue d'ensemble des métriques

## 🛠️ Technologies

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL
- WebSocket (ws)
- JWT Authentication
- Bcrypt

### Frontend
- React 18
- TypeScript
- Zustand (state management)
- React Router
- Axios

### Infrastructure
- Docker & Docker Compose
- Optimisé pour Apple Silicon (M1/M2/M3)

## 📦 Installation

### Prérequis
- Docker Desktop installé
- Mac M3 Pro (ou autre architecture avec Docker)

### Démarrage rapide

1. **Cloner ou accéder au dossier du projet**
```bash
cd /Users/luciendacunha/Work/intranet-entreprise
```

2. **Lancer l'application avec Docker**
```bash
docker compose up -d
```

3. **Accéder à l'application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432

## 👤 Comptes de test

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| admin@company.com | password123 | Admin |
| manager@company.com | password123 | Manager |
| john@company.com | password123 | Employé |
| sophie@company.com | password123 | Employé |
| lucas@company.com | password123 | Employé |

## 🏗️ Structure du projet

```
intranet-entreprise/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuration (database)
│   │   ├── middleware/     # Authentification JWT
│   │   ├── routes/         # API Routes
│   │   └── server.ts       # Serveur principal
│   └── database/
│       └── init.sql        # Schéma de base de données
├── frontend/
│   └── src/
│       ├── api/            # Client API
│       ├── components/     # Composants React
│       ├── pages/          # Pages
│       ├── store/          # Zustand store
│       └── styles/         # CSS
└── docker-compose.yml
```

## 📊 Base de données

### Tables principales
- `users` : Utilisateurs avec rôles et départements
- `departments` : Départements de l'entreprise
- `messages` : Messages de la messagerie
- `conversations` : Conversations (privées/groupes)
- `sales` : Ventes et chiffre d'affaires
- `activity_logs` : Logs d'activité pour l'admin

## 🔧 Commandes utiles

```bash
# Démarrer les conteneurs
docker compose up -d

# Voir les logs
docker compose logs -f

# Arrêter les conteneurs
docker compose down

# Rebuild complet
docker compose down -v
docker compose up --build

# Accéder à la base de données
docker compose exec postgres psql -U intranet -d intranet_db

# Redémarrer un service
docker compose restart backend
docker compose restart frontend
```

## 🔐 Sécurité

- Mots de passe hashés avec bcrypt
- Tokens JWT avec expiration 7 jours
- Middleware d'authentification sur toutes les routes protégées
- Validation des données avec express-validator
- CORS configuré

## 📝 API Endpoints

### Auth
- `POST /api/auth/login` - Connexion
- `GET /api/auth/me` - Profil utilisateur

### Messages
- `GET /api/messages/conversations` - Liste des conversations
- `GET /api/messages/conversations/:id/messages` - Messages d'une conversation
- `POST /api/messages/conversations` - Créer une conversation
- `POST /api/messages/messages` - Envoyer un message

### Sales
- `GET /api/sales` - Liste des ventes
- `GET /api/sales/stats` - Statistiques de ventes
- `POST /api/sales` - Créer une vente
- `PUT /api/sales/:id` - Mettre à jour une vente
- `DELETE /api/sales/:id` - Supprimer une vente (admin/manager)

### Admin
- `GET /api/admin/users` - Liste des utilisateurs
- `POST /api/admin/users` - Créer un utilisateur
- `PUT /api/admin/users/:id` - Modifier un utilisateur
- `DELETE /api/admin/users/:id` - Supprimer un utilisateur
- `GET /api/admin/activity-logs` - Logs d'activité
- `GET /api/admin/departments` - Liste des départements

## 🎨 Personnalisation

### Modifier les variables d'environnement
Créez un fichier `.env` à la racine ou modifiez le `docker-compose.yml`

### Thème et styles
Les styles sont dans `frontend/src/styles/index.css`

## 🐛 Dépannage

### Les conteneurs ne démarrent pas
```bash
docker compose down -v
docker compose up --build
```

### Erreur de connexion à la base de données
Vérifiez que PostgreSQL est bien démarré :
```bash
docker compose logs postgres
```

### Le frontend ne se connecte pas au backend
Vérifiez les logs :
```bash
docker compose logs backend
docker compose logs frontend
```

## 📄 Licence

Projet interne - Tous droits réservés
