import { Router } from 'express';
import pool from '../config/database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configuration de multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/drive');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

const router = Router();

// Vérifier si l'utilisateur a accès (admin/manager seulement)
const checkDriveAccess = (req: AuthRequest, res: any, next: any) => {
  if (req.userRole === 'admin' || req.userRole === 'manager') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé. Réservé aux managers et admins.' });
  }
};

// Obtenir tous les dossiers
router.get('/folders', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  try {
    const result = await pool.query(`
      SELECT f.*, u.first_name, u.last_name,
        (SELECT COUNT(*) FROM drive_files WHERE folder_id = f.id) as file_count,
        (SELECT COUNT(*) FROM drive_folders WHERE parent_id = f.id) as subfolder_count
      FROM drive_folders f
      LEFT JOIN users u ON f.created_by = u.id
      ORDER BY f.parent_id NULLS FIRST, f.name ASC
    `);

    res.json({ folders: result.rows });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Créer un nouveau dossier
router.post('/folders', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { name, parent_id, description, color, is_public } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Le nom du dossier est requis' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO drive_folders (name, parent_id, created_by, description, color, is_public)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, parent_id || null, req.userId, description, color || '#3b82f6', is_public || false]
    );

    // Log d'activité
    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, 'create_folder', 'drive_folder', result.rows[0].id, JSON.stringify({ name })]
    );

    res.status(201).json({ folder: result.rows[0] });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un dossier
router.put('/folders/:id', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const { name, description, color, is_public } = req.body;

  try {
    const result = await pool.query(
      `UPDATE drive_folders 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           color = COALESCE($3, color),
           is_public = COALESCE($4, is_public),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [name, description, color, is_public, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.userId, 'update_folder', 'drive_folder', id]
    );

    res.json({ folder: result.rows[0] });
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un dossier
router.delete('/folders/:id', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  try {
    // Récupérer tous les fichiers du dossier et sous-dossiers
    const filesResult = await pool.query(`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM drive_folders WHERE id = $1
        UNION ALL
        SELECT f.id FROM drive_folders f
        INNER JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT df.file_path FROM drive_files df
      WHERE df.folder_id IN (SELECT id FROM folder_tree)
    `, [id]);

    // Supprimer les fichiers physiques
    for (const file of filesResult.rows) {
      const filePath = path.join(__dirname, '../../uploads/drive', path.basename(file.file_path));
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Supprimer le dossier (cascade supprime les sous-dossiers et fichiers en base)
    await pool.query('DELETE FROM drive_folders WHERE id = $1', [id]);

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
      [req.userId, 'delete_folder', 'drive_folder', id]
    );

    res.json({ message: 'Dossier supprimé avec succès' });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir les fichiers d'un dossier
router.get('/folders/:id/files', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`
      SELECT f.*, u.first_name, u.last_name
      FROM drive_files f
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.folder_id = $1
      ORDER BY f.created_at DESC
    `, [id]);

    res.json({ files: result.rows });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Upload un fichier dans un dossier
router.post('/folders/:id/files', authenticateToken, checkDriveAccess, upload.single('file'), async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const file = req.file;
  const { description } = req.body;

  if (!file) {
    return res.status(400).json({ error: 'Aucun fichier fourni' });
  }

  try {
    // Vérifier que le dossier existe
    const folderCheck = await pool.query('SELECT id FROM drive_folders WHERE id = $1', [id]);
    if (folderCheck.rows.length === 0) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ error: 'Dossier non trouvé' });
    }

    const result = await pool.query(
      `INSERT INTO drive_files (folder_id, name, original_name, file_path, file_size, mime_type, uploaded_by, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, file.filename, file.originalname, file.filename, file.size, file.mimetype, req.userId, description]
    );

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, 'upload_file', 'drive_file', result.rows[0].id, JSON.stringify({ filename: file.originalname, size: file.size })]
    );

    res.status(201).json({ file: result.rows[0] });
  } catch (error) {
    console.error('Upload file error:', error);
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Télécharger un fichier
router.get('/files/:id/download', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM drive_files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads/drive', path.basename(file.file_path));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Fichier physique introuvable' });
    }

    res.download(filePath, file.original_name);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Mettre à jour un fichier (renommer)
router.put('/files/:id', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;
  const { original_name, description } = req.body;

  try {
    const fileCheck = await pool.query('SELECT * FROM drive_files WHERE id = $1', [id]);
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (original_name) {
      updates.push(`original_name = $${paramIndex}`);
      values.push(original_name);
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }

    values.push(id);
    const query = `UPDATE drive_files SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, values);

    res.json({ file: result.rows[0] });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un fichier
router.delete('/files/:id', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM drive_files WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const file = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads/drive', path.basename(file.file_path));

    // Supprimer le fichier physique
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer de la base de données
    await pool.query('DELETE FROM drive_files WHERE id = $1', [id]);

    await pool.query(
      'INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details) VALUES ($1, $2, $3, $4, $5)',
      [req.userId, 'delete_file', 'drive_file', id, JSON.stringify({ filename: file.original_name })]
    );

    res.json({ message: 'Fichier supprimé avec succès' });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Rechercher des fichiers
router.get('/search', authenticateToken, checkDriveAccess, async (req: AuthRequest, res: any) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Requête de recherche manquante' });
  }

  try {
    const result = await pool.query(`
      SELECT f.*, fo.name as folder_name, u.first_name, u.last_name
      FROM drive_files f
      LEFT JOIN drive_folders fo ON f.folder_id = fo.id
      LEFT JOIN users u ON f.uploaded_by = u.id
      WHERE f.original_name ILIKE $1 OR f.description ILIKE $1
      ORDER BY f.created_at DESC
      LIMIT 50
    `, [`%${query}%`]);

    res.json({ files: result.rows });
  } catch (error) {
    console.error('Search files error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
