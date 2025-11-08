# Production Dockerfile pour Backend
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer TOUTES les dépendances (y compris dev pour build)
RUN npm install

# Copier le code source
COPY . .

# Compiler TypeScript
RUN npm run build

# Créer les dossiers uploads
RUN mkdir -p uploads/drive uploads/messages uploads/receipts

# Exposer le port (Render utilise $PORT)
EXPOSE 3001

# Démarrer en production
CMD ["npm", "start"]
