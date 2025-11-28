// routes/ai-chat.js - Chat IA Haniel - Signalement automatique
const express = require('express');
const router = express.Router();

// Étapes du signalement
const STEPS = {
    WELCOME: 0,
    SCHOOL: 1,
    TYPE: 2,
    DATE: 3,
    LOCATION: 4,
    DESCRIPTION: 5,
    WITNESSES: 6,
    CONFIRM: 7,
    COMPLETED: 8
};

// Fonction pour générer un code de session
function generateSessionCode() {
    return 'CHAT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Fonction pour générer un code de suivi
function generateTrackingCode() {
    return 'RPT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Fonction pour générer un code de discussion
function generateDiscussionCode() {
    return 'DSC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// POST /api/ai-chat/create-session - Créer une nouvelle session de chat
router.post('/create-session', (req, res) => {
    const db = req.app.locals.db;
    const { schoolCode } = req.body;
    
    const sessionCode = generateSessionCode();
    
    // Créer la session avec les données du signalement
    const reportData = JSON.stringify({
        step: STEPS.WELCOME,
        schoolCode: schoolCode || null,
        schoolId: null,
        incidentType: '',
        incidentDate: '',
        location: '',
        description: '',
        witnesses: ''
    });
    
    db.run(
        'INSERT INTO ai_chat_sessions (session_code, school_id, status, report_data) VALUES (?, NULL, "active", ?)',
        [sessionCode, reportData],
        function(err) {
            if (err) {
                console.error('Erreur création session:', err);
                return res.status(500).json({ error: 'Erreur création session' });
            }
            
            const sessionId = this.lastID;
            
            // Message de bienvenue
            let welcomeMessage = `👋 **Bonjour ! Je suis Haniel**, ton assistant SpeakFree.

Je vais t'aider à créer ton signalement de manière **100% anonyme** et sécurisée.

Je vais te poser quelques questions simples. Réponds naturellement, je m'occupe du reste ! 🛡️`;
            
            // Si pas de code école, demander d'abord l'école
            if (!schoolCode) {
                welcomeMessage += `

📌 **Première question :** Quel est le **code de ton école** ?
_(Le code ressemble à : ECOLE-XXXXX)_`;
            }
            
            db.run(
                'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "assistant", ?)',
                [sessionId, welcomeMessage],
                (err) => {
                    if (err) console.error('Erreur ajout message:', err);
                    
                    // Si code école fourni, passer à l'étape suivante
                    if (schoolCode) {
                        // Vérifier l'école et mettre à jour
                        db.get('SELECT id, name FROM schools WHERE school_code = ? AND status = "active"', [schoolCode], (err, school) => {
                            if (school) {
                                const newData = JSON.parse(reportData);
                                newData.step = STEPS.TYPE;
                                newData.schoolId = school.id;
                                newData.schoolCode = schoolCode;
                                newData.schoolName = school.name;
                                
                                db.run('UPDATE ai_chat_sessions SET school_id = ?, report_data = ? WHERE id = ?',
                                    [school.id, JSON.stringify(newData), sessionId]);
                                
                                // Ajouter la question sur le type
                                const typeQuestion = `✅ École **${school.name}** sélectionnée.

📌 **Quel type d'incident veux-tu signaler ?**

1️⃣ Harcèlement
2️⃣ Violence physique
3️⃣ Violence verbale / Insultes
4️⃣ Cyberharcèlement
5️⃣ Vol
6️⃣ Discrimination
7️⃣ Drogue / Alcool
8️⃣ Autre

_(Tape le numéro ou décris la situation)_`;
                                
                                db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "assistant", ?)',
                                    [sessionId, typeQuestion]);
                            }
                        });
                    }
                    
                    res.status(201).json({
                        sessionCode,
                        sessionId,
                        message: 'Session créée'
                    });
                }
            );
        }
    );
});

// GET /api/ai-chat/session/:sessionCode - Récupérer une session
router.get('/session/:sessionCode', (req, res) => {
    const db = req.app.locals.db;
    const { sessionCode } = req.params;
    
    db.get('SELECT * FROM ai_chat_sessions WHERE session_code = ?', [sessionCode], (err, session) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        if (!session) return res.status(404).json({ error: 'Session non trouvée' });
        
        db.all(
            'SELECT role, content, created_at FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC',
            [session.id],
            (err, messages) => {
                if (err) return res.status(500).json({ error: 'Erreur serveur' });
                res.json({ session, messages: messages || [] });
            }
        );
    });
});

// POST /api/ai-chat/message - Envoyer un message
router.post('/message', (req, res) => {
    const db = req.app.locals.db;
    const { sessionCode, message } = req.body;
    
    if (!message || !sessionCode) {
        return res.status(400).json({ error: 'Message et sessionCode requis' });
    }
    
    db.get('SELECT * FROM ai_chat_sessions WHERE session_code = ?', [sessionCode], (err, session) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        if (!session) return res.status(404).json({ error: 'Session non trouvée' });
        
        // Récupérer les données du signalement
        let reportData;
        try {
            reportData = JSON.parse(session.report_data || '{}');
        } catch(e) {
            reportData = { step: STEPS.WELCOME };
        }
        
        // Enregistrer le message utilisateur
        db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "user", ?)',
            [session.id, message], (err) => {
                if (err) return res.status(500).json({ error: 'Erreur enregistrement' });
                
                // Traiter le message selon l'étape
                processMessage(db, session, reportData, message, (response, newData, reportCreated) => {
                    // Mettre à jour les données
                    db.run('UPDATE ai_chat_sessions SET report_data = ? WHERE id = ?',
                        [JSON.stringify(newData), session.id]);
                    
                    // Enregistrer la réponse
                    db.run('INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "assistant", ?)',
                        [session.id, response], (err) => {
                            if (err) console.error('Erreur:', err);
                            
                            const result = { message: response, sessionCode };
                            if (reportCreated) {
                                result.reportCreated = true;
                                result.trackingCode = newData.trackingCode;
                                result.discussionCode = newData.discussionCode;
                            }
                            res.json(result);
                        });
                });
            });
    });
});

// Traiter le message selon l'étape
function processMessage(db, session, data, message, callback) {
    const msg = message.trim();
    
    switch(data.step) {
        case STEPS.WELCOME:
        case STEPS.SCHOOL:
            handleSchoolStep(db, msg, data, callback);
            break;
            
        case STEPS.TYPE:
            handleTypeStep(msg, data, callback);
            break;
            
        case STEPS.DATE:
            handleDateStep(msg, data, callback);
            break;
            
        case STEPS.LOCATION:
            handleLocationStep(msg, data, callback);
            break;
            
        case STEPS.DESCRIPTION:
            handleDescriptionStep(msg, data, callback);
            break;
            
        case STEPS.WITNESSES:
            handleWitnessesStep(msg, data, callback);
            break;
            
        case STEPS.CONFIRM:
            handleConfirmStep(db, session, msg, data, callback);
            break;
            
        case STEPS.COMPLETED:
            callback(`✅ Ton signalement a déjà été créé !

📋 **Code de suivi :** \`${data.trackingCode}\`
🔑 **Code de discussion :** \`${data.discussionCode}\`

Tu peux utiliser ces codes sur la page "Discussion" pour suivre ton dossier.`, data, false);
            break;
            
        default:
            data.step = STEPS.SCHOOL;
            callback(`Je n'ai pas compris. Quel est le **code de ton école** ? (ex: ECOLE-XXXXX)`, data, false);
    }
}

// Étape 1: Code école
function handleSchoolStep(db, msg, data, callback) {
    const codeMatch = msg.match(/ECOLE-[A-Z0-9]+/i);
    const code = codeMatch ? codeMatch[0].toUpperCase() : msg.toUpperCase();
    
    db.get('SELECT id, name FROM schools WHERE school_code = ? AND status = "active"', [code], (err, school) => {
        if (school) {
            data.schoolId = school.id;
            data.schoolCode = code;
            data.schoolName = school.name;
            data.step = STEPS.TYPE;
            
            callback(`✅ École **${school.name}** trouvée !

📌 **Quel type d'incident veux-tu signaler ?**

1️⃣ Harcèlement
2️⃣ Violence physique
3️⃣ Violence verbale / Insultes
4️⃣ Cyberharcèlement
5️⃣ Vol
6️⃣ Discrimination
7️⃣ Drogue / Alcool
8️⃣ Autre

_(Tape le numéro ou décris simplement)_`, data, false);
        } else {
            callback(`❌ Je n'ai pas trouvé d'école avec ce code.

Vérifie le code de ton école (format: **ECOLE-XXXXX**) et réessaie.

💡 _Si tu ne connais pas le code, demande à un camarade ou consulte l'affichage de ton établissement._`, data, false);
        }
    });
}

// Étape 2: Type d'incident
function handleTypeStep(msg, data, callback) {
    let incidentType = '';
    
    if (msg === '1' || /harcèl|harcel|moqu|exclu|isol/i.test(msg)) {
        incidentType = 'harcelement';
    } else if (msg === '2' || /violen|frapp|coup|battu|bagarre|physi/i.test(msg)) {
        incidentType = 'violence';
    } else if (msg === '3' || /verbal|insult|menac|humil|moqueri/i.test(msg)) {
        incidentType = 'verbal';
    } else if (msg === '4' || /cyber|internet|reseaux|insta|snap|tiktok|whatsapp|facebook|message/i.test(msg)) {
        incidentType = 'cyber';
    } else if (msg === '5' || /vol|volé|dispar|pris|argent|portable|affaire/i.test(msg)) {
        incidentType = 'vol';
    } else if (msg === '6' || /discrim|racis|sexis|religio|origin|couleur/i.test(msg)) {
        incidentType = 'discrimination';
    } else if (msg === '7' || /drogue|alcool|cigarette|cannabis|fumer|boire/i.test(msg)) {
        incidentType = 'drogue';
    } else if (msg === '8' || /autre/i.test(msg)) {
        incidentType = 'autre';
    }
    
    if (incidentType) {
        const typeLabels = {
            'harcelement': 'Harcèlement',
            'violence': 'Violence physique',
            'verbal': 'Violence verbale',
            'cyber': 'Cyberharcèlement',
            'vol': 'Vol',
            'discrimination': 'Discrimination',
            'drogue': 'Drogue/Alcool',
            'autre': 'Autre'
        };
        
        data.incidentType = incidentType;
        data.incidentTypeLabel = typeLabels[incidentType];
        data.step = STEPS.DATE;
        
        callback(`📝 Type : **${typeLabels[incidentType]}**

📅 **Quand cela s'est-il passé ?**

_(Exemple: "hier", "lundi dernier", "il y a 2 semaines", "le 25 novembre")_`, data, false);
    } else {
        callback(`Je n'ai pas bien compris. Peux-tu me dire quel type d'incident tu souhaites signaler ?

1️⃣ Harcèlement
2️⃣ Violence physique
3️⃣ Violence verbale
4️⃣ Cyberharcèlement
5️⃣ Vol
6️⃣ Discrimination
7️⃣ Drogue/Alcool
8️⃣ Autre`, data, false);
    }
}

// Étape 3: Date de l'incident
function handleDateStep(msg, data, callback) {
    if (msg.length >= 2) {
        data.incidentDate = msg;
        data.step = STEPS.LOCATION;
        
        callback(`📅 Date : **${msg}**

📍 **Où cela s'est-il passé ?**

_(Exemple: "dans la cour", "aux toilettes", "en classe de maths", "au couloir du 2ème étage", "sur les réseaux sociaux")_`, data, false);
    } else {
        callback(`Peux-tu me dire **quand** cela s'est passé ?

_(Exemple: "hier matin", "la semaine dernière", "le 20 novembre")_`, data, false);
    }
}

// Étape 4: Lieu de l'incident
function handleLocationStep(msg, data, callback) {
    if (msg.length >= 2) {
        data.location = msg;
        data.step = STEPS.DESCRIPTION;
        
        callback(`📍 Lieu : **${msg}**

📝 **Maintenant, décris ce qui s'est passé en détail.**

N'hésite pas à donner le maximum d'informations : ce qui a été dit ou fait, qui était impliqué (sans donner de vrais noms si tu préfères), comment tu t'es senti(e), etc.

_(Prends ton temps, c'est important)_`, data, false);
    } else {
        callback(`Peux-tu me dire **où** cela s'est passé ?

_(Exemple: "à la cantine", "dans le bus", "en cours d'anglais")_`, data, false);
    }
}

// Étape 5: Description détaillée
function handleDescriptionStep(msg, data, callback) {
    if (msg.length >= 10) {
        data.description = msg;
        data.step = STEPS.WITNESSES;
        
        callback(`✅ Description enregistrée.

👥 **Y avait-il des témoins ?**

_(Réponds "oui" ou "non", ou donne des détails comme "oui, des amis" ou "un professeur était là")_`, data, false);
    } else {
        callback(`Ta description est un peu courte. Peux-tu donner **plus de détails** sur ce qui s'est passé ?

Plus tu donnes d'informations, mieux l'école pourra t'aider.`, data, false);
    }
}

// Étape 6: Témoins
function handleWitnessesStep(msg, data, callback) {
    data.witnesses = msg;
    data.step = STEPS.CONFIRM;
    
    callback(`📋 **RÉCAPITULATIF DE TON SIGNALEMENT**

🏫 **École :** ${data.schoolName || data.schoolCode}
📌 **Type :** ${data.incidentTypeLabel}
📅 **Date :** ${data.incidentDate}
📍 **Lieu :** ${data.location}
👥 **Témoins :** ${data.witnesses}

📝 **Description :**
${data.description}

---

✅ **Est-ce que tout est correct ?**

Tape **OUI** pour envoyer le signalement
Tape **NON** pour recommencer`, data, false);
}

// Étape 7: Confirmation et création du signalement
function handleConfirmStep(db, session, msg, data, callback) {
    const msgLower = msg.toLowerCase();
    
    if (msgLower === 'oui' || msgLower === 'o' || msgLower === 'yes' || msgLower === 'ok' || msgLower === 'confirmer') {
        const trackingCode = generateTrackingCode();
        const discussionCode = generateDiscussionCode();
        
        const fullDescription = `[Signalement via Chat IA Haniel]

Type: ${data.incidentTypeLabel}
Date: ${data.incidentDate}
Lieu: ${data.location}
Témoins: ${data.witnesses}

Description:
${data.description}`;
        
        db.run(
            `INSERT INTO reports (
                school_id, tracking_code, discussion_code,
                incident_type, description, incident_date,
                location, witnesses, status, created_at
            ) VALUES (?, ?, ?, ?, ?, date('now'), ?, ?, 'pending', datetime('now'))`,
            [data.schoolId, trackingCode, discussionCode, data.incidentType, fullDescription, data.location, data.witnesses],
            function(err) {
                if (err) {
                    console.error('Erreur création signalement:', err);
                    callback(`❌ Une erreur s'est produite lors de la création du signalement. Réessaie plus tard.`, data, false);
                    return;
                }
                
                db.run('UPDATE ai_chat_sessions SET status = "completed" WHERE id = ?', [session.id]);
                
                data.step = STEPS.COMPLETED;
                data.trackingCode = trackingCode;
                data.discussionCode = discussionCode;
                data.reportId = this.lastID;
                
                const successMessage = `🎉 **SIGNALEMENT CRÉÉ AVEC SUCCÈS !**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 **Code de suivi :**
\`${trackingCode}\`

🔑 **Code de discussion :**
\`${discussionCode}\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ **IMPORTANT : Sauvegarde ces codes !**
Tu en auras besoin pour :
• Suivre l'état de ton signalement
• Discuter avec l'école de manière anonyme

📱 Pour suivre ton signalement, va sur la page **"Discussion"** et entre ces codes.

---

💜 Merci de ta confiance. L'école va traiter ton signalement rapidement.

_Tu n'es pas seul(e). Ensemble, on peut faire changer les choses._`;
                
                callback(successMessage, data, true);
            }
        );
    } else if (msgLower === 'non' || msgLower === 'n' || msgLower === 'no' || msgLower === 'recommencer') {
        data.step = STEPS.TYPE;
        callback(`D'accord, recommençons.

📌 **Quel type d'incident veux-tu signaler ?**

1️⃣ Harcèlement
2️⃣ Violence physique
3️⃣ Violence verbale
4️⃣ Cyberharcèlement
5️⃣ Vol
6️⃣ Discrimination
7️⃣ Drogue/Alcool
8️⃣ Autre`, data, false);
    } else {
        callback(`Tape **OUI** pour confirmer et envoyer ton signalement, ou **NON** pour recommencer.`, data, false);
    }
}

module.exports = router;
