// routes/schools.js - Gestion des écoles
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Générer un code école unique
function generateSchoolCode() {
    return 'ECOLE-' + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// ⚠️ IMPORTANT: Les routes spécifiques AVANT les routes avec paramètres

// GET /api/schools/stats/global - Statistiques globales (DOIT être AVANT /:code)
router.get('/stats/global', async (req, res) => {
    const db = req.db;
    
    try {
        const [[{ totalSchools }]] = await db.execute('SELECT COUNT(*) as totalSchools FROM schools WHERE status = "active"');
        const [[{ totalReports }]] = await db.execute('SELECT COUNT(*) as totalReports FROM reports');
        const [[{ totalAdmins }]] = await db.execute('SELECT COUNT(*) as totalAdmins FROM users WHERE role = "admin"');
        
        // Format attendu par index.html: schools, reports, admins
        res.json({
            success: true,
            schools: totalSchools,
            reports: totalReports,
            admins: totalAdmins,
            // Compatibilité avec l'ancien format
            stats: { totalSchools, totalReports, totalAdmins }
        });
        
    } catch (error) {
        console.error('Erreur stats:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/schools/register - Inscription d'une nouvelle école
router.post('/register', async (req, res) => {
    const db = req.db;
    const { 
        schoolName, schoolType, city, district, address, studentCount,
        firstName, lastName, position, email, phone, motivation, existingSystem 
    } = req.body;
    
    try {
        // Vérifier les champs requis
        if (!schoolName || !schoolType || !city || !address || !firstName || !lastName || !email) {
            return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires' });
        }
        
        // Vérifier si l'email existe déjà
        const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        // Vérifier si l'école existe déjà
        const [existingSchool] = await db.execute('SELECT id FROM schools WHERE name = ? AND city = ?', [schoolName, city]);
        if (existingSchool.length > 0) {
            return res.status(400).json({ error: 'Cette école est déjà inscrite' });
        }
        
        // Générer le code école
        const schoolCode = generateSchoolCode();
        
        // Créer l'école (statut pending en attendant validation)
        const [schoolResult] = await db.execute(
            `INSERT INTO schools (school_code, name, type, city, district, address, student_count, status, motivation, existing_system)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [schoolCode, schoolName, schoolType, city, district || '', address, studentCount || null, motivation || '', existingSystem || '']
        );
        
        // Créer l'admin dans la table admins
        await db.execute(
            `INSERT INTO admins (school_id, email, password_hash, first_name, last_name, position, phone)
             VALUES (?, ?, '', ?, ?, ?, ?)`,
            [schoolResult.insertId, email, firstName, lastName, position || 'Administrateur', phone || '']
        );
        
        res.status(201).json({
            success: true,
            message: 'Demande d\'inscription envoyée avec succès ! Vous serez contacté sous 48h.',
            schoolCode,
            schoolId: schoolResult.insertId
        });
        
    } catch (error) {
        console.error('Erreur register school:', error);
        res.status(500).json({ error: 'Erreur serveur: ' + error.message });
    }
});

// GET /api/schools - Liste des écoles
router.get('/', async (req, res) => {
    const db = req.db;
    
    try {
        const [schools] = await db.execute(
            'SELECT id, school_code, name, type, city, status, created_at FROM schools WHERE status = "active" ORDER BY name'
        );
        
        res.json({ success: true, schools });
        
    } catch (error) {
        console.error('Erreur list schools:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/schools/:code - Détails d'une école (DOIT être APRÈS les routes spécifiques)
router.get('/:code', async (req, res) => {
    const db = req.db;
    const { code } = req.params;
    
    try {
        const [schools] = await db.execute(
            'SELECT id, school_code, name, type, city, status FROM schools WHERE school_code = ?',
            [code]
        );
        
        if (schools.length === 0) {
            return res.status(404).json({ error: 'École non trouvée' });
        }
        
        res.json({ success: true, school: schools[0] });
        
    } catch (error) {
        console.error('Erreur get school:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
