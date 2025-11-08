import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Connexion
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Email invalide'),
    body('password').notEmpty().withMessage('Mot de passe requis'),
  ],
  async (req: any, res: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      const user = result.rows[0];

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Identifiants invalides' });
      }

      // Mettre à jour last_login
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

      // Créer le token JWT
      const token = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '7d' }
      );

      // Log d'activité
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, entity_type) VALUES ($1, $2, $3)',
        [user.id, 'login', 'user']
      );

      res.json({
        message: 'Connexion réussie',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          department: user.department_id,
          position: user.position,
          avatarUrl: user.avatar_url,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// Obtenir le profil utilisateur
router.get('/me', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(
      `SELECT u.*, d.name as department_name 
       FROM users u 
       LEFT JOIN departments d ON u.department_id = d.id 
       WHERE u.id = $1`,
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      department: {
        id: user.department_id,
        name: user.department_name,
      },
      position: user.position,
      phone: user.phone,
      avatarUrl: user.avatar_url,
      lastLogin: user.last_login,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
