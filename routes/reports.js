// routes/reports.js - Gestion des signalements manuels
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '..', 'uploads', 'reports');
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
    limits: { fileSize: 50 * 1024 * 1024 }
});

// POST /api/reports/create - Créer un signalement manuel
router.post('/create', upload.array('files', 10), async (req, res) => {
    const db = req.db;
    const { schoolCode, incidentType, description, incidentDate, incidentTime, location, witnesses, additionalInfo } = req.body;
    
    console.log('[REPORTS] Création signalement pour schoolCode:', schoolCode);
    
    try {
        // Vérifier l'école
        const [schools] = await db.execute(
            'SELECT id, name, status FROM schools WHERE school_code = ?',
            [schoolCode]
        );
        
        console.log('[REPORTS] École trouvée:', schools.length > 0 ? JSON.stringify(schools[0]) : 'AUCUNE');
        
        if (schools.length === 0) {
            const [allSchools] = await db.execute('SELECT school_code, name FROM schools LIMIT 10');
            return res.status(404).json({ 
                error: 'École non trouvée avec le code: ' + schoolCode,
                hint: 'Codes disponibles: ' + allSchools.map(s => s.school_code).join(', ')
            });
        }
        
        const school = schools[0];
        
        if (school.status !== 'active') {
            return res.status(400).json({ error: 'École non active. Statut actuel: ' + school.status });
        }
        
        // Générer les codes
        const trackingCode = 'RPT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const discussionCode = 'DSC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        console.log('[REPORTS] Création - school_id:', school.id, 'tracking:', trackingCode);
        
        // Créer le signalement
        const [result] = await db.execute(
            `INSERT INTO reports (school_id, tracking_code, discussion_code, incident_type, description, incident_date, incident_time, location, witnesses, additional_info, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [school.id, trackingCode, discussionCode, incidentType, description, incidentDate || null, incidentTime || null, location || null, witnesses || null, additionalInfo || null]
        );
        
        console.log('[REPORTS] Signalement créé ID:', result.insertId, 'pour school_id:', school.id);
        
        // Sauvegarder les fichiers
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await db.execute(
                    `INSERT INTO report_files (report_id, filename, original_name, file_type, file_size, file_path)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, file.filename, file.originalname, file.mimetype, file.size, file.path]
                );
            }
        }
        
        // Créer la discussion
        await db.execute(
            `INSERT INTO discussions (report_id, discussion_code, school_id, status)
             VALUES (?, ?, ?, 'open')`,
            [result.insertId, discussionCode, school.id]
        );
        
        res.status(201).json({
            success: true,
            message: 'Signalement créé avec succès',
            reportId: result.insertId,
            trackingCode,
            discussionCode
        });
        
    } catch (error) {
        console.error('Erreur create report:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/reports/track/:trackingCode - Suivre un signalement (route utilisée par index.html)
router.get('/track/:trackingCode', async (req, res) => {
    const db = req.db;
    const { trackingCode } = req.params;
    
    try {
        const [reports] = await db.execute(
            `SELECT r.*, s.name as school_name 
             FROM reports r 
             JOIN schools s ON r.school_id = s.id 
             WHERE r.tracking_code = ?`,
            [trackingCode]
        );
        
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        const report = reports[0];
        
        // Retourner au format attendu par index.html
        res.json({
            success: true,
            tracking_code: report.tracking_code,
            discussion_code: report.discussion_code,
            status: report.status,
            incident_type: report.incident_type,
            school_name: report.school_name,
            location: report.location || 'Non spécifié',
            created_at: report.created_at
        });
        
    } catch (error) {
        console.error('Erreur get report track:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/reports/:trackingCode - Suivre un signalement (route alternative)
router.get('/:trackingCode', async (req, res) => {
    const db = req.db;
    const { trackingCode } = req.params;
    
    try {
        const [reports] = await db.execute(
            `SELECT r.*, s.name as school_name 
             FROM reports r 
             JOIN schools s ON r.school_id = s.id 
             WHERE r.tracking_code = ?`,
            [trackingCode]
        );
        
        if (reports.length === 0) {
            return res.status(404).json({ error: 'Signalement non trouvé' });
        }
        
        const report = reports[0];
        
        res.json({
            success: true,
            report: {
                trackingCode: report.tracking_code,
                discussionCode: report.discussion_code,
                status: report.status,
                incidentType: report.incident_type,
                schoolName: report.school_name,
                createdAt: report.created_at
            }
        });
        
    } catch (error) {
        console.error('Erreur get report:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
