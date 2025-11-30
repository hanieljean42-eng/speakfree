// routes/discussions.js - Gestion des discussions anonymes
const express = require('express');
const router = express.Router();

// GET /api/discussions/:code - Récupérer une discussion par code
router.get('/:code', async (req, res) => {
    const db = req.db;
    const { code } = req.params;
    
    try {
        let [discussions] = await db.execute(
            `SELECT d.*, r.tracking_code, r.incident_type, r.status as report_status, r.created_at as report_created_at, s.name as school_name
             FROM discussions d 
             JOIN reports r ON d.report_id = r.id 
             JOIN schools s ON d.school_id = s.id
             WHERE d.discussion_code = ?`,
            [code]
        );
        
        // Si pas de discussion, vérifier si un report existe avec ce code et créer la discussion
        if (discussions.length === 0) {
            const [reports] = await db.execute(
                `SELECT r.*, s.name as school_name 
                 FROM reports r 
                 JOIN schools s ON r.school_id = s.id 
                 WHERE r.discussion_code = ?`,
                [code]
            );
            
            if (reports.length === 0) {
                return res.status(404).json({ error: 'Discussion non trouvée' });
            }
            
            const report = reports[0];
            
            // Créer la discussion automatiquement
            const [result] = await db.execute(
                'INSERT INTO discussions (report_id, discussion_code, school_id, status) VALUES (?, ?, ?, "open")',
                [report.id, code, report.school_id]
            );
            
            console.log('[DISCUSSIONS] Discussion créée automatiquement pour GET:', result.insertId);
            
            // Retourner les données du report comme discussion
            return res.json({
                success: true,
                report: {
                    trackingCode: report.tracking_code,
                    tracking_code: report.tracking_code,
                    discussionCode: code,
                    discussion_code: code,
                    incidentType: report.incident_type,
                    incident_type: report.incident_type,
                    reportStatus: report.status,
                    status: report.status,
                    schoolName: report.school_name,
                    createdAt: report.created_at,
                    created_at: report.created_at
                },
                discussion: {
                    code: code,
                    trackingCode: report.tracking_code,
                    incidentType: report.incident_type,
                    reportStatus: report.status,
                    schoolName: report.school_name,
                    status: 'open'
                },
                messages: []
            });
        }
        
        const discussion = discussions[0];
        
        // Récupérer les messages
        const [messages] = await db.execute(
            `SELECT sender as sender_type, content as message, created_at 
             FROM discussion_messages 
             WHERE discussion_id = ? 
             ORDER BY created_at ASC`,
            [discussion.id]
        );
        
        // Format compatible avec le frontend discussion.html
        res.json({
            success: true,
            // Pour compatibilité frontend: data.report
            report: {
                trackingCode: discussion.tracking_code,
                tracking_code: discussion.tracking_code,
                discussionCode: discussion.discussion_code,
                discussion_code: discussion.discussion_code,
                incidentType: discussion.incident_type,
                incident_type: discussion.incident_type,
                reportStatus: discussion.report_status,
                status: discussion.report_status,
                schoolName: discussion.school_name,
                createdAt: discussion.report_created_at,
                created_at: discussion.report_created_at
            },
            // Aussi retourner discussion pour compatibilité
            discussion: {
                code: discussion.discussion_code,
                trackingCode: discussion.tracking_code,
                incidentType: discussion.incident_type,
                reportStatus: discussion.report_status,
                schoolName: discussion.school_name,
                status: discussion.status
            },
            messages
        });
        
    } catch (error) {
        console.error('Erreur get discussion:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/discussions/:code/message - Envoyer un message
router.post('/:code/message', async (req, res) => {
    const db = req.db;
    const { code } = req.params;
    // Accepter les deux formats: {content, sender} OU {message, senderType}
    const content = req.body.content || req.body.message;
    const sender = req.body.sender || req.body.senderType || 'student';
    
    if (!content) {
        return res.status(400).json({ error: 'Le message est requis' });
    }
    
    try {
        // D'abord chercher la discussion par son code
        let [discussions] = await db.execute(
            'SELECT id, school_id FROM discussions WHERE discussion_code = ?',
            [code]
        );
        
        let discussionId;
        
        // Si la discussion n'existe pas, la créer à partir du report qui a ce discussion_code
        if (discussions.length === 0) {
            // Chercher le report avec ce discussion_code
            const [reports] = await db.execute(
                'SELECT id, school_id, discussion_code FROM reports WHERE discussion_code = ?',
                [code]
            );
            
            if (reports.length === 0) {
                return res.status(404).json({ error: 'Discussion non trouvée' });
            }
            
            const report = reports[0];
            
            // Créer la discussion
            const [result] = await db.execute(
                'INSERT INTO discussions (report_id, discussion_code, school_id, status) VALUES (?, ?, ?, "open")',
                [report.id, code, report.school_id]
            );
            
            discussionId = result.insertId;
            console.log('[DISCUSSIONS] Discussion créée automatiquement:', discussionId);
        } else {
            discussionId = discussions[0].id;
        }
        
        // Ajouter le message
        await db.execute(
            `INSERT INTO discussion_messages (discussion_id, sender, content) VALUES (?, ?, ?)`,
            [discussionId, sender, content]
        );
        
        // Mettre à jour la date de la discussion
        await db.execute(
            'UPDATE discussions SET updated_at = NOW() WHERE id = ?',
            [discussionId]
        );
        
        console.log('[DISCUSSIONS] Message ajouté:', { discussionId, sender, content: content.substring(0, 50) });
        
        res.status(201).json({
            success: true,
            message: 'Message envoyé'
        });
        
    } catch (error) {
        console.error('Erreur send message:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
