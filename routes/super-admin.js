// routes/super-admin.js - Routes super administrateur
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Middleware de vérification super admin
const verifySuperAdmin = (req, res, next) => {
    const { code } = req.body;
    
    if (code !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Code super admin invalide' });
    }
    
    next();
};

// GET /api/super-admin/schools/pending - Liste des écoles en attente
router.get('/schools/pending', (req, res) => {
    const db = req.app.locals.db;
    
    db.all(
        `SELECT 
            schools.*, 
            admins.first_name, admins.last_name, 
            admins.email, admins.phone, admins.position
         FROM schools
         JOIN admins ON schools.id = admins.school_id
         WHERE schools.status = 'pending'
         ORDER BY schools.created_at DESC`,
        [],
        (err, schools) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ schools: schools || [] });
        }
    );
});

// GET /api/super-admin/schools/active - Liste des écoles actives
router.get('/schools/active', (req, res) => {
    const db = req.app.locals.db;
    
    db.all(
        `SELECT 
            schools.*,
            COUNT(DISTINCT admins.id) as admin_count,
            COUNT(DISTINCT reports.id) as report_count
         FROM schools
         LEFT JOIN admins ON schools.id = admins.school_id
         LEFT JOIN reports ON schools.id = reports.school_id
         WHERE schools.status = 'active'
         GROUP BY schools.id
         ORDER BY schools.name ASC`,
        [],
        (err, schools) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ schools: schools || [] });
        }
    );
});

// POST /api/super-admin/schools/:schoolId/approve - Approuver une école
router.post('/schools/:schoolId/approve', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    const { code, defaultPassword } = req.body;
    
    // Vérifier le code super admin
    if (code !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Code super admin invalide' });
    }
    
    // Générer un mot de passe par défaut si non fourni
    const password = defaultPassword || Math.random().toString(36).slice(-8);
    
    // Hasher le mot de passe
    bcrypt.hash(password, 10, (err, passwordHash) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur hachage mot de passe' });
        }
        
        // Mettre à jour le statut de l'école
        db.run(
            'UPDATE schools SET status = "active" WHERE id = ?',
            [schoolId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur mise à jour école' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'École non trouvée' });
                }
                
                // Mettre à jour le mot de passe de l'admin
                db.run(
                    'UPDATE admins SET password_hash = ? WHERE school_id = ?',
                    [passwordHash, schoolId],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Erreur mise à jour admin' });
                        }
                        
                        // Récupérer les infos pour l'email
                        db.get(
                            `SELECT schools.school_code, schools.name, admins.email 
                             FROM schools 
                             JOIN admins ON schools.id = admins.school_id 
                             WHERE schools.id = ?`,
                            [schoolId],
                            (err, school) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Erreur serveur' });
                                }
                                
                                res.json({
                                    message: 'École approuvée avec succès',
                                    schoolCode: school.school_code,
                                    schoolName: school.name,
                                    adminEmail: school.email,
                                    defaultPassword: password
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// POST /api/super-admin/schools/:schoolId/reject - Rejeter une école
router.post('/schools/:schoolId/reject', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    const { code, reason } = req.body;
    
    // Vérifier le code super admin
    if (code !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Code super admin invalide' });
    }
    
    // Récupérer les infos avant suppression
    db.get(
        `SELECT schools.name, admins.email 
         FROM schools 
         JOIN admins ON schools.id = admins.school_id 
         WHERE schools.id = ?`,
        [schoolId],
        (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            // Supprimer l'admin
            db.run('DELETE FROM admins WHERE school_id = ?', [schoolId], (err) => {
                if (err) {
                    console.error('Erreur suppression admin:', err);
                }
            });
            
            // Supprimer l'école
            db.run('DELETE FROM schools WHERE id = ?', [schoolId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur suppression' });
                }
                
                res.json({
                    message: 'Demande rejetée',
                    schoolName: school.name,
                    adminEmail: school.email,
                    reason: reason || 'Non spécifié'
                });
            });
        }
    );
});

// DELETE /api/super-admin/schools/:schoolId - Supprimer une école active
router.delete('/schools/:schoolId', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    const { code } = req.body;
    
    // Vérifier le code super admin
    if (code !== process.env.SUPER_ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Code super admin invalide' });
    }
    
    // Supprimer tous les éléments associés
    db.serialize(() => {
        // Supprimer les messages de discussion
        db.run(`DELETE FROM discussions WHERE report_id IN 
                (SELECT id FROM reports WHERE school_id = ?)`, [schoolId]);
        
        // Supprimer les fichiers de reports
        db.run(`DELETE FROM report_files WHERE report_id IN 
                (SELECT id FROM reports WHERE school_id = ?)`, [schoolId]);
        
        // Supprimer les messages IA
        db.run(`DELETE FROM ai_chat_messages WHERE session_id IN 
                (SELECT id FROM ai_chat_sessions WHERE school_id = ?)`, [schoolId]);
        
        // Supprimer les sessions IA
        db.run('DELETE FROM ai_chat_sessions WHERE school_id = ?', [schoolId]);
        
        // Supprimer les reports
        db.run('DELETE FROM reports WHERE school_id = ?', [schoolId]);
        
        // Supprimer les admins
        db.run('DELETE FROM admins WHERE school_id = ?', [schoolId]);
        
        // Supprimer l'école
        db.run('DELETE FROM schools WHERE id = ?', [schoolId], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur suppression' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            res.json({ message: 'École supprimée avec succès' });
        });
    });
});

// GET /api/super-admin/stats - Statistiques globales
router.get('/stats', (req, res) => {
    const db = req.app.locals.db;
    
    const stats = {};
    
    // Compter les écoles
    db.get('SELECT COUNT(*) as count FROM schools WHERE status = "active"', [], (err, result) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        stats.activeSchools = result.count;
        
        db.get('SELECT COUNT(*) as count FROM schools WHERE status = "pending"', [], (err, result) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            stats.pendingSchools = result.count;
            
            // Compter les signalements
            db.get('SELECT COUNT(*) as count FROM reports', [], (err, result) => {
                if (err) return res.status(500).json({ error: 'Erreur serveur' });
                stats.totalReports = result.count;
                
                // Compter les admins
                db.get('SELECT COUNT(*) as count FROM admins', [], (err, result) => {
                    if (err) return res.status(500).json({ error: 'Erreur serveur' });
                    stats.totalAdmins = result.count;
                    
                    // Compter les sessions IA
                    db.get('SELECT COUNT(*) as count FROM ai_chat_sessions', [], (err, result) => {
                        if (err) return res.status(500).json({ error: 'Erreur serveur' });
                        stats.aiSessions = result.count;
                        
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// GET /api/super-admin/schools/:schoolId/details - Détails complets d'une école
router.get('/schools/:schoolId/details', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    
    db.get(
        `SELECT schools.*, 
                COUNT(DISTINCT admins.id) as admin_count,
                COUNT(DISTINCT reports.id) as report_count
         FROM schools
         LEFT JOIN admins ON schools.id = admins.school_id
         LEFT JOIN reports ON schools.id = reports.school_id
         WHERE schools.id = ?
         GROUP BY schools.id`,
        [schoolId],
        (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            // Récupérer les admins
            db.all(
                'SELECT id, email, first_name, last_name, position, phone, created_at FROM admins WHERE school_id = ?',
                [schoolId],
                (err, admins) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    // Récupérer les derniers signalements
                    db.all(
                        `SELECT id, tracking_code, incident_type, status, created_at 
                         FROM reports 
                         WHERE school_id = ? 
                         ORDER BY created_at DESC 
                         LIMIT 10`,
                        [schoolId],
                        (err, recentReports) => {
                            if (err) {
                                return res.status(500).json({ error: 'Erreur serveur' });
                            }
                            
                            res.json({
                                school,
                                admins: admins || [],
                                recentReports: recentReports || []
                            });
                        }
                    );
                }
            );
        }
    );
});

module.exports = router;