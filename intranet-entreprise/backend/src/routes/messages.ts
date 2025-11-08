import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configuration multer pour les images de messages
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/messages';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées (JPEG, PNG, GIF, WEBP)'));
    }
  }
});

// Obtenir toutes les conversations de l'utilisateur
router.get('/conversations', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
              cp.is_pinned,
              COUNT(DISTINCT m.id) as message_count,
              MAX(m.created_at) as last_message_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              (
                SELECT COUNT(*)::int 
                FROM messages m2
                WHERE m2.conversation_id = c.id 
                AND m2.sender_id != $1
                AND (m2.created_at > cp.last_read_at OR cp.last_read_at IS NULL)
              ) as unread_count,
              CASE 
                WHEN c.type = 'group' THEN c.name
                ELSE (
                  SELECT STRING_AGG(u.first_name || ' ' || u.last_name, ', ' ORDER BY u.first_name)
                  FROM conversation_participants cp2
                  JOIN users u ON cp2.user_id = u.id
                  WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
                )
              END as display_name
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE cp.user_id = $1
       GROUP BY c.id, cp.last_read_at, cp.is_pinned
       ORDER BY cp.is_pinned DESC, last_message_at DESC NULLS LAST`,
      [req.userId]
    );

    res.json({ conversations: result.rows });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les messages d'une conversation
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res: any) => {
  const conversationId = parseInt(req.params.id);
  const markRead = req.query.mark_read === 'true'; // Marquer comme lu uniquement si explicitement demandé

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const participantCheck = await pool.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, req.userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    // Marquer les messages comme lus UNIQUEMENT si mark_read=true
    if (markRead) {
      await pool.query(
        'UPDATE conversation_participants SET last_read_at = NOW() WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, req.userId]
      );
    }

    const result = await pool.query(
      `SELECT m.*, 
              u.first_name as sender_first_name, 
              u.last_name as sender_last_name,
              (
                SELECT BOOL_AND(cp.last_read_at >= m.created_at)
                FROM conversation_participants cp
                WHERE cp.conversation_id = m.conversation_id 
                AND cp.user_id != m.sender_id
                AND cp.last_read_at IS NOT NULL
              ) as is_read_by_others
       FROM messages m
       LEFT JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une nouvelle conversation
router.post('/conversations', authenticateToken, async (req: AuthRequest, res: any) => {
  const { name, type, participant_ids } = req.body;

  try {
    // Pour les conversations directes (1 à 1), vérifier si une conversation existe déjà
    if (type === 'direct' && participant_ids && participant_ids.length === 1) {
      const otherUserId = participant_ids[0];
      
      // Trouver une conversation existante entre ces 2 utilisateurs
      const existingConv = await pool.query(
        `SELECT c.* FROM conversations c
         WHERE c.type = 'direct'
         AND EXISTS (
           SELECT 1 FROM conversation_participants cp1 
           WHERE cp1.conversation_id = c.id AND cp1.user_id = $1
         )
         AND EXISTS (
           SELECT 1 FROM conversation_participants cp2 
           WHERE cp2.conversation_id = c.id AND cp2.user_id = $2
         )
         AND (
           SELECT COUNT(*) FROM conversation_participants cp 
           WHERE cp.conversation_id = c.id
         ) = 2
         LIMIT 1`,
        [req.userId, otherUserId]
      );

      if (existingConv.rows.length > 0) {
        // Conversation existe déjà, la retourner
        return res.status(200).json({ conversation: existingConv.rows[0], existing: true });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Créer la conversation
      const conversationResult = await client.query(
        `INSERT INTO conversations (name, type, created_by) 
         VALUES ($1, $2, $3) 
         RETURNING *`,
        [name, type || 'private', req.userId]
      );

      const conversationId = conversationResult.rows[0].id;

      // Ajouter le créateur comme participant
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
        [conversationId, req.userId]
      );

      // Ajouter les autres participants
      if (participant_ids && participant_ids.length > 0) {
        for (const participantId of participant_ids) {
          if (participantId !== req.userId) {
            await client.query(
              'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
              [conversationId, participantId]
            );
          }
        }
      }

      await client.query('COMMIT');
      res.status(201).json({ conversation: conversationResult.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Envoyer un message (avec ou sans image)
router.post('/messages', authenticateToken, upload.single('image'), async (req: AuthRequest, res: any) => {
  const { conversation_id, content, attachments } = req.body;

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const participantCheck = await pool.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversation_id, req.userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    // Gérer l'image si elle existe
    let imageName = null;
    let imagePath = null;
    if (req.file) {
      imageName = req.file.originalname;
      imagePath = req.file.path;
    }

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, attachments, image_name, image_path) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        conversation_id, 
        req.userId, 
        content || null, 
        attachments ? JSON.stringify(attachments) : null,
        imageName,
        imagePath
      ]
    );

    res.status(201).json({ message: result.rows[0] });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Télécharger l'image d'un message
router.get('/messages/:id/image', authenticateToken, async (req: AuthRequest, res: any) => {
  const messageId = parseInt(req.params.id);

  try {
    // Récupérer le message
    const messageResult = await pool.query(
      'SELECT * FROM messages WHERE id = $1',
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message non trouvé' });
    }

    const message = messageResult.rows[0];

    // Vérifier que l'utilisateur a accès à cette conversation
    const participantCheck = await pool.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [message.conversation_id, req.userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    if (!message.image_path || !message.image_name) {
      return res.status(404).json({ error: 'Aucune image pour ce message' });
    }

    // Envoyer le fichier
    res.download(message.image_path, message.image_name, (err: any) => {
      if (err) {
        console.error('Download error:', err);
        if (!res.headersSent) {
          res.status(404).json({ error: 'Fichier introuvable' });
        }
      }
    });
  } catch (error) {
    console.error('Get message image error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un message
router.delete('/messages/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  const messageId = parseInt(req.params.id);

  try {
    // Vérifier que le message existe et appartient à l'utilisateur
    const messageResult = await pool.query(
      'SELECT * FROM messages WHERE id = $1 AND sender_id = $2',
      [messageId, req.userId]
    );

    if (messageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Message non trouvé ou non autorisé' });
    }

    const message = messageResult.rows[0];

    // Supprimer l'image physique si elle existe
    if (message.image_path && fs.existsSync(message.image_path)) {
      fs.unlinkSync(message.image_path);
    }

    // Supprimer le message de la base de données
    await pool.query('DELETE FROM messages WHERE id = $1', [messageId]);

    res.json({ message: 'Message supprimé avec succès' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir la liste des utilisateurs (pour créer une nouvelle conversation)
router.get('/users', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, position, 
              (SELECT name FROM departments WHERE id = users.department_id) as department_name
       FROM users
       WHERE id != $1
       ORDER BY first_name, last_name`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Basculer l'épinglage d'une conversation
router.put('/conversations/:id/pin', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { is_pinned } = req.body;

    // Mettre à jour is_pinned pour ce participant
    await pool.query(
      `UPDATE conversation_participants 
       SET is_pinned = $1 
       WHERE conversation_id = $2 AND user_id = $3`,
      [is_pinned, conversationId, req.userId]
    );

    res.json({ success: true, is_pinned });
  } catch (error) {
    console.error('Pin conversation error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une conversation (pour l'utilisateur actuel)
router.delete('/conversations/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const conversationId = parseInt(req.params.id);

    // Supprimer seulement la participation de l'utilisateur
    await pool.query(
      `DELETE FROM conversation_participants 
       WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, req.userId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir le nombre total de messages non lus
router.get('/unread-count', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(unread_count), 0)::int as total_unread
       FROM (
         SELECT COUNT(*)::int as unread_count
         FROM messages m
         INNER JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
         WHERE cp.user_id = $1
         AND m.sender_id != $1
         AND (m.created_at > cp.last_read_at OR cp.last_read_at IS NULL)
         GROUP BY cp.conversation_id
       ) as unread_per_conversation`,
      [req.userId]
    );

    res.json({ total_unread: result.rows[0].total_unread });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
