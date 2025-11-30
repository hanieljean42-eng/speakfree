// routes/auth.js - Authentification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'speakfree_secret_key_2024';

// POST /api/auth/login - Connexion admin
router.post('/login', async (req, res) => {
    const db = req.db;
    // Accepter "email" ou "identifier" du frontend
    const email = req.body.email || req.body.identifier;
    const password = req.body.password;
    
    console.log('[AUTH] Tentative de connexion:', email);
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    try {
        // Chercher par email OU par code école
        const [users] = await db.execute(
            `SELECT u.*, s.school_code, s.name as school_name 
             FROM users u 
             LEFT JOIN schools s ON u.school_id = s.id 
             WHERE u.email = ? OR s.school_code = ?`,
            [email, email.toUpperCase()]
        );
        
        if (users.length === 0) {
            console.log('[AUTH] Utilisateur non trouvé:', email);
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        
        const user = users[0];
        console.log('[AUTH] Utilisateur trouvé:', user.email);
        
        // Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('[AUTH] Mot de passe incorrect pour:', email);
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
        }
        
        // Générer le token JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
                schoolCode: user.school_code,
                isSuperAdmin: user.is_super_admin === 1
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('[AUTH] Connexion réussie pour:', email);
        
        // Extraire prénom et nom du username si possible
        const nameParts = (user.username || '').split(' ');
        const firstName = user.first_name || nameParts[0] || '';
        const lastName = user.last_name || nameParts.slice(1).join(' ') || '';
        
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            admin: {
                id: user.id,
                name: user.username,
                firstName: firstName,
                lastName: lastName,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
                schoolCode: user.school_code,
                schoolName: user.school_name,
                isSuperAdmin: user.is_super_admin === 1
            }
        });
        
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/register - Inscription admin
router.post('/register', async (req, res) => {
    const db = req.db;
    const { firstName, lastName, email, password, schoolId } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    
    try {
        // Vérifier si l'email existe déjà
        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        // Hasher le mot de passe
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Créer l'utilisateur
        const [result] = await db.execute(
            `INSERT INTO users (username, email, password, role, school_id)
             VALUES (?, ?, ?, 'admin', ?)`,
            [`${firstName} ${lastName}`, email, hashedPassword, schoolId]
        );
        
        res.status(201).json({
            success: true,
            message: 'Compte créé avec succès',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Erreur register:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/auth/verify - Vérifier le token
router.get('/verify', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Token requis', valid: false });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({
            valid: true,
            user: decoded
        });
    } catch (error) {
        res.status(401).json({ error: 'Token invalide', valid: false });
    }
});

// POST /api/auth/change-password - Changer le mot de passe
router.post('/change-password', async (req, res) => {
    const db = req.db;
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;
    
    if (!token) {
        return res.status(401).json({ error: 'Token requis' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [decoded.userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        const user = users[0];
        
        // Vérifier l'ancien mot de passe
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
        }
        
        // Hasher le nouveau mot de passe
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Mettre à jour
        await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, decoded.userId]);
        
        res.json({ success: true, message: 'Mot de passe modifié avec succès' });
        
    } catch (error) {
        console.error('Erreur change password:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
