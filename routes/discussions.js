// routes/discussions.js - Gestion des discussions sécurisées
const express = require('express');
const router = express.Router();

// GET /api/discussions/:discussionCode - Accéder à une discussion
router.get('/:discussionCode', (req, res) => {
    const db = req.app.locals.db;
    const { discussionCode } = req.params;
    
    // Récupérer le report associé
    db.get(
        `SELECT 
            reports.id, reports.tracking_code, reports.discussion_code,
            reports.incident_type, reports.incident_date, reports.status,
            reports.created_at, schools.name as school_name
         FROM reports
         JOIN schools ON reports.school_id = schools.id
         WHERE reports.discussion_code = ?`,
        [discussionCode],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Discussion non trouvée' });
            }
            
            // Récupérer les messages
            db.all(
                `SELECT 
                    id, sender_type, message, created_at
                 FROM discussions
                 WHERE report_id = ?
                 ORDER BY created_at ASC`,
                [report.id],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({
                        report: {
                            id: report.id,
                            trackingCode: report.tracking_code,
                            discussionCode: report.discussion_code,
                            incidentType: report.incident_type,
                            incidentDate: report.incident_date,
                            status: report.status,
                            schoolName: report.school_name,
                            createdAt: report.created_at
                        },
                        messages: messages || []
                    });
                }
            );
        }
    );
});

// POST /api/discussions/:discussionCode/message - Envoyer un message
router.post('/:discussionCode/message', (req, res) => {
    const db = req.app.locals.db;
    const { discussionCode } = req.params;
    const { message, senderType } = req.body; // senderType: 'student' ou 'school'
    
    if (!message || !senderType) {
        return res.status(400).json({ error: 'Message et senderType requis' });
    }
    
    if (!['student', 'school'].includes(senderType)) {
        return res.status(400).json({ error: 'senderType invalide' });
    }
    
    // Récupérer le report
    db.get(
        'SELECT id FROM reports WHERE discussion_code = ?',
        [discussionCode],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Discussion non trouvée' });
            }
            
            // Insérer le message
            db.run(
                'INSERT INTO discussions (report_id, sender_type, message) VALUES (?, ?, ?)',
                [report.id, senderType, message],
                function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur envoi message' });
                    }
                    
                    // Mettre à jour le statut du report si c'est le premier message
                    db.get(
                        'SELECT COUNT(*) as count FROM discussions WHERE report_id = ?',
                        [report.id],
                        (err, result) => {
                            if (err) {
                                console.error('Erreur comptage messages:', err);
                            } else if (result.count === 1) {
                                // Premier message, mettre en "in-progress"
                                db.run(
                                    'UPDATE reports SET status = "in-progress", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [report.id]
                                );
                            }
                        }
                    );
                    
                    res.status(201).json({
                        message: 'Message envoyé',
                        messageId: this.lastID,
                        timestamp: new Date().toISOString()
                    });
                }
            );
        }
    );
});

// GET /api/discussions/report/:reportId - Messages d'un report (pour admin)
router.get('/report/:reportId', (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    
    db.all(
        `SELECT 
            id, sender_type, message, created_at
         FROM discussions
         WHERE report_id = ?
         ORDER BY created_at ASC`,
        [reportId],
        (err, messages) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ messages: messages || [] });
        }
    );
});

// DELETE /api/discussions/:messageId - Supprimer un message (admin seulement)
router.delete('/:messageId', (req, res) => {
    const db = req.app.locals.db;
    const { messageId } = req.params;
    
    db.run(
        'DELETE FROM discussions WHERE id = ?',
        [messageId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur suppression' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Message non trouvé' });
            }
            
            res.json({ message: 'Message supprimé' });
        }
    );
});

// GET /api/discussions/stats/:reportId - Statistiques d'une discussion
router.get('/stats/:reportId', (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    
    db.get(
        `SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN sender_type = 'student' THEN 1 ELSE 0 END) as student_messages,
            SUM(CASE WHEN sender_type = 'school' THEN 1 ELSE 0 END) as school_messages,
            MIN(created_at) as first_message,
            MAX(created_at) as last_message
         FROM discussions
         WHERE report_id = ?`,
        [reportId],
        (err, stats) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json(stats || {
                total: 0,
                student_messages: 0,
                school_messages: 0,
                first_message: null,
                last_message: null
            });
        }
    );
});

// PATCH /api/discussions/:discussionCode/mark-read - Marquer comme lu (admin)
router.patch('/:discussionCode/mark-read', (req, res) => {
    const db = req.app.locals.db;
    const { discussionCode } = req.params;
    
    // Cette fonctionnalité pourrait être étendue avec une table de suivi de lecture
    // Pour l'instant, on retourne juste un succès
    
    db.get(
        'SELECT id FROM reports WHERE discussion_code = ?',
        [discussionCode],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Discussion non trouvée' });
            }
            
            // Mettre à jour le timestamp
            db.run(
                'UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [report.id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({ message: 'Discussion marquée comme lue' });
                }
            );
        }
    );
});

module.exports = router;