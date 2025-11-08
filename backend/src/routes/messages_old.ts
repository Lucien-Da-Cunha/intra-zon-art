import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Obtenir toutes les conversations de l'utilisateur
router.get('/conversations', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT c.*, 
              COUNT(DISTINCT m.id) as message_count,
              MAX(m.created_at) as last_message_at,
              (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
              0 as unread_count,
              (
                SELECT STRING_AGG(u.first_name || ' ' || u.last_name, ', ' ORDER BY u.first_name)
                FROM conversation_participants cp2
                JOIN users u ON cp2.user_id = u.id
                WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
              ) as participants_names
       FROM conversations c
       INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
       LEFT JOIN messages m ON c.id = m.conversation_id
       WHERE cp.user_id = $1
       GROUP BY c.id
       ORDER BY last_message_at DESC NULLS LAST`,
      [req.userId]
    );

    // Améliorer les noms des conversations
    const conversations = result.rows.map((conv: any) => ({
      ...conv,
      display_name: conv.type === 'direct' 
        ? conv.participants_names || conv.name
        : conv.name
    }));

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les messages d'une conversation
router.get('/conversations/:id/messages', authenticateToken, async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  try {
    // Vérifier que l'utilisateur fait partie de la conversation
    const participantCheck = await pool.query(
      'SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (participantCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Accès non autorisé à cette conversation' });
    }

    const result = await pool.query(
      `SELECT m.*, 
              u.first_name || ' ' || u.last_name as sender_name,
              u.avatar_url
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une nouvelle conversation
router.post('/conversations', authenticateToken, async (req: AuthRequest, res: any) => {
  const { name, type, participantIds } = req.body;

  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Créer la conversation
      const conversationResult = await client.query(
        'INSERT INTO conversations (name, type, created_by) VALUES ($1, $2, $3) RETURNING *',
        [name, type, req.userId]
      );

      const conversation = conversationResult.rows[0];

      // Ajouter les participants (incluant le créateur)
      const allParticipants = [...new Set([req.userId, ...participantIds])];
      
      for (const participantId of allParticipants) {
        await client.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2)',
          [conversation.id, participantId]
        );
      }

      await client.query('COMMIT');

      res.status(201).json({ conversation });
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

// Envoyer un message
router.post('/messages', authenticateToken, async (req: AuthRequest, res: any) => {
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

    const result = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content, attachments) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [conversation_id, req.userId, content, attachments ? JSON.stringify(attachments) : null]
    );

    const message = result.rows[0];

    // Récupérer les infos du sender
    const userResult = await pool.query(
      `SELECT first_name || ' ' || last_name as sender_name FROM users WHERE id = $1`,
      [req.userId]
    );

    const fullMessage = {
      ...message,
      sender_name: userResult.rows[0].sender_name
    };

    res.status(201).json(fullMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir tous les utilisateurs (pour créer des conversations)
router.get('/users', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.position, u.avatar_url, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.is_active = true AND u.id != $1
       ORDER BY u.first_name, u.last_name`,
      [req.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
