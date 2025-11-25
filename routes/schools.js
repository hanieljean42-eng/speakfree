// routes/schools.js - Gestion des écoles
const express = require('express');
const router = express.Router();

// Fonction pour générer un code école unique
function generateSchoolCode(name) {
    const prefix = 'ECOLE';
    const suffix = name.substring(0, 2).toUpperCase() + Date.now().toString().slice(-4);
    return `${prefix}-${suffix}`;
}

// POST /api/schools/register - Inscription d'une école
router.post('/register', (req, res) => {
    const db = req.app.locals.db;
    const {
        schoolName,
        schoolType,
        city,
        district,
        address,
        studentCount,
        firstName,
        lastName,
        position,
        email,
        phone,
        motivation,
        existingSystem
    } = req.body;
    
    // Validation des champs requis
    if (!schoolName || !schoolType || !city || !address || !firstName || !lastName || !email || !phone) {
        return res.status(400).json({ error: 'Champs requis manquants' });
    }
    
    // Vérifier si l'email existe déjà
    db.get('SELECT id FROM admins WHERE email = ?', [email], (err, existing) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        if (existing) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé' });
        }
        
        // Générer le code école
        const schoolCode = generateSchoolCode(schoolName);
        
        // Insérer l'école
        db.run(
            `INSERT INTO schools (
                school_code, name, type, city, district, 
                address, student_count, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [schoolCode, schoolName, schoolType, city, district, address, studentCount || null],
            function(err) {
                if (err) {
                    console.error('Erreur insertion école:', err);
                    return res.status(500).json({ error: 'Erreur inscription école' });
                }
                
                const schoolId = this.lastID;
                
                // Créer un admin temporaire (mot de passe sera défini après approbation)
                db.run(
                    `INSERT INTO admins (
                        school_id, email, password_hash, first_name, 
                        last_name, position, phone
                    ) VALUES (?, ?, 'TEMPORARY', ?, ?, ?, ?)`,
                    [schoolId, email, firstName, lastName, position, phone],
                    function(err) {
                        if (err) {
                            console.error('Erreur création admin:', err);
                            return res.status(500).json({ error: 'Erreur création administrateur' });
                        }
                        
                        res.status(201).json({
                            message: 'Demande d\'inscription envoyée avec succès',
                            schoolCode,
                            schoolId,
                            adminId: this.lastID,
                            status: 'pending'
                        });
                    }
                );
            }
        );
    });
});

// GET /api/schools/list - Liste des écoles actives
router.get('/list', (req, res) => {
    const db = req.app.locals.db;
    
    db.all(
        `SELECT 
            id, school_code, name, type, city, 
            district, student_count, created_at
         FROM schools 
         WHERE status = 'active'
         ORDER BY name ASC`,
        [],
        (err, schools) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            // Compter les signalements pour chaque école
            const schoolsWithStats = schools.map(school => {
                return new Promise((resolve, reject) => {
                    db.get(
                        'SELECT COUNT(*) as count FROM reports WHERE school_id = ?',
                        [school.id],
                        (err, result) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve({
                                    ...school,
                                    reportsCount: result.count
                                });
                            }
                        }
                    );
                });
            });
            
            Promise.all(schoolsWithStats)
                .then(results => {
                    res.json({ schools: results });
                })
                .catch(err => {
                    console.error('Erreur stats écoles:', err);
                    res.json({ schools }); // Envoyer sans stats en cas d'erreur
                });
        }
    );
});

// GET /api/schools/:schoolCode - Détails d'une école
router.get('/:schoolCode', (req, res) => {
    const db = req.app.locals.db;
    const { schoolCode } = req.params;
    
    db.get(
        'SELECT * FROM schools WHERE school_code = ?',
        [schoolCode],
        (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            // Compter les signalements
            db.get(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
                 FROM reports 
                 WHERE school_id = ?`,
                [school.id],
                (err, stats) => {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur serveur' });
                    }
                    
                    res.json({
                        ...school,
                        stats: stats || { total: 0, pending: 0, in_progress: 0, resolved: 0 }
                    });
                }
            );
        }
    );
});

// GET /api/schools/verify/:schoolCode - Vérifier si une école existe et est active
router.get('/verify/:schoolCode', (req, res) => {
    const db = req.app.locals.db;
    const { schoolCode } = req.params;
    
    db.get(
        'SELECT id, name, status FROM schools WHERE school_code = ?',
        [schoolCode],
        (err, school) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            if (!school) {
                return res.json({ 
                    exists: false, 
                    active: false 
                });
            }
            
            res.json({
                exists: true,
                active: school.status === 'active',
                name: school.name,
                status: school.status
            });
        }
    );
});

// PATCH /api/schools/:schoolId - Mettre à jour les informations d'une école (admin)
router.patch('/:schoolId', (req, res) => {
    const db = req.app.locals.db;
    const { schoolId } = req.params;
    const { name, address, phone, studentCount } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name) {
        updates.push('name = ?');
        values.push(name);
    }
    if (address) {
        updates.push('address = ?');
        values.push(address);
    }
    if (studentCount !== undefined) {
        updates.push('student_count = ?');
        values.push(studentCount);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucune mise à jour fournie' });
    }
    
    values.push(schoolId);
    
    db.run(
        `UPDATE schools SET ${updates.join(', ')} WHERE id = ?`,
        values,
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur mise à jour' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'École non trouvée' });
            }
            
            res.json({ message: 'École mise à jour avec succès' });
        }
    );
});

// GET /api/schools/stats/global - Statistiques globales
router.get('/stats/global', (req, res) => {
    const db = req.app.locals.db;
    
    // Compter les écoles
    db.get('SELECT COUNT(*) as total FROM schools WHERE status = "active"', [], (err, schoolCount) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur serveur' });
        }
        
        // Compter les signalements
        db.get('SELECT COUNT(*) as total FROM reports', [], (err, reportCount) => {
            if (err) {
                return res.status(500).json({ error: 'Erreur serveur' });
            }
            
            // Compter les admins
            db.get('SELECT COUNT(*) as total FROM admins', [], (err, adminCount) => {
                if (err) {
                    return res.status(500).json({ error: 'Erreur serveur' });
                }
                
                res.json({
                    schools: schoolCount.total,
                    reports: reportCount.total,
                    admins: adminCount.total
                });
            });
        });
    });
});

module.exports = router;