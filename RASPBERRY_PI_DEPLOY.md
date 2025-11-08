# 🍓 Déployer l'Intranet sur Raspberry Pi

Guide complet pour héberger votre intranet sur votre propre Raspberry Pi

---

## 📋 Informations du serveur

- **IP** : 192.168.1.95
- **User** : lucien
- **OS** : Raspberry Pi OS (Debian)

---

## 🚀 INSTALLATION COMPLÈTE

### Étape 1️⃣ : Mise à jour du système

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer les outils de base
sudo apt install -y git curl wget vim htop
```

---

### Étape 2️⃣ : Installer Docker et Docker Compose

```bash
# Installer Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Ajouter l'utilisateur au groupe docker (pour ne pas utiliser sudo)
sudo usermod -aG docker lucien

# Vérifier l'installation
docker --version

# Installer Docker Compose
sudo apt install -y docker-compose

# Vérifier
docker-compose --version

# IMPORTANT : Déconnectez-vous et reconnectez-vous pour que le groupe docker soit actif
exit
# Puis reconnectez-vous : ssh lucien@192.168.1.95
```

---

### Étape 3️⃣ : Cloner le projet

```bash
# Aller dans le dossier home
cd ~

# Cloner le projet depuis GitHub
git clone https://github.com/Lucien-Da-Cunha/intra-zon-art.git

# Aller dans le dossier du projet
cd intra-zon-art

# Vérifier les fichiers
ls -la
```

---

### Étape 4️⃣ : Configurer les variables d'environnement

```bash
# Créer le fichier .env pour le backend
cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://intranet:intranet123@postgres:5432/intranet_db
JWT_SECRET=votre-secret-super-securise-changez-moi-123456
EOF

# Créer le fichier .env pour le frontend
cat > frontend/.env << 'EOF'
VITE_API_URL=http://192.168.1.95:3001
VITE_WS_URL=ws://192.168.1.95:3001
EOF
```

---

### Étape 5️⃣ : Créer le docker-compose pour production

```bash
# Créer le fichier docker-compose.prod.yml
cat > docker-compose.prod.yml << 'EOF'
services:
  # Base de données PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: intranet-postgres
    environment:
      POSTGRES_USER: intranet
      POSTGRES_PASSWORD: intranet123
      POSTGRES_DB: intranet_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U intranet -d intranet_db"]
      interval: 5s
      timeout: 5s
      retries: 5

  # Backend API avec WebSocket
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile
    container_name: intranet-backend
    env_file:
      - ./backend/.env
    ports:
      - "3001:3001"
    volumes:
      - ./backend/uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  # Frontend React
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: intranet-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  postgres_data:
EOF
```

---

### Étape 6️⃣ : Lancer l'application

```bash
# Lancer avec docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Voir les logs en temps réel
docker-compose -f docker-compose.prod.yml logs -f

# Appuyez sur Ctrl+C pour arrêter de voir les logs (l'app continue de tourner)
```

---

### Étape 7️⃣ : Vérifier que tout fonctionne

```bash
# Voir les conteneurs actifs
docker ps

# Tester le backend
curl http://localhost:3001

# Tester la base de données
docker exec -it intranet-postgres psql -U intranet -d intranet_db -c "SELECT COUNT(*) FROM users;"
```

---

## 🌐 Accès à l'application

### Depuis votre réseau local :

- **Frontend** : http://192.168.1.95
- **Backend API** : http://192.168.1.95:3001

### Connexion :

- **Email** : admin@company.com
- **Mot de passe** : password123

---

## 🔒 Sécuriser l'installation

### 1. Changer les mots de passe de la base de données

```bash
# Modifier le docker-compose.prod.yml avec de nouveaux mots de passe
nano docker-compose.prod.yml

# Changer :
POSTGRES_PASSWORD: VotreNouveauMotDePasse123!

# Puis dans backend/.env :
DATABASE_URL=postgresql://intranet:VotreNouveauMotDePasse123!@postgres:5432/intranet_db
```

### 2. Générer un nouveau JWT_SECRET

```bash
# Sur votre Mac ou le Raspberry Pi (si Node.js est installé)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Copiez le résultat et mettez-le dans backend/.env
nano backend/.env
# JWT_SECRET=le_nouveau_secret_genere
```

### 3. Changer les mots de passe des utilisateurs

```bash
# Générer un hash bcrypt sur : https://bcrypt-generator.com/
# Puis se connecter à la base
docker exec -it intranet-postgres psql -U intranet -d intranet_db

# Dans psql :
UPDATE users SET password = '$2b$10$NouveauHashBcrypt' WHERE email = 'admin@company.com';
\q
```

### 4. Configurer le pare-feu

```bash
# Installer UFW (Uncomplicated Firewall)
sudo apt install -y ufw

# Autoriser SSH (IMPORTANT !)
sudo ufw allow 22/tcp

# Autoriser HTTP
sudo ufw allow 80/tcp

# Autoriser le backend
sudo ufw allow 3001/tcp

# Activer le pare-feu
sudo ufw enable

# Vérifier le statut
sudo ufw status
```

---

## 🌍 Rendre accessible depuis Internet (Optionnel)

### Option 1 : Port Forwarding (Configuration sur votre box internet)

1. Connectez-vous à l'interface de votre box (ex: 192.168.1.1)
2. Trouvez la section **"NAT/PAT"** ou **"Port Forwarding"**
3. Ajoutez des règles :
   - **Port externe 80** → **192.168.1.95:80** (Frontend)
   - **Port externe 3001** → **192.168.1.95:3001** (Backend)
4. Notez votre **IP publique** : https://www.whatismyip.com/
5. Accédez via : `http://VOTRE_IP_PUBLIQUE`

⚠️ **Sécurité** : Votre IP publique change régulièrement. Utilisez un service DynDNS.

### Option 2 : Cloudflare Tunnel (RECOMMANDÉ - Gratuit et sécurisé)

```bash
# Installer Cloudflare Tunnel
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb

sudo dpkg -i cloudflared.deb

# Se connecter à Cloudflare
cloudflared tunnel login

# Créer un tunnel
cloudflared tunnel create intranet

# Configurer le tunnel
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: intranet
credentials-file: /home/lucien/.cloudflared/VOTRE_TUNNEL_ID.json

ingress:
  - hostname: intranet.votredomaine.com
    service: http://localhost:80
  - hostname: api.intranet.votredomaine.com
    service: http://localhost:3001
  - service: http_status:404
EOF

# Lancer le tunnel
cloudflared tunnel run intranet
```

### Option 3 : Tailscale (VPN privé - SIMPLE)

```bash
# Installer Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Démarrer Tailscale
sudo tailscale up

# Noter l'IP Tailscale (ex: 100.x.x.x)
tailscale ip -4
```

Accédez depuis n'importe où via l'IP Tailscale !

---

## 🔄 Commandes utiles

### Gestion Docker

```bash
# Voir les conteneurs
docker ps

# Voir les logs
docker-compose -f docker-compose.prod.yml logs -f

# Redémarrer un service
docker-compose -f docker-compose.prod.yml restart backend

# Arrêter tout
docker-compose -f docker-compose.prod.yml down

# Redémarrer tout
docker-compose -f docker-compose.prod.yml up -d

# Reconstruire et redémarrer
docker-compose -f docker-compose.prod.yml up -d --build
```

### Mise à jour du code

```bash
cd ~/intra-zon-art

# Récupérer les dernières modifications
git pull origin main

# Reconstruire et redémarrer
docker-compose -f docker-compose.prod.yml up -d --build
```

### Monitoring

```bash
# Voir l'utilisation des ressources
htop

# Voir l'espace disque
df -h

# Voir les logs système
journalctl -xe

# Voir les stats Docker
docker stats
```

### Sauvegardes

```bash
# Sauvegarder la base de données
docker exec intranet-postgres pg_dump -U intranet intranet_db > backup_$(date +%Y%m%d).sql

# Restaurer
docker exec -i intranet-postgres psql -U intranet intranet_db < backup_20250108.sql

# Sauvegarder les uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/uploads/
```

---

## 📊 Monitoring et Logs

### Installer Portainer (Interface Web pour Docker)

```bash
docker volume create portainer_data

docker run -d -p 9000:9000 --name=portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce:latest
```

Accédez à Portainer : http://192.168.1.95:9000

---

## 🔧 Optimisation Raspberry Pi

### 1. Augmenter la SWAP (si peu de RAM)

```bash
# Arrêter la swap
sudo dphys-swapfile swapoff

# Éditer la config
sudo nano /etc/dphys-swapfile
# Changer : CONF_SWAPSIZE=2048

# Recréer la swap
sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

### 2. Désactiver le Wi-Fi/Bluetooth (si câblé Ethernet)

```bash
sudo nano /boot/config.txt

# Ajouter à la fin :
dtoverlay=disable-wifi
dtoverlay=disable-bt

# Redémarrer
sudo reboot
```

### 3. Activer le démarrage automatique

```bash
# Les conteneurs Docker redémarrent automatiquement avec restart: unless-stopped
# Mais on peut créer un service systemd pour plus de contrôle

sudo nano /etc/systemd/system/intranet.service

# Contenu :
[Unit]
Description=Intranet Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/lucien/intra-zon-art
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target

# Activer le service
sudo systemctl enable intranet.service
sudo systemctl start intranet.service
```

---

## 🐛 Dépannage

### Le Raspberry Pi est lent

```bash
# Vérifier la RAM
free -h

# Vérifier le CPU
top

# Nettoyer Docker
docker system prune -a
```

### Erreur de connexion à la base de données

```bash
# Vérifier que PostgreSQL est actif
docker ps | grep postgres

# Voir les logs
docker logs intranet-postgres

# Redémarrer
docker restart intranet-postgres
```

### Le frontend ne se connecte pas au backend

```bash
# Vérifier les variables d'environnement
cat frontend/.env

# Doit contenir l'IP du Raspberry Pi :
VITE_API_URL=http://192.168.1.95:3001
VITE_WS_URL=ws://192.168.1.95:3001

# Reconstruire le frontend
docker-compose -f docker-compose.prod.yml up -d --build frontend
```

---

## 📱 Accès mobile (réseau local)

Sur votre téléphone (même Wi-Fi) :
- Ouvrez le navigateur
- Allez sur : http://192.168.1.95

---

## ✅ Checklist installation

- [ ] Système à jour
- [ ] Docker installé
- [ ] Projet cloné depuis GitHub
- [ ] Variables d'environnement configurées
- [ ] Docker Compose production créé
- [ ] Conteneurs lancés et actifs
- [ ] Application accessible sur http://192.168.1.95
- [ ] Connexion fonctionne
- [ ] Mots de passe changés
- [ ] JWT_SECRET sécurisé
- [ ] Pare-feu configuré
- [ ] Sauvegardes automatiques (optionnel)
- [ ] Monitoring en place (optionnel)
- [ ] Accessible depuis Internet (optionnel)

---

## 🎊 Félicitations !

Votre intranet tourne maintenant sur votre Raspberry Pi ! 🍓

**Avantages :**
- ✅ Contrôle total
- ✅ Pas de coûts mensuels
- ✅ Données chez vous
- ✅ Performances locales rapides

**Questions ?** N'hésitez pas ! 😊
