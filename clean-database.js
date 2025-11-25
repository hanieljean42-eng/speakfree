// clean-database.js - Script pour nettoyer la base de données
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/speakfree.db');

async function cleanDatabase() {
    console.log('🧹 Démarrage du nettoyage de la base de données...\n');

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                console.log('🗑️  Suppression de toutes les données...');
                
                // Vider les tables (ordre inverse pour les clés étrangères)
                db.run('DELETE FROM ai_chat_messages', () => {
                    console.log('  ✅ ai_chat_messages vidée');
                    db.run('DELETE FROM ai_chat_sessions', () => {
                        console.log('  ✅ ai_chat_sessions vidée');
                        db.run('DELETE FROM discussions', () => {
                            console.log('  ✅ discussions vidée');
                            db.run('DELETE FROM report_files', () => {
                                console.log('  ✅ report_files vidée');
                                db.run('DELETE FROM reports', () => {
                                    console.log('  ✅ reports vidée');
                                    db.run('DELETE FROM admins', () => {
                                        console.log('  ✅ admins vidée');
                                        db.run('DELETE FROM schools', () => {
                                            console.log('  ✅ schools vidée');
                                            console.log('\n✨ Base de données nettoyée avec succès!\n');
                                            console.log('📊 État :');
                                            console.log('   - Écoles : 0');
                                            console.log('   - Administrateurs : 0');
                                            console.log('   - Signalements : 0');
                                            console.log('   - Sessions IA : 0');
                                            console.log('\n✅ La plateforme est maintenant vide et prête pour des données réelles.\n');
                                            resolve();
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            } catch (error) {
                reject(error);
            }
        });
    });
}

// Exécuter le script
cleanDatabase()
    .then(() => {
        console.log('✅ Nettoyage terminé avec succès');
        db.close();
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Erreur:', err);
        db.close();
        process.exit(1);
    });
