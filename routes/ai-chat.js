// routes/ai-chat.js - Chat IA avec API Claude
const express = require('express');
const router = express.Router();

// Fonction pour générer un code de session
function generateSessionCode() {
    return 'CHAT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// POST /api/ai-chat/create-session - Créer une nouvelle session de chat
router.post('/create-session', (req, res) => {
    const db = req.app.locals.db;
    const { schoolCode } = req.body;
    
    // Vérifier que l'école existe (optionnel)
    if (schoolCode) {
        db.get('SELECT id FROM schools WHERE school_code = ?', [schoolCode], (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            createSession(school.id);
        });
    } else {
        createSession(null);
    }
    
    function createSession(schoolId) {
        const sessionCode = generateSessionCode();
        
        db.run(
            'INSERT INTO ai_chat_sessions (session_code, school_id, status) VALUES (?, ?, "active")',
            [sessionCode, schoolId],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur création session' });
                }
                
                // Ajouter le message de bienvenue
                const welcomeMessage = "Bonjour ! Je suis Haniel, ton assistant virtuel SpeakFree. Je suis là pour t'aider à créer ton signalement de manière simple et anonyme. Pour commencer, peux-tu me dire quel type de situation tu souhaites signaler ? (harcèlement, violence, vol, discrimination, autre...)";
                
                db.run(
                    'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "assistant", ?)',
                    [this.lastID, welcomeMessage],
                    (err) => {
                        if (err) {
                            console.error('Erreur ajout message bienvenue:', err);
                        }
                        
                        res.status(201).json({
                            sessionCode,
                            sessionId: this.lastID,
                            message: 'Session créée avec succès'
                        });
                    }
                );
            }
        );
    }
});

// GET /api/ai-chat/session/:sessionCode - Récupérer une session
router.get('/session/:sessionCode', (req, res) => {
    const db = req.app.locals.db;
    const { sessionCode } = req.params;
    
    db.get(
        'SELECT * FROM ai_chat_sessions WHERE session_code = ?',
        [sessionCode],
        (err, session) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!session) {
                return res.status(404).json({ error: 'Session non trouvée' });
            }
            
            // Récupérer les messages
            db.all(
                'SELECT role, content, created_at FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC',
                [session.id],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({
                        session,
                        messages: messages || []
                    });
                }
            );
        }
    );
});

// POST /api/ai-chat/message - Envoyer un message et obtenir une réponse
router.post('/message', (req, res) => {
    const db = req.app.locals.db;
    const { sessionCode, message } = req.body;
    
    if (!message || !sessionCode) {
        return res.status(400).json({ error: 'Message et sessionCode requis' });
    }
    
    // Récupérer la session
    db.get(
        'SELECT * FROM ai_chat_sessions WHERE session_code = ?',
        [sessionCode],
        (err, session) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!session) {
                return res.status(404).json({ error: 'Session non trouvée' });
            }
            
            // Enregistrer le message de l'utilisateur
            db.run(
                'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "user", ?)',
                [session.id, message],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur enregistrement message' });
                    }
                    
                    // Récupérer l'historique de la conversation
                    db.all(
                        'SELECT content FROM ai_chat_messages WHERE session_id = ? ORDER BY created_at ASC',
                        [session.id],
                        (err, history) => {
                            if (err) {
                                return res.status(500).json({ error: 'Erreur serveur' });
                            }
                            
                            // Générer une réponse intelligente basée sur le contexte
                            const assistantMessage = generateIntelligentResponse(message, history);
                            
                            // Enregistrer la réponse de l'assistant
                            db.run(
                                'INSERT INTO ai_chat_messages (session_id, role, content) VALUES (?, "assistant", ?)',
                                [session.id, assistantMessage],
                                (err) => {
                                    if (err) {
                                        console.error('Erreur enregistrement réponse:', err);
                                    }
                                    
                                    res.json({
                                        message: assistantMessage,
                                        sessionCode
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
});

// Fonction pour générer une réponse intelligente basée sur l'historique
function generateIntelligentResponse(userMessage, history) {
    const lowerMsg = userMessage.toLowerCase();
    const historyCount = history.length;
    
    // Analyser les mots-clés du message
    const keywords = {
        harcelement: /harcèl|mobbé|mobbing|bullying|bullying|exclus|isolé/i.test(userMessage),
        violence: /violence|frappé|coup|bouffée|pou|cogn|battre|bastonné|violenté/i.test(userMessage),
        verbal: /insulte|pédé|salaud|con|débile|connard|fat|gros|moche|nul|bete|verbal|humil|menacé|cri/i.test(userMessage),
        vol: /vol|volé|pris|prendre|disparu|drogue|alcool|cigarette|argent|portable|sac|perte/i.test(userMessage),
        discrimination: /discrimin|racis|sexis|religieu|origine|couleur|handicap/i.test(userMessage),
        cyber: /cyber|internet|snapchat|instagram|facebook|whatsapp|tiktok|message|share|partag|photo/i.test(userMessage),
        date: /hier|aujourd'hui|maintenant|semaine|mois|jour|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}\/\d{1,2}/i.test(userMessage),
        lieu: /cour|couloir|classe|toilette|vestiaire|cantine|parking|bus|stade|gymnase|route|chemin/i.test(userMessage),
        temoin: /témoin|vu|present|y a|avait|monde|gens|copain|ami|prof|adulte/i.test(userMessage)
    };
    
    // Déterminer où nous en sommes dans la conversation
    const conversationStage = Math.floor(historyCount / 2); // Diviser par 2 car on compte les 2 messages (user + bot)
    
    // Réponses intelligentes basées sur la progression
    if (conversationStage === 0) {
        // Première réponse - identifier le type d'incident
        if (keywords.harcelement) {
            return "Je comprends que tu signales du harcèlement. C'est très important et courageux de ta part. Peux-tu me dire depuis combien de temps cela se produit ? Est-ce une situation récente ou cela dure depuis longtemps ?";
        }
        if (keywords.violence) {
            return "Je suis désolé que tu aies vécu cela. La violence n'est jamais acceptable. Peux-tu me dire quand cet incident s'est produit ? Était-ce aujourd'hui, hier ou plus tôt cette semaine ?";
        }
        if (keywords.cyber) {
            return "Le cyberharcèlement est un problème sérieux. Merci de le signaler. Peux-tu me dire sur quelle plateforme (Instagram, Snapchat, WhatsApp, etc.) cela se passe-t-il ?";
        }
        if (keywords.vol) {
            return "Un vol est une situation grave. Peux-tu me dire ce qui a été volé et quand cela s'est passé ?";
        }
        if (keywords.discrimination) {
            return "Malheureusement, la discrimination existe encore. Merci de le signaler. Peux-tu m'en dire un peu plus sur ce qui s'est passé ?";
        }
        return "Merci de faire confiance à SpeakFree. Peux-tu me donner un peu plus de détails sur ce que tu aimerais signaler ?";
    }
    
    if (conversationStage === 1) {
        // Deuxième étape - approfondir et chercher la date/heure
        if (!keywords.date) {
            return "Merci pour ces informations. Maintenant, dis-moi quand cela s'est passé exactement ? Est-ce aujourd'hui, hier, ou peut-être la semaine dernière ?";
        }
        return "D'accord. Et où exactement dans l'école cela s'est-il passé ? À la cour de récréation, au couloir, en classe, ou ailleurs ?";
    }
    
    if (conversationStage === 2) {
        // Troisième étape - localiser l'incident
        if (!keywords.lieu) {
            return "Peux-tu être plus précis sur le lieu ? Par exemple : à la cour pendant la récréation, dans le couloir, aux toilettes, etc. ?";
        }
        return "Merci. Maintenant, peux-tu me dire : y avait-il des témoins ? Des amis, d'autres élèves, ou un adulte présent ?";
    }
    
    if (conversationStage === 3) {
        // Quatrième étape - témoins et détails
        if (lowerMsg.includes('oui') || keywords.temoin) {
            return "C'est important d'avoir des témoins. Y a-t-il autre chose que tu aimerais que j'ajoute à ton signalement ? Des détails qui pourraient être importants ?";
        }
        if (lowerMsg.includes('non')) {
            return "D'accord, même sans témoins, ton signalement est important. Y a-t-il d'autres détails que tu souhaites ajouter ?";
        }
        return "Je comprends. Y a-t-il d'autres détails ou informations importants que tu aimerais ajouter ?";
    }
    
    if (conversationStage >= 4) {
        // Étape finale - confirmation
        if (userMessage.length < 20) {
            return "Merci pour toutes ces informations. Ton signalement va maintenant être créé et transmis de façon anonyme à l'école. Tu recevras bientôt un code de suivi pour suivre ton dossier. Quelque chose d'autre à ajouter avant de finaliser ?";
        }
        return "Merci pour tous ces détails précis. Ton signalement est prêt à être envoyé. Cela m'a plu de t'aider. L'école va prendre les mesures nécessaires. N'oublie pas que tu peux consulter l'état de ton signalement avec le code que tu recevras.";
    }
    
    // Réponse par défaut
    return "Je comprends. Peux-tu m'en dire un peu plus sur la situation ? Plus tu me donnes de détails, mieux je pourrais t'aider.";
}

// Ancienne fonction de fallback (gardée pour compatibilité)
function getFallbackResponse(userMessage) {
    return generateIntelligentResponse(userMessage, []);
}

// POST /api/ai-chat/finalize - Finaliser et créer un signalement à partir du chat
router.post('/finalize', (req, res) => {
    const db = req.app.locals.db;
    const { sessionCode, schoolCode } = req.body;
    
    // Récupérer la session et l'historique
    db.get(
        'SELECT * FROM ai_chat_sessions WHERE session_code = ?',
        [sessionCode],
        (err, session) => {
            if (err || !session) {
                return res.status(404).json({ error: 'Session non trouvée' });
            }
            
            db.all(
                'SELECT content FROM ai_chat_messages WHERE session_id = ? AND role = "user"',
                [session.id],
                (err, messages) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    // Concaténer tous les messages pour créer la description
                    const fullDescription = messages.map(m => m.content).join('\n\n');
                    
                    // Générer les codes
                    const trackingCode = 'RPT-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    const discussionCode = 'DSC-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                    
                    // Créer le signalement
                    db.get('SELECT id FROM schools WHERE school_code = ?', [schoolCode], (err, school) => {
                        if (err || !school) {
                            return res.status(404).json({ error: 'École non trouvée' });
                        }
                        
                        db.run(
                            `INSERT INTO reports (
                                school_id, tracking_code, discussion_code, 
                                incident_type, description, incident_date, 
                                location, status
                            ) VALUES (?, ?, ?, "autre", ?, date('now'), "Non spécifié", "pending")`,
                            [school.id, trackingCode, discussionCode, fullDescription],
                            function(err) {
                                if (err) {
                                    return res.status(500).json({ error: 'Erreur création signalement' });
                                }
                                
                                // Marquer la session comme terminée
                                db.run(
                                    'UPDATE ai_chat_sessions SET status = "completed" WHERE id = ?',
                                    [session.id]
                                );
                                
                                res.json({
                                    message: 'Signalement créé avec succès',
                                    trackingCode,
                                    discussionCode,
                                    reportId: this.lastID
                                });
                            }
                        );
                    });
                }
            );
        }
    );
});

module.exports = router;