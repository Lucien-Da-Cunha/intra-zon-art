import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers PDF sont acceptés'));
    }
  }
});

const router = Router();

// Obtenir toutes les ventes (avec filtres)
router.get('/', authenticateToken, async (req: AuthRequest, res: any) => {
  const { startDate, endDate, status, userId, departmentId } = req.query;

  try {
    let query = `
      SELECT s.*, u.first_name, u.last_name, d.name as department_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN departments d ON s.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filtre par rôle : les employés ne voient que leurs ventes
    if (req.userRole === 'employee') {
      query += ` AND s.user_id = $${paramIndex}`;
      params.push(req.userId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND s.sale_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND s.sale_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (userId) {
      query += ` AND s.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (departmentId) {
      query += ` AND s.department_id = $${paramIndex}`;
      params.push(departmentId);
      paramIndex++;
    }

    query += ' ORDER BY s.sale_date DESC';

    const result = await pool.query(query, params);

    const sales = result.rows.map(row => ({
      ...row,
      amount: parseFloat(row.amount)
    }));

    res.json({ sales });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les statistiques de ventes
router.get('/stats', authenticateToken, async (req: AuthRequest, res: any) => {
  const { start_date, end_date, startDate, endDate } = req.query;
  
  // Support both snake_case and camelCase for compatibility
  const filterStartDate = start_date || startDate;
  const filterEndDate = end_date || endDate;

  try {
    let query = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END) as pending_amount,
        AVG(CASE WHEN status = 'completed' THEN amount ELSE NULL END) as average_sale
      FROM sales
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filtre par rôle
    if (req.userRole === 'employee') {
      query += ` AND user_id = $${paramIndex}`;
      params.push(req.userId);
      paramIndex++;
    }

    if (filterStartDate) {
      query += ` AND sale_date >= $${paramIndex}`;
      params.push(filterStartDate);
      paramIndex++;
    }

    if (filterEndDate) {
      query += ` AND sale_date <= $${paramIndex}`;
      params.push(filterEndDate);
      paramIndex++;
    }

    const result = await pool.query(query, params);
    const stats = result.rows[0];

    // Stats par département (pour admin et managers)
    let departmentStats = [];
    if (req.userRole !== 'employee') {
      const deptQuery = `
        SELECT d.name, SUM(s.amount) as total, COUNT(s.id) as count
        FROM sales s
        JOIN departments d ON s.department_id = d.id
        WHERE s.status = 'completed'
        ${filterStartDate ? `AND s.sale_date >= $1` : ''}
        ${filterEndDate ? `AND s.sale_date <= $${filterStartDate ? 2 : 1}` : ''}
        GROUP BY d.id, d.name
        ORDER BY total DESC
      `;
      const deptParams = [];
      if (filterStartDate) deptParams.push(filterStartDate);
      if (filterEndDate) deptParams.push(filterEndDate);
      
      const deptResult = await pool.query(deptQuery, deptParams);
      departmentStats = deptResult.rows.map(row => ({
        ...row,
        total: parseFloat(row.total)
      }));
    }

    res.json({
      totalSales: parseInt(stats.total_sales),
      totalRevenue: parseFloat(stats.total_revenue) || 0,
      pendingAmount: parseFloat(stats.pending_amount) || 0,
      averageSale: parseFloat(stats.average_sale) || 0,
      departmentStats,
    });
  } catch (error) {
    console.error('Get sales stats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer une nouvelle vente
router.post('/', authenticateToken, async (req: AuthRequest, res: any) => {
  const { customer_name, product_service, amount, status, description, sale_date, user_id } = req.body;

  try {
    // Si user_id est fourni (admin/manager créant pour quelqu'un), l'utiliser, sinon utiliser req.userId
    const actualUserId = user_id || req.userId;
    
    // Récupérer le département de l'utilisateur
    const userResult = await pool.query('SELECT department_id FROM users WHERE id = $1', [actualUserId]);
    const departmentId = userResult.rows[0].department_id;

    const result = await pool.query(
      `INSERT INTO sales (user_id, department_id, customer_name, product_service, amount, status, description, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [actualUserId, departmentId, customer_name, product_service, amount, status || 'pending', description, sale_date || new Date()]
    );

    const sale = result.rows[0];

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, 'create_sale', 'sale', sale.id, JSON.stringify({ amount, customer_name })]
    );

    res.status(201).json({
      sale: {
        ...sale,
        amount: parseFloat(sale.amount)
      }
    });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour une vente
router.put('/:id', authenticateToken, async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const { customer_name, product_service, amount, status, description, sale_date } = req.body;

  try {
    // Vérifier que la vente appartient à l'utilisateur ou que c'est un admin/manager
    const checkQuery = req.userRole === 'employee'
      ? 'SELECT * FROM sales WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM sales WHERE id = $1';
    
    const checkParams = req.userRole === 'employee' ? [id, req.userId] : [id];
    const checkResult = await pool.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    const result = await pool.query(
      `UPDATE sales 
       SET customer_name = $1, product_service = $2, amount = $3, status = $4, description = $5, sale_date = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 RETURNING *`,
      [customer_name, product_service, amount, status, description, sale_date, id]
    );

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.userId, 'update_sale', 'sale', id]
    );

    res.json({
      sale: {
        ...result.rows[0],
        amount: parseFloat(result.rows[0].amount)
      }
    });
  } catch (error) {
    console.error('Update sale error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer une vente (admin/manager seulement)
router.delete('/:id', authenticateToken, requireRole('admin', 'manager'), async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  try {
    // Récupérer les noms de fichiers avant suppression
    const saleResult = await pool.query('SELECT contract_file_path, invoice_file_path FROM sales WHERE id = $1', [id]);
    const sale = saleResult.rows[0];

    // Supprimer les fichiers physiques s'ils existent
    if (sale.contract_file_path) {
      const contractPath = path.join(__dirname, '../../uploads', path.basename(sale.contract_file_path));
      if (fs.existsSync(contractPath)) {
        fs.unlinkSync(contractPath);
      }
    }
    if (sale.invoice_file_path) {
      const invoicePath = path.join(__dirname, '../../uploads', path.basename(sale.invoice_file_path));
      if (fs.existsSync(invoicePath)) {
        fs.unlinkSync(invoicePath);
      }
    }

    await pool.query('DELETE FROM sales WHERE id = $1', [id]);

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.userId, 'delete_sale', 'sale', id]
    );

    res.json({ message: 'Vente supprimée' });
  } catch (error) {
    console.error('Delete sale error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload d'un fichier (contrat ou facture) pour une vente
router.post('/:id/upload/:type', authenticateToken, upload.single('file'), async (req: AuthRequest, res: any) => {
  const { id, type } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  if (type !== 'contract' && type !== 'invoice') {
    return res.status(400).json({ error: 'Type de fichier invalide. Utilisez "contract" ou "invoice"' });
  }

  try {
    // Vérifier que la vente existe et appartient à l'utilisateur (ou admin/manager)
    const checkQuery = req.userRole === 'employee'
      ? 'SELECT * FROM sales WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM sales WHERE id = $1';
    
    const checkParams = req.userRole === 'employee' ? [id, req.userId] : [id];
    const checkResult = await pool.query(checkQuery, checkParams);

    if (checkResult.rows.length === 0) {
      // Supprimer le fichier uploadé
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    // Supprimer l'ancien fichier s'il existe
    const oldSale = checkResult.rows[0];
    const fileField = type === 'contract' ? 'contract_file_path' : 'invoice_file_path';
    if (oldSale[fileField]) {
      const oldFilePath = path.join(__dirname, '../../uploads', path.basename(oldSale[fileField]));
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Mettre à jour la base de données
    const fileNameField = type === 'contract' ? 'contract_file_name' : 'invoice_file_name';
    const filePathField = type === 'contract' ? 'contract_file_path' : 'invoice_file_path';
    
    const result = await pool.query(
      `UPDATE sales SET ${fileNameField} = $1, ${filePathField} = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *`,
      [file.originalname, file.filename, id]
    );

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, `upload_${type}`, 'sale', id, JSON.stringify({ filename: file.originalname })]
    );

    res.json({
      message: 'Fichier uploadé avec succès',
      sale: result.rows[0]
    });
  } catch (error) {
    console.error('Upload file error:', error);
    // Supprimer le fichier en cas d'erreur
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Télécharger un fichier (contrat ou facture)
router.get('/:id/download/:type', authenticateToken, async (req: AuthRequest, res: any) => {
  const { id, type } = req.params;

  if (type !== 'contract' && type !== 'invoice') {
    return res.status(400).json({ error: 'Type de fichier invalide' });
  }

  try {
    // Vérifier que la vente existe et appartient à l'utilisateur (ou admin/manager)
    const checkQuery = req.userRole === 'employee'
      ? 'SELECT * FROM sales WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM sales WHERE id = $1';
    
    const checkParams = req.userRole === 'employee' ? [id, req.userId] : [id];
    const result = await pool.query(checkQuery, checkParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    const sale = result.rows[0];
    const filePathField = type === 'contract' ? 'contract_file_path' : 'invoice_file_path';
    const fileNameField = type === 'contract' ? 'contract_file_name' : 'invoice_file_name';

    if (!sale[filePathField]) {
      return res.status(404).json({ error: 'Aucun fichier trouvé' });
    }

    const filePath = path.join(__dirname, '../../uploads', path.basename(sale[filePathField]));
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier physique introuvable' });
    }

    res.download(filePath, sale[fileNameField]);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un fichier (contrat ou facture)
router.delete('/:id/file/:type', authenticateToken, async (req: AuthRequest, res: any) => {
  const { id, type } = req.params;

  if (type !== 'contract' && type !== 'invoice') {
    return res.status(400).json({ error: 'Type de fichier invalide' });
  }

  try {
    // Vérifier que la vente existe et appartient à l'utilisateur (ou admin/manager)
    const checkQuery = req.userRole === 'employee'
      ? 'SELECT * FROM sales WHERE id = $1 AND user_id = $2'
      : 'SELECT * FROM sales WHERE id = $1';
    
    const checkParams = req.userRole === 'employee' ? [id, req.userId] : [id];
    const result = await pool.query(checkQuery, checkParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vente non trouvée' });
    }

    const sale = result.rows[0];
    const filePathField = type === 'contract' ? 'contract_file_path' : 'invoice_file_path';

    if (!sale[filePathField]) {
      return res.status(404).json({ error: 'Aucun fichier à supprimer' });
    }

    // Supprimer le fichier physique
    const filePath = path.join(__dirname, '../../uploads', path.basename(sale[filePathField]));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Mettre à jour la base de données
    const fileNameField = type === 'contract' ? 'contract_file_name' : 'invoice_file_name';
    await pool.query(
      `UPDATE sales SET ${fileNameField} = NULL, ${filePathField} = NULL WHERE id = $1`,
      [id]
    );

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.userId, `delete_${type}`, 'sale', id]
    );

    res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
