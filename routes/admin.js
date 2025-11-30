// routes/admin.js - Dashboard administrateur
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'speakfree_secret_key_2024';

// Middleware d'authentification
const authMiddleware = (req, res, next) => {
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

// GET /api/admin/dashboard - Données du dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    
    console.log('[ADMIN] Dashboard pour school_id:', schoolId);
    
    try {
        const [[{ total }]] = await db.execute(
            'SELECT COUNT(*) as total FROM reports WHERE school_id = ?',
            [schoolId]
        );
        
        const [[{ pending }]] = await db.execute(
            'SELECT COUNT(*) as pending FROM reports WHERE school_id = ? AND status = "pending"',
            [schoolId]
        );
        
        const [[{ inProgress }]] = await db.execute(
            'SELECT COUNT(*) as inProgress FROM reports WHERE school_id = ? AND status = "in-progress"',
            [schoolId]
        );
        
        const [[{ resolved }]] = await db.execute(
            'SELECT COUNT(*) as resolved FROM reports WHERE school_id = ? AND status = "resolved"',
            [schoolId]
        );
        
        const [recentReports] = await db.execute(
            `SELECT id, tracking_code, incident_type, status, created_at 
             FROM reports WHERE school_id = ? ORDER BY created_at DESC LIMIT 5`,
            [schoolId]
        );
        
        console.log('[ADMIN] Stats:', { total, pending, inProgress, resolved });
        
        res.json({
            success: true,
            total,
            pending,
            inProgress,
            resolved,
            recentReports
        });
        
    } catch (error) {
        console.error('Erreur dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/debug/all-reports - Debug: voir tous les signalements
router.get('/debug/all-reports', authMiddleware, async (req, res) => {
    const db = req.db;
    try {
        const [reports] = await db.execute(
            `SELECT r.id, r.school_id, r.tracking_code, r.incident_type, r.created_at, s.name as school_name, s.school_code
             FROM reports r 
             LEFT JOIN schools s ON r.school_id = s.id 
             ORDER BY r.created_at DESC LIMIT 20`
        );
        const [schools] = await db.execute('SELECT id, school_code, name, status FROM schools');
        res.json({ 
            success: true, 
            yourSchoolId: req.user.schoolId,
            reports, 
            schools 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/fix-reports-school - Corriger le school_id des signalements orphelins
router.post('/fix-reports-school', authMiddleware, async (req, res) => {
    const db = req.db;
    const { targetSchoolId } = req.body;
    
    try {
        // Trouver les signalements avec school_id NULL ou invalide
        const [result] = await db.execute(
            `UPDATE reports SET school_id = ? WHERE school_id IS NULL OR school_id NOT IN (SELECT id FROM schools)`,
            [targetSchoolId || req.user.schoolId]
        );
        
        res.json({ 
            success: true, 
            message: 'Signalements corrigés',
            updated: result.affectedRows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/admin/reports - Liste des signalements
router.get('/reports', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    const { status, page = 1, limit = 20 } = req.query;
    
    console.log('[ADMIN REPORTS] schoolId du token:', schoolId);
    
    try {
        // D'abord, récupérer le school_code de l'admin
        const [schoolInfo] = await db.execute('SELECT school_code FROM schools WHERE id = ?', [schoolId]);
        const schoolCode = schoolInfo.length > 0 ? schoolInfo[0].school_code : null;
        console.log('[ADMIN REPORTS] School code:', schoolCode);
        
        // Récupérer les signalements par school_id OU par school_code (pour les cas où le signalement a été créé avec le code)
        let query = `SELECT r.* FROM reports r 
                     LEFT JOIN schools s ON r.school_id = s.id 
                     WHERE r.school_id = ? OR s.school_code = ?`;
        const params = [schoolId, schoolCode];
        
        if (status) {
            query += ' AND r.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
        
        const [reports] = await db.execute(query, params);
        console.log('[ADMIN REPORTS] Signalements trouvés:', reports.length);
        
        // Si toujours aucun signalement, montrer TOUS les signalements pour debug
        if (reports.length === 0) {
            const [allReports] = await db.execute(
                'SELECT * FROM reports ORDER BY created_at DESC LIMIT ?',
                [parseInt(limit)]
            );
            console.log('[ADMIN REPORTS] Mode debug - tous signalements:', allReports.length);
            return res.json({ 
                success: true, 
                reports: allReports, 
                debug: { 
                    schoolId, 
                    schoolCode,
                    message: 'Mode debug: affichage de tous les signalements car aucun ne correspond à votre école'
                } 
            });
        }
        
        res.json({ success: true, reports });
        
    } catch (error) {
        console.error('Erreur get reports:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// GET /api/admin/reports/:id - Détails d'un signalement
router.get('/reports/:id', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    
    try {
        const [reports] = await db.execute(
            'SELECT * FROM reports WHERE id = ? AND school_id = ?',
            [id, schoolId]
        );
        
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        const [files] = await db.execute(
            'SELECT * FROM report_files WHERE report_id = ?',
            [id]
        );
        
        // Récupérer les messages de la discussion
        let messages = [];
        const [discussions] = await db.execute(
            'SELECT id FROM discussions WHERE report_id = ?',
            [id]
        );
        
        if (discussions.length > 0) {
            const [msgs] = await db.execute(
                `SELECT sender as sender_type, content as message, created_at 
                 FROM discussion_messages 
                 WHERE discussion_id = ? 
                 ORDER BY created_at ASC`,
                [discussions[0].id]
            );
            messages = msgs;
        }
        
        res.json({
            success: true,
            report: reports[0],
            files,
            messages
        });
        
    } catch (error) {
        console.error('Erreur get report:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// PATCH /api/admin/reports/:id/status - Mettre à jour le statut
router.patch('/reports/:id/status', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const { status } = req.body;
    
    try {
        const [result] = await db.execute(
            'UPDATE reports SET status = ? WHERE id = ? AND school_id = ?',
            [status, id, schoolId]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        res.json({ success: true, message: 'Statut mis à jour' });
        
    } catch (error) {
        console.error('Erreur update status:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/discussions - Liste des discussions
router.get('/discussions', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    
    try {
        const [discussions] = await db.execute(
            `SELECT d.*, r.tracking_code, r.incident_type, r.id as report_id,
                    (SELECT COUNT(*) FROM discussion_messages WHERE discussion_id = d.id) as message_count,
                    (SELECT MAX(created_at) FROM discussion_messages WHERE discussion_id = d.id) as last_message
             FROM discussions d 
             JOIN reports r ON d.report_id = r.id 
             WHERE d.school_id = ? 
             ORDER BY COALESCE((SELECT MAX(created_at) FROM discussion_messages WHERE discussion_id = d.id), d.updated_at) DESC`,
            [schoolId]
        );
        
        res.json({ success: true, discussions });
        
    } catch (error) {
        console.error('Erreur get discussions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/statistics - Statistiques détaillées
router.get('/statistics', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    
    try {
        const [byType] = await db.execute(
            `SELECT incident_type, COUNT(*) as count 
             FROM reports WHERE school_id = ? 
             GROUP BY incident_type`,
            [schoolId]
        );
        
        const [byStatus] = await db.execute(
            `SELECT status, COUNT(*) as count 
             FROM reports WHERE school_id = ? 
             GROUP BY status`,
            [schoolId]
        );
        
        const [byMonth] = await db.execute(
            `SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count 
             FROM reports WHERE school_id = ? 
             GROUP BY month ORDER BY month DESC LIMIT 12`,
            [schoolId]
        );
        
        res.json({
            success: true,
            byType,
            byStatus,
            byMonth
        });
        
    } catch (error) {
        console.error('Erreur statistics:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/admin/reports/:id/reply - Répondre à un signalement
router.post('/reports/:id/reply', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Message requis' });
    }
    
    try {
        // Vérifier que le signalement appartient à cette école
        const [reports] = await db.execute(
            'SELECT id, discussion_code FROM reports WHERE id = ? AND school_id = ?',
            [id, schoolId]
        );
        
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        // Trouver ou créer la discussion
        const [discussions] = await db.execute(
            'SELECT id FROM discussions WHERE report_id = ?',
            [id]
        );
        
        let discussionId;
        if (discussions.length === 0) {
            // Créer la discussion
            const [result] = await db.execute(
                'INSERT INTO discussions (report_id, discussion_code, school_id, status) VALUES (?, ?, ?, "open")',
                [id, reports[0].discussion_code, schoolId]
            );
            discussionId = result.insertId;
        } else {
            discussionId = discussions[0].id;
        }
        
        // Ajouter le message
        await db.execute(
            'INSERT INTO discussion_messages (discussion_id, sender, content) VALUES (?, "school", ?)',
            [discussionId, message]
        );
        
        // Mettre à jour le statut si nécessaire
        await db.execute(
            'UPDATE reports SET status = "in-progress" WHERE id = ? AND status = "pending"',
            [id]
        );
        
        res.json({ success: true, message: 'Réponse envoyée' });
        
    } catch (error) {
        console.error('Erreur reply:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// DELETE /api/admin/reports/:id - Supprimer un signalement
router.delete('/reports/:id', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    const { id } = req.params;
    
    try {
        // Vérifier que le signalement appartient à cette école
        const [reports] = await db.execute(
            'SELECT id FROM reports WHERE id = ? AND school_id = ?',
            [id, schoolId]
        );
        
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        // Supprimer les fichiers associés
        await db.execute('DELETE FROM report_files WHERE report_id = ?', [id]);
        
        // Supprimer les discussions associées
        const [discussions] = await db.execute('SELECT id FROM discussions WHERE report_id = ?', [id]);
        for (const disc of discussions) {
            await db.execute('DELETE FROM discussion_messages WHERE discussion_id = ?', [disc.id]);
        }
        await db.execute('DELETE FROM discussions WHERE report_id = ?', [id]);
        
        // Supprimer le signalement
        await db.execute('DELETE FROM reports WHERE id = ?', [id]);
        
        res.json({ success: true, message: 'Signalement supprimé' });
        
    } catch (error) {
        console.error('Erreur delete:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/admin/team - Équipe de l'école
router.get('/team', authMiddleware, async (req, res) => {
    const db = req.db;
    const schoolId = req.user.schoolId;
    
    try {
        // Chercher dans la table admins
        const [admins] = await db.execute(
            `SELECT id, first_name, last_name, email, phone, position, created_at 
             FROM admins WHERE school_id = ?`,
            [schoolId]
        );
        
        // Si pas d'admins, chercher dans users
        if (admins.length === 0) {
            const [users] = await db.execute(
                `SELECT id, username as first_name, '' as last_name, email, '' as phone, role as position, created_at 
                 FROM users WHERE school_id = ?`,
                [schoolId]
            );
            return res.json({ success: true, team: users });
        }
        
        res.json({ success: true, team: admins });
        
    } catch (error) {
        console.error('Erreur team:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
