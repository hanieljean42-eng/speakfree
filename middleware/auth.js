// middleware/auth.js - Middleware d'authentification JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware pour vérifier le token JWT
 */
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            error: 'Token manquant',
            code: 'MISSING_TOKEN'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ 
            error: 'Token invalide ou expiré',
            code: 'INVALID_TOKEN',
            details: err.message
        });
    }
}

/**
 * Middleware pour vérifier si c'est un super admin
 */
function verifySuperAdmin(req, res, next) {
    verifyToken(req, res, () => {
        if (!req.user.is_super_admin) {
            return res.status(403).json({ 
                error: 'Accès réservé aux super admin',
                code: 'INSUFFICIENT_PERMISSIONS'
            });
        }
        next();
    });
}

/**
 * Créer un JWT token
 */
function generateToken(adminData) {
    return jwt.sign(adminData, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = {
    verifyToken,
    verifySuperAdmin,
    generateToken,
    JWT_SECRET
};
