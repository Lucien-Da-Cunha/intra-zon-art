import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import bcrypt from 'bcrypt';

const router = Router();

// Toutes les routes nécessitent le rôle admin
router.use(authenticateToken, requireRole('admin'));

// Obtenir tous les utilisateurs
router.get('/users', async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       ORDER BY u.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un utilisateur
router.post('/users', async (req: any, res: any) => {
  const { email, password, first_name, last_name, role, department_id, position } = req.body;
  
  try {
    // Vérifier si l'email existe déjà
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, department_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [email, passwordHash, first_name, last_name, role, department_id, position]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// Mettre à jour un utilisateur
router.put('/users/:id', async (req: any, res: any) => {
  const { id } = req.params;
  const { email, password, first_name, last_name, role, department_id, position } = req.body;
  
  try {
    // Si un mot de passe est fourni, le hasher
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      const result = await pool.query(
        `UPDATE users 
         SET email = $1, password_hash = $2, first_name = $3, last_name = $4, role = $5, 
             department_id = $6, position = $7, updated_at = CURRENT_TIMESTAMP
         WHERE id = $8 RETURNING *`,
        [email, passwordHash, first_name, last_name, role, department_id, position, id]
      );
      return res.json(result.rows[0]);
    } else {
      // Sans changement de mot de passe
      const result = await pool.query(
        `UPDATE users 
         SET email = $1, first_name = $2, last_name = $3, role = $4, 
             department_id = $5, position = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [email, first_name, last_name, role, department_id, position, id]
      );
      return res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'utilisateur' });
  }
});

// Supprimer un utilisateur
router.delete('/users/:id', async (req: any, res: any) => {
  const { id } = req.params;
  
  try {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Vérifier que l'utilisateur existe
      const userCheck = await client.query('SELECT id, email FROM users WHERE id = $1', [id]);
      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Supprimer les données liées à l'utilisateur
      // 1. Supprimer les messages de l'utilisateur
      await client.query('DELETE FROM messages WHERE sender_id = $1', [id]);
      
      // 2. Retirer l'utilisateur des conversations
      await client.query('DELETE FROM conversation_participants WHERE user_id = $1', [id]);
      
      // 3. Supprimer les ventes de l'utilisateur
      await client.query('DELETE FROM sales WHERE user_id = $1', [id]);
      
      // 4. Supprimer les logs d'activité de l'utilisateur
      await client.query('DELETE FROM activity_logs WHERE user_id = $1', [id]);
      
      // 5. Supprimer les conversations créées par l'utilisateur (optionnel)
      // Note: On pourrait aussi réassigner à un autre utilisateur
      await client.query('UPDATE conversations SET created_by = NULL WHERE created_by = $1', [id]);
      
      // 6. Finalement supprimer l'utilisateur
      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');
      
      res.json({ 
        message: 'Utilisateur et toutes ses données associées supprimés avec succès',
        deletedUser: userCheck.rows[0].email
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Erreur lors de la suppression de l\'utilisateur',
      details: error.message 
    });
  }
});

// Obtenir les logs d'activité
router.get('/activity-logs', async (req: any, res: any) => {
  const { limit = 100, offset = 0 } = req.query;
  
  try {
    const result = await pool.query(
      `SELECT a.*, u.first_name, u.last_name, u.email
       FROM activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY a.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ logs: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir tous les départements
router.get('/departments', async (req: any, res: any) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un département
router.post('/departments', async (req: any, res: any) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json({ department: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
