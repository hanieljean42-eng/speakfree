// server.js - Serveur Express Principal SpeakFree
require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

// Créer l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Initialiser la base de données
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database/speakfree.db', (err) => {
    if (err) {
        console.error('❌ Erreur connexion base de données:', err);
    } else {
        console.log('✅ Base de données connectée');
        initDatabase();
    }
});

// Fonction d'initialisation de la base de données
function initDatabase() {
    db.serialize(() => {
        // Table des écoles
        db.run(`CREATE TABLE IF NOT EXISTS schools (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            city TEXT NOT NULL,
            district TEXT,
            address TEXT NOT NULL,
            student_count INTEGER,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Table des administrateurs
        db.run(`CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id INTEGER NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            position TEXT NOT NULL,
            phone TEXT NOT NULL,
            is_super_admin BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id)
        )`);

        // Table des signalements
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            school_id INTEGER NOT NULL,
            tracking_code TEXT UNIQUE NOT NULL,
            discussion_code TEXT UNIQUE NOT NULL,
            incident_type TEXT NOT NULL,
            description TEXT NOT NULL,
            incident_date DATE NOT NULL,
            incident_time TIME,
            location TEXT NOT NULL,
            witnesses TEXT,
            additional_info TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id)
        )`);

        // Table des fichiers joints
        db.run(`CREATE TABLE IF NOT EXISTS report_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            file_type TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES reports(id)
        )`);

        // Table des discussions
        db.run(`CREATE TABLE IF NOT EXISTS discussions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER NOT NULL,
            sender_type TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES reports(id)
        )`);

        // Table des sessions chat IA
        db.run(`CREATE TABLE IF NOT EXISTS ai_chat_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_code TEXT UNIQUE NOT NULL,
            school_id INTEGER,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id)
        )`);

        // Table des messages chat IA
        db.run(`CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id)
        )`);

        console.log('✅ Tables de base de données créées/vérifiées');
    });
}

// Middleware de sécurité
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.anthropic.com"]
        }
    }
}));

// CORS - Accepter toutes les origines (frontend et Netlify)
app.use(cors({
    origin: true,  // Accepter toutes les origines
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting global - Limite augmentée pour le développement
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 requêtes par minute (très permissif pour dev)
    message: { error: 'Trop de requêtes, veuillez réessayer dans quelques secondes.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware pour logger les requêtes
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Rendre la base de données accessible aux routes
app.locals.db = db;

// Importer les routes
const authRoutes = require('./routes/auth');
const reportsRoutes = require('./routes/reports');
const schoolsRoutes = require('./routes/schools');
const adminRoutes = require('./routes/admin');
const superAdminRoutes = require('./routes/super-admin');
const discussionsRoutes = require('./routes/discussions');
const aiChatRoutes = require('./routes/ai-chat');

// Monter les routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/discussions', discussionsRoutes);
app.use('/api/ai-chat', aiChatRoutes);

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'SpeakFree API est en ligne',
        timestamp: new Date().toISOString()
    });
});

// Routes des pages HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/welcome', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'welcome.html'));
});

app.get('/chat-ia', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat-ia.html'));
});

app.get('/report', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'report.html'));
});

app.get('/discussion', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'discussion.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/super-admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'super-admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register-school', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register-school.html'));
});

app.get('/reprendre-haniel', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reprendre-haniel.html'));
});

app.get('/guide', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'guide.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/terms', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'terms.html'));
});

app.get('/schools', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'schools.html'));
});

app.get('/statistics', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'statistics.html'));
});

app.get('/schools-list', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'schools-list.html'));
});

app.get('/getting-started', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'getting-started.html'));
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route non trouvée',
        path: req.path 
    });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Erreur serveur' 
            : err.message
    });
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║            💬 SpeakFree API Server                    ║
║                                                       ║
║   🚀 Serveur démarré sur http://localhost:${PORT}     ║
║   📅 ${new Date().toLocaleString('fr-FR')}            ║
║   🔒 Mode: ${process.env.NODE_ENV || 'development'}   ║
║   👨‍💻 Par: Haniel DJEBLE                               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
});

// Gestion de l'arrêt propre
process.on('SIGINT', () => {
    console.log('\n👋 Arrêt du serveur...');
    db.close((err) => {
        if (err) {
            console.error('❌ Erreur fermeture DB:', err);
        } else {
            console.log('✅ Base de données fermée');
        }
        process.exit(0);
    });
});

module.exports = app;