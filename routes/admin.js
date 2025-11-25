// routes/admin.js - Routes administrateur
const express = require('express');
const router = express.Router();
const { verifyToken } = require('./auth');

// GET /api/admin/dashboard - Statistiques du dashboard
router.get('/dashboard', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const schoolId = req.admin.schoolId;
    
    const stats = {};
    
    // Total signalements
    db.get(
        'SELECT COUNT(*) as count FROM reports WHERE school_id = ?',
        [schoolId],
        (err, result) => {
            if (err) return res.status(500).json({ error: 'Erreur serveur' });
            stats.total = result.count;
            
            // En attente
            db.get(
                'SELECT COUNT(*) as count FROM reports WHERE school_id = ? AND status = "pending"',
                [schoolId],
                (err, result) => {
                    if (err) return res.status(500).json({ error: 'Erreur serveur' });
                    stats.pending = result.count;
                    
                    // En cours
                    db.get(
                        'SELECT COUNT(*) as count FROM reports WHERE school_id = ? AND status = "in-progress"',
                        [schoolId],
                        (err, result) => {
                            if (err) return res.status(500).json({ error: 'Erreur serveur' });
                            stats.inProgress = result.count;
                            
                            // Résolus
                            db.get(
                                'SELECT COUNT(*) as count FROM reports WHERE school_id = ? AND status = "resolved"',
                                [schoolId],
                                (err, result) => {
                                    if (err) return res.status(500).json({ error: 'Erreur serveur' });
                                    stats.resolved = result.count;
                                    
                                    res.json(stats);
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// GET /api/admin/reports - Liste des signalements
router.get('/reports', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const schoolId = req.admin.schoolId;
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = `
        SELECT 
            id, tracking_code, incident_type, description,
            incident_date, incident_time, location, status,
            created_at, updated_at
        FROM reports
        WHERE school_id = ?
    `;
    
    const params = [schoolId];
    
    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    db.all(query, params, (err, reports) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Compter le total pour la pagination
        let countQuery = 'SELECT COUNT(*) as total FROM reports WHERE school_id = ?';
        const countParams = [schoolId];
        
        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }
        
        db.get(countQuery, countParams, (err, count) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({
                reports: reports || [],
                total: count.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        });
    });
});

// GET /api/admin/reports/:reportId - Détails d'un signalement
router.get('/reports/:reportId', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    const schoolId = req.admin.schoolId;
    
    db.get(
        `SELECT * FROM reports 
         WHERE id = ? AND school_id = ?`,
        [reportId, schoolId],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            // Récupérer les fichiers
            db.all(
                'SELECT * FROM report_files WHERE report_id = ?',
                [reportId],
                (err, files) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    // Récupérer les messages de discussion
                    db.all(
                        'SELECT * FROM discussions WHERE report_id = ? ORDER BY created_at ASC',
                        [reportId],
                        (err, messages) => {
                            if (err) {
                                return res.status(500).json({ error: 'Erreur serveur' });
                            }
                            
                            res.json({
                                report,
                                files: files || [],
                                messages: messages || []
                            });
                        }
                    );
                }
            );
        }
    );
});

// PATCH /api/admin/reports/:reportId/status - Changer le statut
router.patch('/reports/:reportId/status', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    const { status } = req.body;
    const schoolId = req.admin.schoolId;
    
    const validStatuses = ['pending', 'in-progress', 'resolved'];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    // Vérifier que le report appartient à l'école
    db.get(
        'SELECT id FROM reports WHERE id = ? AND school_id = ?',
        [reportId, schoolId],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            db.run(
                'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [status, reportId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur mise à jour' });
                    }
                    
                    res.json({ 
                        message: 'Statut mis à jour',
                        status 
                    });
                }
            );
        }
    );
});

// POST /api/admin/reports/:reportId/reply - Répondre à un signalement
router.post('/reports/:reportId/reply', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    const { message } = req.body;
    const schoolId = req.admin.schoolId;
    
    if (!message) {
        return res.status(400).json({ error: 'Message requis' });
    }
    
    // Vérifier que le report appartient à l'école
    db.get(
        'SELECT id FROM reports WHERE id = ? AND school_id = ?',
        [reportId, schoolId],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            // Ajouter le message
            db.run(
                'INSERT INTO discussions (report_id, sender_type, message) VALUES (?, "school", ?)',
                [reportId, message],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur envoi message' });
                    }
                    
                    // Mettre à jour le statut si nécessaire
                    db.run(
                        'UPDATE reports SET status = "in-progress", updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = "pending"',
                        [reportId]
                    );
                    
                    res.status(201).json({
                        message: 'Réponse envoyée',
                        messageId: this.lastID
                    });
                }
            );
        }
    );
});

// GET /api/admin/discussions - Liste des discussions actives
router.get('/discussions', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const schoolId = req.admin.schoolId;
    
    db.all(
        `SELECT 
            reports.id, reports.tracking_code, reports.discussion_code,
            reports.incident_type, reports.status, reports.created_at,
            COUNT(discussions.id) as message_count,
            MAX(discussions.created_at) as last_message
         FROM reports
         LEFT JOIN discussions ON reports.id = discussions.report_id
         WHERE reports.school_id = ?
         GROUP BY reports.id
         HAVING message_count > 0
         ORDER BY last_message DESC`,
        [schoolId],
        (err, discussions) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ discussions: discussions || [] });
        }
    );
});

// GET /api/admin/statistics - Statistiques avancées
router.get('/statistics', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const schoolId = req.admin.schoolId;
    const { period = '30' } = req.query; // Période en jours
    
    // Statistiques par type d'incident
    db.all(
        `SELECT incident_type, COUNT(*) as count
         FROM reports
         WHERE school_id = ? AND created_at >= date('now', '-' || ? || ' days')
         GROUP BY incident_type`,
        [schoolId, period],
        (err, byType) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            // Statistiques par statut
            db.all(
                `SELECT status, COUNT(*) as count
                 FROM reports
                 WHERE school_id = ? AND created_at >= date('now', '-' || ? || ' days')
                 GROUP BY status`,
                [schoolId, period],
                (err, byStatus) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    // Évolution dans le temps
                    db.all(
                        `SELECT date(created_at) as date, COUNT(*) as count
                         FROM reports
                         WHERE school_id = ? AND created_at >= date('now', '-' || ? || ' days')
                         GROUP BY date(created_at)
                         ORDER BY date ASC`,
                        [schoolId, period],
                        (err, timeline) => {
                            if (err) {
                                return res.status(500).json({ error: 'Erreur serveur' });
                            }
                            
                            res.json({
                                byType: byType || [],
                                byStatus: byStatus || [],
                                timeline: timeline || []
                            });
                        }
                    );
                }
            );
        }
    );
});

// GET /api/admin/team - Liste des administrateurs de l'école
router.get('/team', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const schoolId = req.admin.schoolId;
    
    db.all(
        `SELECT id, email, first_name, last_name, position, phone, created_at
         FROM admins
         WHERE school_id = ?
         ORDER BY created_at ASC`,
        [schoolId],
        (err, team) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ team: team || [] });
        }
    );
});

// DELETE /api/admin/reports/:reportId - Supprimer un signalement
router.delete('/reports/:reportId', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    const schoolId = req.admin.schoolId;
    
    // Vérifier que le report appartient à l'école
    db.get(
        'SELECT id FROM reports WHERE id = ? AND school_id = ?',
        [reportId, schoolId],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            // Supprimer en cascade
            db.serialize(() => {
                db.run('DELETE FROM discussions WHERE report_id = ?', [reportId]);
                db.run('DELETE FROM report_files WHERE report_id = ?', [reportId]);
                db.run('DELETE FROM reports WHERE id = ?', [reportId], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur suppression' });
                    }
                    
                    res.json({ message: 'Signalement supprimé' });
                });
            });
        }
    );
});

module.exports = router;