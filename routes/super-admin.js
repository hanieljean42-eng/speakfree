// routes/super-admin.js - Gestion Super Administrateur (MySQL)
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'speakfree_secret_key_2024';
const SUPER_ADMIN_CODE = '200700';

// Middleware de vérification du token
const verifyToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Token requis' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide' });
    }
};

// Middleware pour vérifier le super admin
const verifySuperAdmin = async (req, res, next) => {
    const db = req.db;
    
    try {
        const [users] = await db.execute(
            'SELECT is_super_admin FROM users WHERE id = ?',
            [req.user.id]
        );
        
        if (users.length === 0 || !users[0].is_super_admin) {
            return res.status(403).json({ error: 'Accès réservé aux super administrateurs' });
        }
        
        next();
    } catch (error) {
        console.error('Erreur verify super admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// POST /api/super-admin/verify-code
router.post('/verify-code', (req, res) => {
    const { code } = req.body;
    
    if (code === SUPER_ADMIN_CODE) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false, error: 'Code invalide' });
    }
});

// GET /api/super-admin/stats (route simple sans auth pour le dashboard public)
router.get('/stats', async (req, res) => {
    const db = req.db;
    
    if (!db) {
        console.error('[SUPER-ADMIN] DB non disponible pour /stats');
        return res.status(503).json({ error: 'Service temporairement indisponible' });
    }
    
    try {
        const [[{ totalSchools }]] = await db.execute('SELECT COUNT(*) as totalSchools FROM schools');
        const [[{ activeSchools }]] = await db.execute('SELECT COUNT(*) as activeSchools FROM schools WHERE status = "active"');
        const [[{ pendingSchools }]] = await db.execute('SELECT COUNT(*) as pendingSchools FROM schools WHERE status = "pending"');
        const [[{ totalReports }]] = await db.execute('SELECT COUNT(*) as totalReports FROM reports');
        const [[{ pendingReports }]] = await db.execute('SELECT COUNT(*) as pendingReports FROM reports WHERE status = "pending"');
        
        // Compter les admins - utiliser users au lieu de admins si la table n'existe pas
        let totalAdmins = 0;
        try {
            const [[result]] = await db.execute('SELECT COUNT(*) as totalAdmins FROM admins');
            totalAdmins = result.totalAdmins;
        } catch (e) {
            // Table admins n'existe peut-être pas, essayer users
            try {
                const [[result]] = await db.execute('SELECT COUNT(*) as totalAdmins FROM users WHERE role = "admin"');
                totalAdmins = result.totalAdmins;
            } catch (e2) {
                totalAdmins = 0;
            }
        }
        
        res.json({
            totalSchools,
            activeSchools,
            pendingSchools,
            totalReports,
            pendingReports,
            totalAdmins
        });
        
    } catch (error) {
        console.error('[SUPER-ADMIN] Erreur stats:', error.message);
        res.status(500).json({ error: 'Erreur serveur', message: error.message });
    }
});

// GET /api/super-admin/schools/pending
router.get('/schools/pending', async (req, res) => {
    const db = req.db;
    
    try {
        const [schools] = await db.execute(
            `SELECT s.*, 
             a.email, a.phone, a.first_name, a.last_name, a.position,
             (SELECT COUNT(*) FROM reports WHERE school_id = s.id) as reports_count
             FROM schools s 
             LEFT JOIN admins a ON a.school_id = s.id
             WHERE s.status = 'pending' 
             ORDER BY s.created_at DESC`
        );
        
        res.json({ schools });
        
    } catch (error) {
        console.error('Erreur schools pending:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/schools/active
router.get('/schools/active', async (req, res) => {
    const db = req.db;
    
    try {
        const [schools] = await db.execute(
            `SELECT s.*, 
             a.email, a.phone, a.first_name, a.last_name, a.position,
             (SELECT COUNT(*) FROM reports WHERE school_id = s.id) as report_count,
             (SELECT COUNT(*) FROM admins WHERE school_id = s.id) as admin_count
             FROM schools s 
             LEFT JOIN admins a ON a.school_id = s.id
             WHERE s.status = 'active' 
             ORDER BY s.created_at DESC`
        );
        
        res.json({ schools });
        
    } catch (error) {
        console.error('Erreur schools active:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/schools/inactive
router.get('/schools/inactive', async (req, res) => {
    const db = req.db;
    
    try {
        const [schools] = await db.execute(
            `SELECT s.*, 
             a.email, a.phone, a.first_name, a.last_name, a.position,
             (SELECT COUNT(*) FROM reports WHERE school_id = s.id) as report_count,
             (SELECT COUNT(*) FROM admins WHERE school_id = s.id) as admin_count
             FROM schools s 
             LEFT JOIN admins a ON a.school_id = s.id
             WHERE s.status = 'inactive' 
             ORDER BY s.created_at DESC`
        );
        
        res.json({ schools });
        
    } catch (error) {
        console.error('Erreur schools inactive:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/super-admin/schools/:schoolId/approve
router.post('/schools/:schoolId/approve', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    const { defaultPassword } = req.body;
    
    try {
        // Récupérer l'école et l'admin
        const [schools] = await db.execute(
            `SELECT s.*, a.email, a.first_name, a.last_name, a.phone
             FROM schools s
             LEFT JOIN admins a ON a.school_id = s.id
             WHERE s.id = ?`,
            [schoolId]
        );
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        const school = schools[0];
        
        // Mettre à jour le statut de l'école
        await db.execute(
            'UPDATE schools SET status = "active" WHERE id = ?',
            [schoolId]
        );
        
        // Si un mot de passe est fourni, mettre à jour l'admin
        if (defaultPassword && school.email) {
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);
            await db.execute(
                'UPDATE admins SET password_hash = ? WHERE school_id = ?',
                [hashedPassword, schoolId]
            );
            
            // Créer aussi un utilisateur dans la table users pour la connexion
            const [existingUser] = await db.execute('SELECT id FROM users WHERE email = ?', [school.email]);
            if (existingUser.length === 0) {
                await db.execute(
                    `INSERT INTO users (username, email, password, role, school_id, is_super_admin)
                     VALUES (?, ?, ?, 'admin', ?, 0)`,
                    [school.first_name + ' ' + school.last_name, school.email, hashedPassword, schoolId]
                );
            }
        }
        
        res.json({ 
            message: 'École approuvée avec succès',
            schoolCode: school.school_code,
            schoolName: school.name
        });
        
    } catch (error) {
        console.error('Erreur approve school:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/super-admin/schools/:schoolId/reject
router.post('/schools/:schoolId/reject', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    
    try {
        const [result] = await db.execute(
            'UPDATE schools SET status = "rejected" WHERE id = ?',
            [schoolId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        res.json({ message: 'École rejetée' });
        
    } catch (error) {
        console.error('Erreur reject school:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/super-admin/schools/:schoolId/activate - Activer une école
router.post('/schools/:schoolId/activate', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    const { code } = req.body;
    
    // Vérifier le code super admin
    if (code !== SUPER_ADMIN_CODE) {
        return res.status(403).json({ error: 'Code super admin invalide' });
    }
    
    try {
        const [schools] = await db.execute('SELECT name, status FROM schools WHERE id = ?', [schoolId]);
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        const school = schools[0];
        
        await db.execute(
            'UPDATE schools SET status = "active" WHERE id = ?',
            [schoolId]
        );
        
        res.json({ 
            message: `École "${school.name}" activée avec succès`,
            previousStatus: school.status,
            newStatus: 'active'
        });
        
    } catch (error) {
        console.error('Erreur activate school:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/super-admin/schools/:schoolId/deactivate - Désactiver une école
router.post('/schools/:schoolId/deactivate', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    const { code } = req.body;
    
    // Vérifier le code super admin
    if (code !== SUPER_ADMIN_CODE) {
        return res.status(403).json({ error: 'Code super admin invalide' });
    }
    
    try {
        const [schools] = await db.execute('SELECT name, status FROM schools WHERE id = ?', [schoolId]);
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        const school = schools[0];
        
        await db.execute(
            'UPDATE schools SET status = "inactive" WHERE id = ?',
            [schoolId]
        );
        
        res.json({ 
            message: `École "${school.name}" désactivée`,
            previousStatus: school.status,
            newStatus: 'inactive'
        });
        
    } catch (error) {
        console.error('Erreur deactivate school:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/dashboard
router.get('/dashboard', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    
    try {
        const [[{ totalSchools }]] = await db.execute('SELECT COUNT(*) as totalSchools FROM schools');
        const [[{ activeSchools }]] = await db.execute('SELECT COUNT(*) as activeSchools FROM schools WHERE status = "active"');
        const [[{ totalReports }]] = await db.execute('SELECT COUNT(*) as totalReports FROM reports');
        const [[{ totalUsers }]] = await db.execute('SELECT COUNT(*) as totalUsers FROM users WHERE is_super_admin = 0');
        const [[{ pendingReports }]] = await db.execute('SELECT COUNT(*) as pendingReports FROM reports WHERE status = "pending"');
        
        const [recentSchools] = await db.execute(
            `SELECT id, name, school_code, city, status, created_at
             FROM schools ORDER BY created_at DESC LIMIT 5`
        );
        
        const [recentReports] = await db.execute(
            `SELECT r.id, r.tracking_code, r.incident_type, r.status, r.created_at, s.name as school_name
             FROM reports r
             JOIN schools s ON r.school_id = s.id
             ORDER BY r.created_at DESC LIMIT 10`
        );
        
        res.json({
            stats: {
                totalSchools,
                activeSchools,
                totalReports,
                totalUsers,
                pendingReports
            },
            recentSchools,
            recentReports
        });
        
    } catch (error) {
        console.error('Erreur super admin dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/schools
router.get('/schools', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        let query = `SELECT s.*, 
                     (SELECT COUNT(*) FROM reports WHERE school_id = s.id) as reports_count,
                     (SELECT COUNT(*) FROM users WHERE school_id = s.id) as users_count
                     FROM schools s WHERE 1=1`;
        const params = [];
        
        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }
        
        if (search) {
            query += ' AND (s.name LIKE ? OR s.school_code LIKE ? OR s.city LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        const countQuery = query.replace(/SELECT s\.\*.*FROM/, 'SELECT COUNT(*) as total FROM');
        const [[{ total }]] = await db.execute(countQuery, params);
        
        query += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [schools] = await db.execute(query, params);
        
        res.json({
            schools,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Erreur get schools:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PATCH /api/super-admin/schools/:schoolId/status
router.patch('/schools/:schoolId/status', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    try {
        const [result] = await db.execute(
            'UPDATE schools SET status = ? WHERE id = ?',
            [status, schoolId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        res.json({ message: 'Statut mis à jour', status });
        
    } catch (error) {
        console.error('Erreur update school status:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/schools/:schoolId/details - Détails d'une école
router.get('/schools/:schoolId/details', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    
    try {
        const [schools] = await db.execute(
            'SELECT * FROM schools WHERE id = ?',
            [schoolId]
        );
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        const [admins] = await db.execute(
            'SELECT id, first_name, last_name, email, phone, position FROM admins WHERE school_id = ?',
            [schoolId]
        );
        
        const [recentReports] = await db.execute(
            `SELECT id, tracking_code, incident_type, status, created_at 
             FROM reports WHERE school_id = ? ORDER BY created_at DESC LIMIT 10`,
            [schoolId]
        );
        
        // Ajouter les infos admin au school pour faciliter l'accès
        const school = schools[0];
        if (admins.length > 0) {
            school.admin_phone = admins[0].phone;
            school.admin_email = admins[0].email;
            school.admin_name = admins[0].first_name + ' ' + admins[0].last_name;
        }
        
        res.json({
            school,
            admins,
            recentReports
        });
        
    } catch (error) {
        console.error('Erreur school details:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/super-admin/schools/:schoolId - Supprimer une école (sans auth JWT, vérifie le code)
router.delete('/schools/:schoolId', async (req, res) => {
    const db = req.db;
    const { schoolId } = req.params;
    const { code } = req.body;
    
    // Vérifier le code super admin
    if (code !== SUPER_ADMIN_CODE) {
        return res.status(403).json({ error: 'Code super admin invalide' });
    }
    
    try {
        // Vérifier que l'école existe
        const [schools] = await db.execute('SELECT id, name FROM schools WHERE id = ?', [schoolId]);
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        const schoolName = schools[0].name;
        
        // Supprimer les messages de discussion
        await db.execute(
            `DELETE dm FROM discussion_messages dm 
             INNER JOIN discussions d ON dm.discussion_id = d.id 
             WHERE d.school_id = ?`,
            [schoolId]
        );
        
        // Supprimer les discussions
        await db.execute('DELETE FROM discussions WHERE school_id = ?', [schoolId]);
        
        // Supprimer les fichiers de signalement
        await db.execute(
            `DELETE rf FROM report_files rf 
             INNER JOIN reports r ON rf.report_id = r.id 
             WHERE r.school_id = ?`,
            [schoolId]
        );
        
        // Supprimer les signalements
        await db.execute('DELETE FROM reports WHERE school_id = ?', [schoolId]);
        
        // Supprimer les sessions de chat IA
        await db.execute(
            `DELETE acm FROM ai_chat_messages acm 
             INNER JOIN ai_chat_sessions acs ON acm.session_id = acs.id 
             WHERE acs.school_id = ?`,
            [schoolId]
        );
        await db.execute('DELETE FROM ai_chat_sessions WHERE school_id = ?', [schoolId]);
        
        // Supprimer les admins
        await db.execute('DELETE FROM admins WHERE school_id = ?', [schoolId]);
        
        // Supprimer les utilisateurs
        await db.execute('DELETE FROM users WHERE school_id = ?', [schoolId]);
        
        // Supprimer l'école
        await db.execute('DELETE FROM schools WHERE id = ?', [schoolId]);
        
        res.json({ message: `École "${schoolName}" supprimée avec succès` });
        
    } catch (error) {
        console.error('Erreur delete school:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// GET /api/super-admin/reports
router.get('/reports', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { status, schoolId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        let query = `SELECT r.*, s.name as school_name, s.school_code
                     FROM reports r
                     JOIN schools s ON r.school_id = s.id
                     WHERE 1=1`;
        const params = [];
        
        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }
        
        if (schoolId) {
            query += ' AND r.school_id = ?';
            params.push(schoolId);
        }
        
        const countQuery = query.replace('SELECT r.*, s.name as school_name, s.school_code', 'SELECT COUNT(*) as total');
        const [[{ total }]] = await db.execute(countQuery, params);
        
        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [reports] = await db.execute(query, params);
        
        res.json({
            reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Erreur super admin reports:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/users
router.get('/users', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { schoolId, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        let query = `SELECT u.id, u.username, u.email, u.role, u.is_super_admin, u.created_at,
                     s.name as school_name, s.school_code
                     FROM users u
                     LEFT JOIN schools s ON u.school_id = s.id
                     WHERE 1=1`;
        const params = [];
        
        if (schoolId) {
            query += ' AND u.school_id = ?';
            params.push(schoolId);
        }
        
        const countQuery = query.replace(/SELECT u\.id.*FROM/, 'SELECT COUNT(*) as total FROM');
        const [[{ total }]] = await db.execute(countQuery, params);
        
        query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);
        
        const [users] = await db.execute(query, params);
        
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Erreur super admin users:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/super-admin/create-admin
router.post('/create-admin', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { username, email, password, schoolId } = req.body;
    
    if (!username || !email || !password || !schoolId) {
        return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    
    try {
        // Vérifier que l'école existe
        const [schools] = await db.execute('SELECT id FROM schools WHERE id = ?', [schoolId]);
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        // Vérifier email unique
        const [existingUsers] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [result] = await db.execute(
            `INSERT INTO users (username, email, password, role, school_id, is_super_admin)
             VALUES (?, ?, ?, 'admin', ?, 0)`,
            [username, email, hashedPassword, schoolId]
        );
        
        res.status(201).json({
            message: 'Administrateur créé avec succès',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Erreur create admin:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/super-admin/users/:userId
router.delete('/users/:userId', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    const { userId } = req.params;
    
    try {
        // Ne pas supprimer les super admins
        const [users] = await db.execute(
            'SELECT is_super_admin FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        if (users[0].is_super_admin) {
            return res.status(403).json({ error: 'Impossible de supprimer un super administrateur' });
        }
        
        await db.execute('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ message: 'Utilisateur supprimé avec succès' });
        
    } catch (error) {
        console.error('Erreur delete user:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/super-admin/stats/global
router.get('/stats/global', verifyToken, verifySuperAdmin, async (req, res) => {
    const db = req.db;
    
    try {
        // Statistiques par mois
        const [monthlyReports] = await db.execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
             FROM reports
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
             GROUP BY DATE_FORMAT(created_at, '%Y-%m')
             ORDER BY month DESC`
        );
        
        // Statistiques par type d'incident
        const [byType] = await db.execute(
            `SELECT incident_type, COUNT(*) as count
             FROM reports
             GROUP BY incident_type
             ORDER BY count DESC`
        );
        
        // Top 10 écoles par nombre de signalements
        const [topSchools] = await db.execute(
            `SELECT s.name, s.school_code, COUNT(r.id) as reports_count
             FROM schools s
             LEFT JOIN reports r ON s.id = r.school_id
             GROUP BY s.id
             ORDER BY reports_count DESC
             LIMIT 10`
        );
        
        res.json({
            monthlyReports,
            byType,
            topSchools
        });
        
    } catch (error) {
        console.error('Erreur global stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
