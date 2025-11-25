// routes/reports.js - Gestion des signalements
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer pour l'upload de fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'reports');
        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB max
    },
    fileFilter: (req, file, cb) => {
        // Vérifier le type de fichier
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

// Fonction pour générer un code unique
function generateCode(prefix) {
    return prefix + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// POST /api/reports/create - Créer un signalement
router.post('/create', upload.array('files', 5), async (req, res) => {
    const db = req.app.locals.db;
    const {
        schoolCode,
        incidentType,
        description,
        incidentDate,
        incidentTime,
        location,
        witnesses,
        additionalInfo
    } = req.body;
    
    try {
        // Vérifier que l'école existe
        db.get('SELECT id FROM schools WHERE school_code = ? AND status = "active"', [schoolCode], (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée ou inactive' });
            }
            
            // Générer les codes
            const trackingCode = generateCode('RPT');
            const discussionCode = generateCode('DSC');
            
            // Insérer le signalement
            db.run(
                `INSERT INTO reports (
                    school_id, tracking_code, discussion_code, incident_type, 
                    description, incident_date, incident_time, location, 
                    witnesses, additional_info, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    school.id, trackingCode, discussionCode, incidentType,
                    description, incidentDate, incidentTime || null, location,
                    witnesses || null, additionalInfo || null
                ],
                function(err) {
                    if (err) {
                        console.error('Erreur insertion report:', err);
                        return res.status(500).json({ error: 'Erreur création signalement' });
                    }
                    
                    const reportId = this.lastID;
                    
                    // Traiter les fichiers uploadés
                    if (req.files && req.files.length > 0) {
                        const filePromises = req.files.map(file => {
                            return new Promise((resolve, reject) => {
                                db.run(
                                    `INSERT INTO report_files (
                                        report_id, filename, original_name, 
                                        file_type, file_size, file_path
                                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                                    [
                                        reportId,
                                        file.filename,
                                        file.originalname,
                                        file.mimetype,
                                        file.size,
                                        file.path
                                    ],
                                    (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            });
                        });
                        
                        Promise.all(filePromises)
                            .then(() => {
                                res.status(201).json({
                                    message: 'Signalement créé avec succès',
                                    trackingCode,
                                    discussionCode,
                                    reportId,
                                    filesCount: req.files.length
                                });
                            })
                            .catch(err => {
                                console.error('Erreur upload fichiers:', err);
                                res.status(500).json({ 
                                    error: 'Signalement créé mais erreur upload fichiers',
                                    trackingCode,
                                    discussionCode
                                });
                            });
                    } else {
                        res.status(201).json({
                            message: 'Signalement créé avec succès',
                            trackingCode,
                            discussionCode,
                            reportId
                        });
                    }
                }
            );
        });
    } catch (error) {
        console.error('Erreur create report:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/reports/track/:trackingCode - Suivre un signalement
router.get('/track/:trackingCode', (req, res) => {
    const db = req.app.locals.db;
    const { trackingCode } = req.params;
    
    db.get(
        `SELECT 
            reports.id, reports.tracking_code, reports.incident_type, 
            reports.description, reports.incident_date, reports.location, 
            reports.status, reports.created_at,
            schools.name as school_name
         FROM reports
         JOIN schools ON reports.school_id = schools.id
         WHERE reports.tracking_code = ?`,
        [trackingCode],
        (err, report) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!report) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            // Récupérer les fichiers associés
            db.all(
                'SELECT filename, original_name, file_type, file_size FROM report_files WHERE report_id = ?',
                [report.id],
                (err, files) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({
                        ...report,
                        files: files || []
                    });
                }
            );
        }
    );
});

// GET /api/reports/by-discussion/:discussionCode - Récupérer par code discussion
router.get('/by-discussion/:discussionCode', (req, res) => {
    const db = req.app.locals.db;
    const { discussionCode } = req.params;
    
    db.get(
        `SELECT 
            reports.id, reports.tracking_code, reports.discussion_code,
            reports.incident_type, reports.description, reports.incident_date, 
            reports.location, reports.status, reports.created_at,
            schools.name as school_name
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
            
            res.json(report);
        }
    );
});

// GET /api/reports/:reportId/files - Récupérer les fichiers d'un signalement
router.get('/:reportId/files', (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    
    db.all(
        'SELECT * FROM report_files WHERE report_id = ?',
        [reportId],
        (err, files) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            res.json({ files: files || [] });
        }
    );
});

// PATCH /api/reports/:reportId/status - Mettre à jour le statut (admin seulement)
router.patch('/:reportId/status', (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'in-progress', 'resolved'];
    
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Statut invalide' });
    }
    
    db.run(
        'UPDATE reports SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [status, reportId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur mise à jour' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Signalement non trouvé' });
            }
            
            res.json({ 
                message: 'Statut mis à jour',
                status 
            });
        }
    );
});

// GET /api/reports/school/:schoolId - Liste des signalements d'une école (admin)
router.get('/school/:schoolId', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    const { status, limit = 50 } = req.query;
    
    let query = `
        SELECT 
            id, tracking_code, incident_type, description, 
            incident_date, location, status, created_at
        FROM reports
        WHERE school_id = ?
    `;
    
    const params = [schoolId];
    
    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    db.all(query, params, (err, reports) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        res.json({ reports: reports || [] });
    });
});

// DELETE /api/reports/:reportId - Supprimer un signalement (admin seulement)
router.delete('/:reportId', (req, res) => {
    const db = req.app.locals.db;
    const { reportId } = req.params;
    
    // Supprimer d'abord les fichiers associés
    db.all(
        'SELECT file_path FROM report_files WHERE report_id = ?',
        [reportId],
        (err, files) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            // Supprimer les fichiers du système
            files.forEach(file => {
                try {
                    if (fs.existsSync(file.file_path)) {
                        fs.unlinkSync(file.file_path);
                    }
                } catch (error) {
                    console.error('Erreur suppression fichier:', error);
                }
            });
            
            // Supprimer les entrées de la base de données
            db.run('DELETE FROM report_files WHERE report_id = ?', [reportId], (err) => {
                if (err) console.error('Erreur suppression report_files:', err);
            });
            
            db.run('DELETE FROM discussions WHERE report_id = ?', [reportId], (err) => {
                if (err) console.error('Erreur suppression discussions:', err);
            });
            
            db.run('DELETE FROM reports WHERE id = ?', [reportId], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur suppression' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'Signalement non trouvé' });
                }
                
                res.json({ message: 'Signalement supprimé avec succès' });
            });
        }
    );
});

module.exports = router;