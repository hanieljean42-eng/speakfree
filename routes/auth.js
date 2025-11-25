// routes/auth.js - Routes d'authentification
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Middleware pour vérifier le JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Token manquant' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide' });
    }
};

// POST /api/auth/register - Inscription d'un admin
router.post('/register', async (req, res) => {
    const db = req.app.locals.db;
    const { schoolCode, email, password, firstName, lastName, position, phone } = req.body;
    
    try {
        // Vérifier que l'école existe
        db.get('SELECT id FROM schools WHERE school_code = ?', [schoolCode], async (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            // Vérifier que l'email n'existe pas déjà
            db.get('SELECT id FROM admins WHERE email = ?', [email], async (err, existingAdmin) => {
                if (err) {
                    return res.status(500).json({ error: 'Erreur serveur' });
                }
                
                if (existingAdmin) {
                    return res.status(400).json({ error: 'Email déjà utilisé' });
                }
                
                // Hasher le mot de passe
                const passwordHash = await bcrypt.hash(password, 10);
                
                // Créer l'admin
                db.run(
                    `INSERT INTO admins (school_id, email, password_hash, first_name, last_name, position, phone)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [school.id, email, passwordHash, firstName, lastName, position, phone],
                    function(err) {
                        if (err) {
                            return res.status(500).json({ error: 'Erreur création admin' });
                        }
                        
                        res.status(201).json({
                            message: 'Administrateur créé avec succès',
                            adminId: this.lastID
                        });
                    }
                );
            });
        });
    } catch (error) {
        console.error('Erreur register:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/auth/login - Connexion d'un admin
router.post('/login', async (req, res) => {
    const db = req.app.locals.db;
    const { identifier, password } = req.body; // identifier = email ou schoolCode
    
    try {
        // Chercher l'admin par email
        let query = 'SELECT admins.*, schools.school_code, schools.name as school_name FROM admins JOIN schools ON admins.school_id = schools.id WHERE admins.email = ?';
        let params = [identifier];
        
        // Si l'identifier ressemble à un code école, chercher par code
        if (identifier.startsWith('ECOLE-')) {
            query = 'SELECT admins.*, schools.school_code, schools.name as school_name FROM admins JOIN schools ON admins.school_id = schools.id WHERE schools.school_code = ?';
        }
        
        db.get(query, params, async (err, admin) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!admin) {
                return res.status(401).json({ error: 'Identifiants incorrects' });
            }
            
            // Vérifier le mot de passe
            const validPassword = await bcrypt.compare(password, admin.password_hash);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Identifiants incorrects' });
            }
            
            // Créer le token JWT
            const token = jwt.sign(
                { 
                    id: admin.id,
                    email: admin.email,
                    schoolId: admin.school_id,
                    schoolCode: admin.school_code,
                    isSuperAdmin: admin.is_super_admin === 1
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            res.json({
                message: 'Connexion réussie',
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    firstName: admin.first_name,
                    lastName: admin.last_name,
                    position: admin.position,
                    schoolName: admin.school_name,
                    schoolCode: admin.school_code,
                    isSuperAdmin: admin.is_super_admin === 1
                }
            });
        });
    } catch (error) {
        console.error('Erreur login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/auth/me - Récupérer les infos de l'admin connecté
router.get('/me', verifyToken, (req, res) => {
    const db = req.app.locals.db;
    
    db.get(
        `SELECT admins.*, schools.school_code, schools.name as school_name 
         FROM admins 
         JOIN schools ON admins.school_id = schools.id 
         WHERE admins.id = ?`,
        [req.admin.id],
        (err, admin) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!admin) {
                return res.status(404).json({ error: 'Admin non trouvé' });
            }
            
            res.json({
                id: admin.id,
                email: admin.email,
                firstName: admin.first_name,
                lastName: admin.last_name,
                position: admin.position,
                phone: admin.phone,
                schoolName: admin.school_name,
                schoolCode: admin.school_code,
                isSuperAdmin: admin.is_super_admin === 1
            });
        }
    );
});

// POST /api/auth/verify-super-admin - Vérifier le code super admin
router.post('/verify-super-admin', (req, res) => {
    const { code } = req.body;
    
    if (code === process.env.SUPER_ADMIN_PASSWORD) {
        // Créer un token temporaire pour le super admin
        const token = jwt.sign(
            { 
                isSuperAdmin: true,
                type: 'super_admin'
            },
            process.env.JWT_SECRET,
            { expiresIn: '4h' }
        );
        
        res.json({
            success: true,
            token,
            message: 'Code super admin valide'
        });
    } else {
        res.status(401).json({ error: 'Code super admin incorrect' });
    }
});

// POST /api/auth/change-password - Changer le mot de passe
router.post('/change-password', verifyToken, async (req, res) => {
    const db = req.app.locals.db;
    const { currentPassword, newPassword } = req.body;
    
    try {
        // Récupérer l'admin
        db.get('SELECT password_hash FROM admins WHERE id = ?', [req.admin.id], async (err, admin) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!admin) {
                return res.status(404).json({ error: 'Admin non trouvé' });
            }
            
            // Vérifier l'ancien mot de passe
            const validPassword = await bcrypt.compare(currentPassword, admin.password_hash);
            
            if (!validPassword) {
                return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
            }
            
            // Hasher le nouveau mot de passe
            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            
            // Mettre à jour
            db.run(
                'UPDATE admins SET password_hash = ? WHERE id = ?',
                [newPasswordHash, req.admin.id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur mise à jour' });
                    }
                    
                    res.json({ message: 'Mot de passe changé avec succès' });
                }
            );
        });
    } catch (error) {
        console.error('Erreur change-password:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
module.exports.verifyToken = verifyToken;