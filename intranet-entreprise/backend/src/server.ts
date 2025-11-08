import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

import authRoutes from './routes/auth';
import messagesRoutes from './routes/messages';
import salesRoutes from './routes/sales';
import adminRoutes from './routes/admin';
import driveRoutes from './routes/drive';
import expensesRoutes from './routes/expenses';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/expenses', expensesRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Créer le serveur HTTP
const server = createServer(app);

// Créer le serveur WebSocket
const wss = new WebSocketServer({ server });

// Gérer les connexions WebSocket
const clients = new Map();

wss.on('connection', (ws, req) => {
  console.log('✅ New WebSocket connection');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      // Authentification via token
      if (data.type === 'auth') {
        try {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET || 'secret') as any;
          clients.set(ws, { userId: decoded.userId, role: decoded.role });
          console.log(`✅ Client authentifié: userId=${decoded.userId}, role=${decoded.role}`);
          ws.send(JSON.stringify({ type: 'auth', status: 'success' }));
        } catch (error) {
          console.error('❌ Erreur authentification WebSocket:', error);
          ws.send(JSON.stringify({ type: 'auth', status: 'error', message: 'Invalid token' }));
        }
      }

      // Notification de nouveau message
      if (data.type === 'new_message_notification') {
        const clientData = clients.get(ws);
        if (!clientData) {
          return;
        }

        console.log(`📤 Notification nouveau message dans conversation ${data.conversationId}`);
        
        // Notifier tous les autres clients qu'il y a un nouveau message
        wss.clients.forEach((client) => {
          const clientInfo = clients.get(client);
          if (client !== ws && client.readyState === 1 && clientInfo) {
            client.send(JSON.stringify({
              type: 'message_notification',
              conversationId: data.conversationId,
              messageId: data.messageId
            }));
          }
        });
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  ws.on('close', (code, reason) => {
    const clientData = clients.get(ws);
    clients.delete(ws);
    console.log(`🔌 WebSocket déconnecté (code: ${code}, reason: ${reason?.toString() || ''}, userId: ${clientData?.userId || 'unknown'})`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
