const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/speakfree.db');

db.run("UPDATE schools SET status = 'pending' WHERE id = 7", function(err) {
    if(err) {
        console.error('Erreur:', err);
    } else {
        console.log('✅ École remise en attente, changes:', this.changes);
    }
    db.close();
});
