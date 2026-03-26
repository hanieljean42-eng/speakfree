// routes/ai-chat.js - Chat IA Haniel - Flux SIMPLIFIÉ et AUTOMATIQUE
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration Multer pour les fichiers (photos/vidéos)
// Utiliser memoryStorage pour la production (Render)
let storage;

if (process.env.NODE_ENV === 'production') {
    // En production, stocker en mémoire temporairement
    storage = multer.memoryStorage();
} else {
    // En local, stocker sur disque
    storage = multer.diskStorage({
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
}

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb(new Error('Type de fichier non autorisé'));
    }
});

// Générer un code de session unique
function generateSessionCode() {
    return 'CHAT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Générer un code de suivi
function generateTrackingCode() {
    return 'RPT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Générer un code de discussion
function generateDiscussionCode() {
    return 'DSC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// ============================================
// MESSAGES DE HANIEL - Chaleureux et simples
// ============================================

const MESSAGES = {
    welcome: `Salut ! 👋 Je suis **Haniel**, ton assistant SpeakFree.

Je suis là pour t'aider à signaler un problème à ton école, de façon **100% anonyme et sécurisée**.

Pour commencer, **quel est le code de ton école ?**
_(Tu peux le trouver sur l'affiche SpeakFree de ton établissement ou demander à un adulte de confiance)_`,

    schoolNotFound: `😕 Je n'ai pas trouvé d'école avec ce code.

Vérifie bien le code et réessaie, ou demande à un adulte de confiance.
Le code ressemble à : **ECOLE-XXXXXX**`,

    schoolFound: (schoolName) => `✅ Parfait ! Tu es bien à **${schoolName}**.

Maintenant, **raconte-moi ce qui s'est passé**.
Prends ton temps, dis-moi tout ce que tu veux partager. Je t'écoute. 💙`,

    askProof: (analysis) => `Merci de ta confiance. 💙

**J'ai compris :**
📋 Type : ${analysis.typeLabel}
${analysis.date ? `📅 Quand : ${analysis.date}` : ''}
${analysis.location ? `📍 Où : ${analysis.location}` : ''}

**As-tu des preuves à ajouter ?** (photos, vidéos, captures d'écran)
- Réponds **"oui"** pour ajouter des fichiers
- Réponds **"non"** pour envoyer directement le signalement`,

    waitingFiles: `📎 **Envoie-moi tes fichiers** (photos, vidéos, captures d'écran).

Quand tu as fini, réponds **"terminé"** ou **"envoyer"** pour créer le signalement.`,

    fileReceived: (filename) => `✅ Fichier reçu : **${filename}**

Tu peux en ajouter d'autres, ou réponds **"terminé"** pour envoyer le signalement.`,

    confirmReport: (analysis, filesCount) => `📝 **Récapitulatif de ton signalement :**

📋 **Type :** ${analysis.typeLabel}
${analysis.date ? `📅 **Date :** ${analysis.date}` : '📅 **Date :** Non précisée'}
${analysis.location ? `📍 **Lieu :** ${analysis.location}` : '📍 **Lieu :** Non précisé'}
📎 **Fichiers joints :** ${filesCount > 0 ? filesCount + ' fichier(s)' : 'Aucun'}

**Tu confirmes l'envoi ?**
Réponds **"oui"** pour envoyer à ton école.`,

    reportCreated: (trackingCode, discussionCode, schoolName) => `🎉 **C'est fait ! Ton signalement a été envoyé à ${schoolName}.**

📋 **Code de suivi :** \`${trackingCode}\`
💬 **Code discussion :** \`${discussionCode}\`

⚠️ **IMPORTANT : Note bien ces codes !**
Tu pourras les utiliser pour :
- Suivre l'avancement de ton signalement
- Discuter anonymement avec ton école

---

**Tu as été courageux(se) d'en parler. 💪**

**Besoin d'aide urgente ?**
📞 **3020** - Numéro contre le harcèlement
📞 **119** - Enfance en danger`
};

// ============================================
// ANALYSE AUTOMATIQUE DU MESSAGE
// ============================================

function normalizeText(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function analyzeMessage(message) {
    const normalized = normalizeText(message);
    
    // Détecter le type d'incident
    let type = 'autre';
    let typeLabel = '📌 Autre situation';
    
    if (normalized.match(/harcel|moque|insulte|humili|embete|surnoms|rumeur|exclu|rejete|isole|mechant/)) {
        type = 'harcelement';
        typeLabel = '🎭 Harcèlement';
    } else if (normalized.match(/frappe|tape|coup|bagarre|pousse|bouscula|blesse|cogne|gifle|bat|battu|violence|fait mal/)) {
        type = 'violence';
        typeLabel = '⚡ Violence physique';
    } else if (normalized.match(/cyber|internet|reseaux|instagram|snap|tiktok|facebook|whatsapp|message|sms|en ligne/)) {
        type = 'cyberharcelement';
        typeLabel = '💻 Cyberharcèlement';
    } else if (normalized.match(/racis|discrimin|origine|religion|couleur|peau|handicap|homo|gay/)) {
        type = 'discrimination';
        typeLabel = '🚫 Discrimination';
    } else if (normalized.match(/vol|vole|pris|argent|affaires|racket|force/)) {
        type = 'vol';
        typeLabel = '💰 Vol / Racket';
    } else if (normalized.match(/drogue|alcool|fumer|cigarette|cannabis|joint|boire/)) {
        type = 'drogue';
        typeLabel = '💊 Drogue / Alcool';
    } else if (normalized.match(/menace|peur|intimid|terreur/)) {
        type = 'menaces';
        typeLabel = '😰 Menaces / Intimidation';
    }
    
    // Détecter la date
    let date = null;
    const today = new Date();
    
    if (normalized.includes('aujourd')) {
        date = "Aujourd'hui";
    } else if (normalized.includes('hier')) {
        date = "Hier";
    } else if (normalized.match(/semaine derniere|la semaine passee/)) {
        date = "La semaine dernière";
    } else if (normalized.match(/ce matin/)) {
        date = "Ce matin";
    } else if (normalized.match(/cet apres/)) {
        date = "Cet après-midi";
    }
    
    // Détecter le lieu
    let location = null;
    
    if (normalized.match(/cour|recre/)) {
        location = "Cour de récréation";
    } else if (normalized.match(/classe|salle/)) {
        location = "Salle de classe";
    } else if (normalized.match(/couloir/)) {
        location = "Couloir";
    } else if (normalized.match(/toilette|wc/)) {
        location = "Toilettes";
    } else if (normalized.match(/cantine|self/)) {
        location = "Cantine";
    } else if (normalized.match(/gymnase|sport|eps/)) {
        location = "Gymnase";
    } else if (normalized.match(/sortie|portail|bus/)) {
        location = "Sortie / Bus";
    } else if (normalized.match(/internet|ligne|reseaux/)) {
        location = "En ligne";
    }
    
    return { type, typeLabel, date, location };
}

// ============================================
// STOCKAGE DES SESSIONS EN COURS
// ============================================

const activeSessions = new Map();

function getSession(sessionCode) {
    if (!activeSessions.has(sessionCode)) {
        activeSessions.set(sessionCode, {
            step: 0,           // 0=code école, 1=raconter, 2=preuves?, 3=upload, 4=confirmer
            schoolId: null,
            schoolName: null,
            schoolCode: null,
            description: '',
            analysis: null,
            files: [],
            reportId: null
        });
    }
    return activeSessions.get(sessionCode);
}

// ============================================
// ROUTES API
// ============================================

// POST /api/ai-chat/create-session - Créer une nouvelle session
router.post('/create-session', async (req, res) => {
    console.log('[AI-CHAT] Création de session demandée');
    
    const db = req.db;
    const { schoolCode, incidentType } = req.body;
    
    // Vérifier que la base est disponible
    if (!db) {
        console.error('[AI-CHAT] ❌ Base de données non disponible');
        return res.status(503).json({ 
            error: 'Service temporairement indisponible',
            message: 'La base de données n\'est pas encore prête. Réessayez dans quelques secondes.'
        });
    }
    
    try {
        const sessionCode = generateSessionCode();
        console.log('[AI-CHAT] Code session généré:', sessionCode, 'Type incident:', incidentType);
        
        // Chercher l'école si un code est fourni
        let schoolId = null;
        let schoolName = null;
        if (schoolCode) {
            const [schools] = await db.execute(
                'SELECT id, name FROM schools WHERE school_code = ? AND status = "active"',
                [schoolCode.toUpperCase()]
            );
            if (schools.length > 0) {
                schoolId = schools[0].id;
                schoolName = schools[0].name;
                console.log('[AI-CHAT] École trouvée:', schoolName);
            }
        }
        
        const [result] = await db.execute(
            `INSERT INTO ai_chat_sessions (session_id, status, school_id, incident_type) VALUES (?, 'active', ?, ?)`,
            [sessionCode, schoolId, incidentType || null]
        );
        console.log('[AI-CHAT] Session insérée, ID:', result.insertId);
        
        // Initialiser la session en mémoire
        const session = getSession(sessionCode);
        session.schoolId = schoolId;
        session.schoolName = schoolName;
        session.incidentType = incidentType;
        
        // Si l'école est déjà connue, passer directement à l'étape 1
        if (schoolId) {
            session.step = 1;
        }
        
        // Sauvegarder le message de bienvenue adapté
        let welcomeMessage;
        if (schoolId && incidentType) {
            welcomeMessage = `Salut ! 👋 Je suis **Haniel**, ton assistant SpeakFree.

Tu signales un incident de type **${incidentType}** à **${schoolName}**.

**Raconte-moi ce qui s'est passé.** Prends ton temps, dis-moi tout ce que tu veux partager. Je t'écoute. 💙`;
        } else {
            welcomeMessage = MESSAGES.welcome;
        }
        
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
            [result.insertId, welcomeMessage]
        );
        console.log('[AI-CHAT] ✅ Session créée avec succès');
        
        res.status(201).json({
            success: true,
            sessionCode,
            sessionId: result.insertId,
            message: welcomeMessage,
            schoolName: schoolName,
            incidentType: incidentType
        });
        
    } catch (error) {
        console.error('[AI-CHAT] ❌ Erreur create session:', error.message);
        console.error('[AI-CHAT] Stack:', error.stack);
        res.status(500).json({ 
            error: 'Erreur serveur',
            message: error.message
        });
    }
});

// POST /api/ai-chat/start - Alias pour create-session
router.post('/start', async (req, res) => {
    const db = req.db;
    
    try {
        const sessionCode = generateSessionCode();
        
        const [result] = await db.execute(
            `INSERT INTO ai_chat_sessions (session_id, status) VALUES (?, 'active')`,
            [sessionCode]
        );
        
        getSession(sessionCode);
        
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
            [result.insertId, MESSAGES.welcome]
        );
        
        res.status(201).json({
            success: true,
            sessionCode,
            sessionId: result.insertId,
            message: MESSAGES.welcome
        });
        
    } catch (error) {
        console.error('Erreur start:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/ai-chat/message - Envoyer un message
router.post('/message', async (req, res) => {
    const db = req.db;
    const { sessionCode, message } = req.body;
    
    if (!sessionCode || !message) {
        return res.status(400).json({ error: 'sessionCode et message requis' });
    }
    
    try {
        // Récupérer la session DB
        const [sessions] = await db.execute(
            'SELECT * FROM ai_chat_sessions WHERE session_id = ?',
            [sessionCode]
        );
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        const dbSession = sessions[0];
        const session = getSession(sessionCode);
        const normalized = normalizeText(message);
        
        // Sauvegarder le message utilisateur
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'user', ?)`,
            [dbSession.id, message]
        );
        
        let response = '';
        
        // ========== ÉTAPE 0: Demander le code de l'école ==========
        if (session.step === 0) {
            // Chercher l'école avec le code fourni
            const schoolCodeInput = message.trim().toUpperCase();
            
            const [schools] = await db.execute(
                'SELECT id, school_code, name FROM schools WHERE (school_code = ? OR school_code = ?) AND status = "active"',
                [schoolCodeInput, message.trim()]
            );
            
            if (schools.length === 0) {
                response = MESSAGES.schoolNotFound;
                // Reste à l'étape 0
            } else {
                const school = schools[0];
                session.schoolId = school.id;
                session.schoolName = school.name;
                session.schoolCode = school.school_code;
                session.step = 1;
                
                // Mettre à jour la session DB avec l'école
                await db.execute(
                    'UPDATE ai_chat_sessions SET school_id = ? WHERE id = ?',
                    [school.id, dbSession.id]
                );
                
                response = MESSAGES.schoolFound(school.name);
            }
        }
        
        // ========== ÉTAPE 1: L'élève raconte ce qui s'est passé ==========
        else if (session.step === 1) {
            session.description = message;
            session.analysis = analyzeMessage(message);
            session.step = 2;
            
            response = MESSAGES.askProof(session.analysis);
        }
        
        // ========== ÉTAPE 2: Demande de preuves (optionnel) ==========
        else if (session.step === 2) {
            if (normalized.match(/^(oui|o|yes|ok|ouais|photo|video|preuve|fichier)$/)) {
                session.step = 3;
                response = MESSAGES.waitingFiles;
            } else if (normalized.match(/^(non|n|no|pas|aucun|envoyer|envoi|terminer|termine|signaler)$/)) {
                // Pas de preuves, passer à la confirmation
                session.step = 4;
                response = MESSAGES.confirmReport(session.analysis, session.files.length);
            } else {
                // Message ambigu, considérer comme des infos supplémentaires
                session.description += '\n\n' + message;
                session.analysis = analyzeMessage(session.description);
                session.step = 4;
                response = MESSAGES.confirmReport(session.analysis, session.files.length);
            }
        }
        
        // ========== ÉTAPE 3: Upload de fichiers ==========
        else if (session.step === 3) {
            if (normalized.match(/^(termine|terminer|fini|ok|envoyer|envoi|c'est bon|cest bon|valider)$/)) {
                session.step = 4;
                response = MESSAGES.confirmReport(session.analysis, session.files.length);
            } else {
                // Attendre les fichiers via /upload
                response = MESSAGES.waitingFiles;
            }
        }
        
        // ========== ÉTAPE 4: Confirmation finale ==========
        else if (session.step === 4) {
            if (normalized.match(/^(oui|o|yes|ok|confirme|confirmer|valide|valider|envoie|envoyer|d'accord|daccord)$/)) {
                // CRÉER LE SIGNALEMENT !
                const trackingCode = generateTrackingCode();
                const discussionCode = generateDiscussionCode();
                
                const [reportResult] = await db.execute(
                    `INSERT INTO reports (school_id, tracking_code, discussion_code, incident_type, description, location, status, from_chat_session)
                     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
                    [
                        session.schoolId,
                        trackingCode,
                        discussionCode,
                        session.analysis.type,
                        session.description,
                        session.analysis.location,
                        sessionCode
                    ]
                );
                
                session.reportId = reportResult.insertId;
                
                // Associer les fichiers au signalement (avec données binaires)
                if (session.files.length > 0) {
                    for (const file of session.files) {
                        await db.execute(
                            `INSERT INTO report_files (report_id, filename, original_name, file_type, file_size, file_path, file_data)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [reportResult.insertId, file.filename, file.originalName, file.type, file.size, file.path || null, file.data || null]
                        );
                    }
                }
                
                // Créer la discussion
                await db.execute(
                    `INSERT INTO discussions (report_id, discussion_code, school_id, status)
                     VALUES (?, ?, ?, 'open')`,
                    [reportResult.insertId, discussionCode, session.schoolId]
                );
                
                // Marquer la session comme terminée
                await db.execute(
                    'UPDATE ai_chat_sessions SET status = "completed" WHERE id = ?',
                    [dbSession.id]
                );
                
                // Invalider le cache pour que les stats se mettent à jour immédiatement
                if (req.cache) {
                    req.cache.invalidate('admin:dashboard:' + session.schoolId);
                    req.cache.invalidate('stats:');
                }
                
                session.step = 5;
                response = MESSAGES.reportCreated(trackingCode, discussionCode, session.schoolName);
                
                // Nettoyer la session mémoire après un délai
                setTimeout(() => activeSessions.delete(sessionCode), 60000);
                
                // Sauvegarder la réponse et retourner avec infos du signalement
                await db.execute(
                    `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
                    [dbSession.id, response]
                );
                
                return res.json({
                    success: true,
                    message: response,
                    reportCreated: true,
                    reportId: reportResult.insertId,
                    trackingCode,
                    discussionCode
                });
                
            } else if (normalized.match(/^(non|n|no|annule|annuler|modifier|changer)$/)) {
                session.step = 1;
                response = `D'accord, recommençons. **Raconte-moi ce qui s'est passé.**`;
            } else {
                response = `Réponds **"oui"** pour envoyer le signalement, ou **"non"** pour modifier.`;
            }
        }
        
        // ========== ÉTAPE 5: Signalement déjà créé ==========
        else if (session.step === 5) {
            response = `Ton signalement a déjà été envoyé ! 🎉

Si tu veux faire un nouveau signalement, commence une nouvelle conversation.`;
        }
        
        // Sauvegarder la réponse
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
            [dbSession.id, response]
        );
        
        res.json({
            success: true,
            message: response,
            step: session.step,
            schoolFound: session.schoolId !== null
        });
        
    } catch (error) {
        console.error('Erreur message:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/ai-chat/upload - Upload de fichiers (photos/vidéos)
router.post('/upload', upload.single('file'), async (req, res) => {
    const db = req.db;
    const { sessionCode } = req.body;
    
    if (!sessionCode) {
        return res.status(400).json({ error: 'sessionCode requis' });
    }
    
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    try {
        const [sessions] = await db.execute(
            'SELECT id FROM ai_chat_sessions WHERE session_id = ?',
            [sessionCode]
        );
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        const session = getSession(sessionCode);
        
        // Générer un nom de fichier unique
        const uniqueFilename = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(req.file.originalname);
        
        // Récupérer les données binaires du fichier
        const fileData = req.file.buffer || (req.file.path ? fs.readFileSync(req.file.path) : null);
        
        // Ajouter le fichier à la session (avec les données binaires)
        session.files.push({
            filename: uniqueFilename,
            originalName: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size,
            path: req.file.path || null,
            data: fileData
        });
        
        const response = MESSAGES.fileReceived(req.file.originalname);
        
        // Sauvegarder dans les messages
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message, file_path) VALUES (?, 'user', ?, ?)`,
            [sessions[0].id, `📎 ${req.file.originalname}`, uniqueFilename]
        );
        
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
            [sessions[0].id, response]
        );
        
        res.json({
            success: true,
            message: response,
            filename: req.file.originalname,
            filesCount: session.files.length
        });
        
    } catch (error) {
        console.error('Erreur upload:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/ai-chat/upload-files - Upload multiple
router.post('/upload-files', upload.array('files', 10), async (req, res) => {
    const db = req.db;
    const { sessionCode } = req.body;
    
    if (!sessionCode) {
        return res.status(400).json({ error: 'sessionCode requis' });
    }
    
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }
    
    try {
        const [sessions] = await db.execute(
            'SELECT id FROM ai_chat_sessions WHERE session_id = ?',
            [sessionCode]
        );
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        const session = getSession(sessionCode);
        
        for (const file of req.files) {
            session.files.push({
                filename: file.filename,
                originalName: file.originalname,
                type: file.mimetype,
                size: file.size,
                path: file.path
            });
        }
        
        const response = `✅ **${req.files.length} fichier(s) reçu(s) !**

Réponds **"terminé"** quand tu as fini, ou ajoute d'autres fichiers.`;
        
        await db.execute(
            `INSERT INTO ai_chat_messages (session_id, sender, message) VALUES (?, 'assistant', ?)`,
            [sessions[0].id, response]
        );
        
        res.json({
            success: true,
            message: response,
            filesCount: session.files.length
        });
        
    } catch (error) {
        console.error('Erreur upload-files:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/ai-chat/session/:sessionCode - Récupérer une session
router.get('/session/:sessionCode', async (req, res) => {
    const db = req.db;
    const { sessionCode } = req.params;
    
    try {
        const [sessions] = await db.execute(
            `SELECT s.*, sc.name as school_name 
             FROM ai_chat_sessions s 
             LEFT JOIN schools sc ON s.school_id = sc.id 
             WHERE s.session_id = ?`,
            [sessionCode]
        );
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        const dbSession = sessions[0];
        
        const [messages] = await db.execute(
            `SELECT sender as role, message as content, file_path, created_at
             FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
            [dbSession.id]
        );
        
        res.json({
            success: true,
            sessionCode: dbSession.session_id,
            status: dbSession.status,
            schoolName: dbSession.school_name,
            messages
        });
        
    } catch (error) {
        console.error('Erreur get session:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/ai-chat/history/:sessionCode - Historique des messages
router.get('/history/:sessionCode', async (req, res) => {
    const db = req.db;
    const { sessionCode } = req.params;
    
    try {
        const [sessions] = await db.execute(
            'SELECT id FROM ai_chat_sessions WHERE session_id = ?',
            [sessionCode]
        );
        
        if (sessions.length === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        const [messages] = await db.execute(
            `SELECT sender as role, message as content, file_path, created_at
             FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC`,
            [sessions[0].id]
        );
        
        res.json({ success: true, messages });
        
    } catch (error) {
        console.error('Erreur history:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/ai-chat/end - Terminer une session
router.post('/end', async (req, res) => {
    const db = req.db;
    const { sessionCode } = req.body;
    
    if (!sessionCode) {
        return res.status(400).json({ error: 'sessionCode requis' });
    }
    
    try {
        const [result] = await db.execute(
            'UPDATE ai_chat_sessions SET status = "ended", ended_at = NOW() WHERE session_id = ?',
            [sessionCode]
        );
        
        activeSessions.delete(sessionCode);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Session non trouvée' });
        }
        
        res.json({ success: true, message: 'Session terminée' });
        
    } catch (error) {
        console.error('Erreur end:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
