// seed-data.js - Script pour remplir la base de données avec des données de démonstration
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/speakfree.db');

async function seedDatabase() {
    console.log('🌱 Démarrage de l\'insertion de données de démonstration...\n');

    // Écoles de démonstration
    const schools = [
        {
            school_code: 'LYC001',
            name: 'Lycée Henri Wallon',
            type: 'Lycée',
            city: 'Aubervilliers',
            district: 'Seine-Saint-Denis',
            address: '123 Avenue de la République',
            student_count: 1200
        },
        {
            school_code: 'COL002',
            name: 'Collège Jules Michelet',
            type: 'Collège',
            city: 'Bagnolet',
            district: 'Seine-Saint-Denis',
            address: '45 Rue de la Paix',
            student_count: 850
        },
        {
            school_code: 'LYC003',
            name: 'Lycée Technique Marchal Ney',
            type: 'Lycée Technique',
            city: 'Saint-Denis',
            district: 'Seine-Saint-Denis',
            address: '789 Boulevard Voltaire',
            student_count: 950
        },
        {
            school_code: 'COL004',
            name: 'Collège Rosa Luxemburg',
            type: 'Collège',
            city: 'La Courneuve',
            district: 'Seine-Saint-Denis',
            address: '56 Avenue du Général Leclerc',
            student_count: 720
        },
        {
            school_code: 'LYC005',
            name: 'Lycée Professionnel Louis Armand',
            type: 'Lycée Professionnel',
            city: 'Villepinte',
            district: 'Seine-Saint-Denis',
            address: '234 Route de la Liberté',
            student_count: 600
        }
    ];

    // Admins de démonstration
    const admins = [
        {
            email: 'admin1@lyceewallon.edu',
            password: 'Admin@123456',
            first_name: 'Marie',
            last_name: 'Dupont',
            position: 'CPE',
            phone: '01 42 43 00 00',
            school_code: 'LYC001'
        },
        {
            email: 'admin2@collegejules.edu',
            password: 'Admin@123456',
            first_name: 'Pierre',
            last_name: 'Martin',
            position: 'Principal',
            phone: '01 43 01 00 00',
            school_code: 'COL002'
        },
        {
            email: 'admin3@lyceemarchal.edu',
            password: 'Admin@123456',
            first_name: 'Sophie',
            last_name: 'Bernard',
            position: 'CPE',
            phone: '01 55 39 00 00',
            school_code: 'LYC003'
        },
        {
            email: 'admin4@collegerosa.edu',
            password: 'Admin@123456',
            first_name: 'Jean',
            last_name: 'Moreau',
            position: 'Adjoint Principal',
            phone: '01 48 63 00 00',
            school_code: 'COL004'
        },
        {
            email: 'admin5@lyceeprofessionnel.edu',
            password: 'Admin@123456',
            first_name: 'Nathalie',
            last_name: 'Lefevre',
            position: 'CPE',
            phone: '01 49 40 00 00',
            school_code: 'LYC005'
        }
    ];

    // Signalements de démonstration
    const reports = [
        {
            school_code: 'LYC001',
            incident_type: 'Harcèlement',
            description: 'Harcèlement lors des récréations',
            incident_date: '2025-11-20',
            incident_time: '10:30',
            location: 'Cour de récréation',
            witnesses: 'Plusieurs témoins',
            status: 'pending'
        },
        {
            school_code: 'LYC001',
            incident_type: 'Violence',
            description: 'Bagarre entre étudiants',
            incident_date: '2025-11-22',
            incident_time: '14:00',
            location: 'Cafétéria',
            witnesses: 'Personnel présent',
            status: 'in_progress'
        },
        {
            school_code: 'COL002',
            incident_type: 'Vol',
            description: 'Vol de téléphone portable',
            incident_date: '2025-11-19',
            incident_time: '13:45',
            location: 'Vestiaire',
            witnesses: 'Inconnu',
            status: 'resolved'
        },
        {
            school_code: 'LYC003',
            incident_type: 'Cyber-Harcèlement',
            description: 'Messages abusifs sur réseaux sociaux',
            incident_date: '2025-11-21',
            incident_time: '20:15',
            location: 'En ligne',
            witnesses: 'Compte de l\'auteur visible',
            status: 'pending'
        },
        {
            school_code: 'COL004',
            incident_type: 'Dégradation de biens',
            description: 'Tables et chaises endommagées',
            incident_date: '2025-11-18',
            incident_time: '16:30',
            location: 'Salle de classe',
            witnesses: 'Professeur',
            status: 'resolved'
        },
        {
            school_code: 'LYC005',
            incident_type: 'Incivilités',
            description: 'Non-respect des règles de l\'établissement',
            incident_date: '2025-11-23',
            incident_time: '09:00',
            location: 'Corridors',
            witnesses: 'Personnels éducatifs',
            status: 'in_progress'
        },
        {
            school_code: 'LYC001',
            incident_type: 'Discrimination',
            description: 'Remarques discriminatoires',
            incident_date: '2025-11-15',
            incident_time: '11:20',
            location: 'Classe de français',
            witnesses: 'Professeur et autres étudiants',
            status: 'resolved'
        }
    ];

    return new Promise((resolve, reject) => {
        db.serialize(async () => {
            try {
                // Vider les tables (ordre inverse pour les clés étrangères)
                console.log('🗑️  Nettoyage des données existantes...');
                await new Promise(resolve => {
                    db.run('DELETE FROM ai_chat_messages', () => {
                        db.run('DELETE FROM ai_chat_sessions', () => {
                            db.run('DELETE FROM discussions', () => {
                                db.run('DELETE FROM report_files', () => {
                                    db.run('DELETE FROM reports', () => {
                                        db.run('DELETE FROM admins', () => {
                                            db.run('DELETE FROM schools', resolve);
                                        });
                                    });
                                });
                            });
                        });
                    });
                });

                // Insérer les écoles
                console.log('🏫 Insertion des écoles...');
                for (const school of schools) {
                    await new Promise((resolve, reject) => {
                        db.run(
                            `INSERT INTO schools (school_code, name, type, city, district, address, student_count, status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
                            [school.school_code, school.name, school.type, school.city, school.district, school.address, school.student_count],
                            function(err) {
                                if (err) reject(err);
                                console.log(`  ✅ ${school.name} (${school.school_code})`);
                                resolve();
                            }
                        );
                    });
                }

                // Insérer les admins
                console.log('\n👨‍💼 Insertion des administrateurs...');
                for (const admin of admins) {
                    const passwordHash = await bcrypt.hash(admin.password, 10);
                    await new Promise((resolve, reject) => {
                        db.get('SELECT id FROM schools WHERE school_code = ?', [admin.school_code], (err, school) => {
                            if (err || !school) {
                                reject(err || new Error('École non trouvée'));
                                return;
                            }

                            db.run(
                                `INSERT INTO admins (school_id, email, password_hash, first_name, last_name, position, phone)
                                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                                [school.id, admin.email, passwordHash, admin.first_name, admin.last_name, admin.position, admin.phone],
                                function(err) {
                                    if (err) reject(err);
                                    console.log(`  ✅ ${admin.first_name} ${admin.last_name} (${admin.email})`);
                                    resolve();
                                }
                            );
                        });
                    });
                }

                // Insérer les signalements
                console.log('\n📝 Insertion des signalements...');
                let reportCounter = 0;
                for (const report of reports) {
                    const trackingCode = `TRACK-${Date.now()}-${++reportCounter}`;
                    const discussionCode = `DISC-${Date.now()}-${reportCounter}`;

                    await new Promise((resolve, reject) => {
                        db.get('SELECT id FROM schools WHERE school_code = ?', [report.school_code], (err, school) => {
                            if (err || !school) {
                                reject(err || new Error('École non trouvée'));
                                return;
                            }

                            db.run(
                                `INSERT INTO reports (school_id, tracking_code, discussion_code, incident_type, description, incident_date, incident_time, location, witnesses, status)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                                [school.id, trackingCode, discussionCode, report.incident_type, report.description, report.incident_date, report.incident_time, report.location, report.witnesses, report.status],
                                function(err) {
                                    if (err) reject(err);
                                    console.log(`  ✅ ${report.incident_type} - ${report.status}`);
                                    resolve();
                                }
                            );
                        });
                    });
                }

                console.log('\n✨ Données de démonstration insérées avec succès!\n');
                console.log('📊 Statistiques:');
                console.log(`   - Écoles: ${schools.length}`);
                console.log(`   - Administrateurs: ${admins.length}`);
                console.log(`   - Signalements: ${reports.length}`);
                console.log('\n🔐 Informations de connexion de démonstration:');
                for (const admin of admins) {
                    console.log(`   Email: ${admin.email}`);
                    console.log(`   Mot de passe: ${admin.password}\n`);
                }

                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Exécuter le script
seedDatabase()
    .then(() => {
        console.log('✅ Script terminé avec succès');
        db.close();
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Erreur:', err);
        db.close();
        process.exit(1);
    });
