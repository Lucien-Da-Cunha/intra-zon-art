import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configuration multer pour les reçus
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/receipts';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `receipt-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype === 'application/pdf';
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers images et PDF sont autorisés'));
    }
  }
});

// Obtenir toutes les dépenses (avec filtres)
router.get('/', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { status, category, start_date, end_date, user_id } = req.query;
    
    let query = `
      SELECT e.*, 
             u.first_name || ' ' || u.last_name as user_name,
             u.email as user_email
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // Filtre par utilisateur (admin peut voir tout, user voit ses dépenses)
    if (req.user?.role !== 'admin') {
      query += ` AND e.user_id = $${paramIndex}`;
      params.push(req.userId);
      paramIndex++;
    } else if (user_id) {
      query += ` AND e.user_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (category) {
      query += ` AND e.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND e.expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND e.expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ expenses: result.rows });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les statistiques des dépenses
router.get('/stats', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        COUNT(*) as total_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as approved_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN amount ELSE 0 END), 0) as rejected_amount,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count
      FROM expenses
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    // Filtre par utilisateur
    if (req.user?.role !== 'admin') {
      query += ` AND user_id = $${paramIndex}`;
      params.push(req.userId);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND expense_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND expense_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    const result = await pool.query(query, params);

    // Statistiques par catégorie
    let categoryQuery = `
      SELECT 
        category,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE 1=1
    `;
    
    const categoryParams: any[] = [];
    let categoryParamIndex = 1;

    if (req.user?.role !== 'admin') {
      categoryQuery += ` AND user_id = $${categoryParamIndex}`;
      categoryParams.push(req.userId);
      categoryParamIndex++;
    }

    if (start_date) {
      categoryQuery += ` AND expense_date >= $${categoryParamIndex}`;
      categoryParams.push(start_date);
      categoryParamIndex++;
    }

    if (end_date) {
      categoryQuery += ` AND expense_date <= $${categoryParamIndex}`;
      categoryParams.push(end_date);
      categoryParamIndex++;
    }

    categoryQuery += ' GROUP BY category ORDER BY total DESC';

    const categoryResult = await pool.query(categoryQuery, categoryParams);

    res.json({
      stats: result.rows[0],
      by_category: categoryResult.rows
    });
  } catch (error) {
    console.error('Get expenses stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une nouvelle dépense
router.post('/', authenticateToken, upload.single('receipt'), async (req: AuthRequest, res: any) => {
  try {
    const { title, description, amount, category, expense_date } = req.body;
    const receiptPath = req.file ? req.file.path : null;

    const result = await pool.query(
      `INSERT INTO expenses (user_id, title, description, amount, category, expense_date, receipt_path, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING *`,
      [req.userId, title, description, amount, category, expense_date, receiptPath]
    );

    res.status(201).json({ expense: result.rows[0] });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la dépense' });
  }
});

// Mettre à jour une dépense
router.put('/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const expenseId = parseInt(req.params.id);
    const { title, description, amount, category, expense_date, status } = req.body;

    // Vérifier que la dépense appartient à l'utilisateur (sauf admin)
    const checkResult = await pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    if (req.user?.role !== 'admin' && checkResult.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // L'utilisateur ne peut modifier que certains champs, l'admin peut tout modifier
    let updateQuery = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (req.user?.role === 'admin') {
      // Admin peut changer le statut
      updateQuery = `
        UPDATE expenses 
        SET title = $${paramIndex++}, 
            description = $${paramIndex++}, 
            amount = $${paramIndex++}, 
            category = $${paramIndex++}, 
            expense_date = $${paramIndex++}, 
            status = $${paramIndex++},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      params.push(title, description, amount, category, expense_date, status, expenseId);
    } else {
      // Utilisateur normal ne peut pas changer le statut
      updateQuery = `
        UPDATE expenses 
        SET title = $${paramIndex++}, 
            description = $${paramIndex++}, 
            amount = $${paramIndex++}, 
            category = $${paramIndex++}, 
            expense_date = $${paramIndex++},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      params.push(title, description, amount, category, expense_date, expenseId);
    }

    const result = await pool.query(updateQuery, params);
    res.json({ expense: result.rows[0] });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour' });
  }
});

// Supprimer une dépense
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const expenseId = parseInt(req.params.id);

    // Vérifier que la dépense appartient à l'utilisateur (sauf admin)
    const checkResult = await pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    if (req.user?.role !== 'admin' && checkResult.rows[0].user_id !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Supprimer le fichier reçu s'il existe
    if (checkResult.rows[0].receipt_path && fs.existsSync(checkResult.rows[0].receipt_path)) {
      fs.unlinkSync(checkResult.rows[0].receipt_path);
    }

    await pool.query('DELETE FROM expenses WHERE id = $1', [expenseId]);
    res.json({ message: 'Dépense supprimée' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Télécharger un reçu
router.get('/:id/receipt', authenticateToken, async (req: AuthRequest, res: any) => {
  try {
    const expenseId = parseInt(req.params.id);

    const result = await pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [expenseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dépense non trouvée' });
    }

    const expense = result.rows[0];

    // Vérifier l'autorisation
    if (req.user?.role !== 'admin' && expense.user_id !== req.userId) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    if (!expense.receipt_path || !fs.existsSync(expense.receipt_path)) {
      return res.status(404).json({ error: 'Reçu non trouvé' });
    }

    res.download(expense.receipt_path, path.basename(expense.receipt_path), (err: any) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).json({ error: 'Erreur lors du téléchargement' });
      }
    });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
