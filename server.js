// server.js - Serveur Express Principal SpeakFree (MySQL)
require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');

// Créer l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Pool de connexions MySQL
let pool;

// Initialiser la connexion MySQL
async function initDatabase() {
    try {
        // Configuration de base
        const dbConfig = {
            host: process.env.MYSQL_HOST || 'localhost',
            user: process.env.MYSQL_USER || 'root',
            password: process.env.MYSQL_PASSWORD || '',
            database: process.env.MYSQL_DATABASE || 'speakfree',
            port: parseInt(process.env.MYSQL_PORT) || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            // Forcer le charset pour éviter les problèmes de collation
            charset: 'utf8mb4'
        };
        
        // Ajouter SSL pour la production (si configuré)
        if (process.env.MYSQL_SSL === 'true' || process.env.NODE_ENV === 'production') {
            dbConfig.ssl = {
                // Pour Clever Cloud et autres, désactiver la vérification des certificats auto-signés
                rejectUnauthorized: false
            };
            console.log('🔒 SSL activé pour MySQL');
        }
        
        pool = mysql.createPool(dbConfig);

        // Tester la connexion
        const connection = await pool.getConnection();
        
        // Forcer le charset de la connexion
        await connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
        
        console.log('✅ Base de données MySQL connectée');
        console.log(`   Host: ${dbConfig.host}, Database: ${dbConfig.database}`);
        connection.release();

        // Stocker le pool dans app.locals pour les routes
        app.locals.db = pool;

        // Créer les tables
        await createTables();
        
    } catch (err) {
        console.error('❌ Erreur connexion MySQL:', err.message);
        console.log('\n💡 Assurez-vous que MySQL est installé et configuré.');
        console.log('   Variables à définir dans .env :');
        console.log('   MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE\n');
        process.exit(1);
    }
}

// Créer les tables si elles n'existent pas
async function createTables() {
    const queries = [
        // Table des écoles
        `CREATE TABLE IF NOT EXISTS schools (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(100) NOT NULL,
            city VARCHAR(100) NOT NULL,
            district VARCHAR(100),
            address TEXT NOT NULL,
            student_count INT,
            status VARCHAR(20) DEFAULT 'pending',
            motivation TEXT,
            existing_system VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`,

        // Table des administrateurs
        `CREATE TABLE IF NOT EXISTS admins (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            position VARCHAR(100) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            is_super_admin BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
        )`,

        // Table des utilisateurs (pour l'authentification des admins)
        `CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT,
            username VARCHAR(200) DEFAULT '',
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            first_name VARCHAR(100) DEFAULT '',
            last_name VARCHAR(100) DEFAULT '',
            position VARCHAR(100) DEFAULT 'Administrateur',
            phone VARCHAR(50) DEFAULT '',
            role VARCHAR(20) DEFAULT 'admin',
            is_super_admin TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
        )`,

        // Table des signalements
        `CREATE TABLE IF NOT EXISTS reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_id INT NOT NULL,
            tracking_code VARCHAR(50) UNIQUE NOT NULL,
            discussion_code VARCHAR(50) UNIQUE NOT NULL,
            incident_type VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            incident_date DATE,
            incident_time TIME,
            location VARCHAR(255),
            witnesses TEXT,
            additional_info TEXT,
            status VARCHAR(20) DEFAULT 'pending',
            from_chat_session VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
        )`,

        // Table des fichiers joints
        `CREATE TABLE IF NOT EXISTS report_files (
            id INT AUTO_INCREMENT PRIMARY KEY,
            report_id INT NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NOT NULL,
            file_type VARCHAR(100) NOT NULL,
            file_size INT NOT NULL,
            file_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
        )`,

        // Table des discussions
        `CREATE TABLE IF NOT EXISTS discussions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            report_id INT NOT NULL,
            discussion_code VARCHAR(50) UNIQUE NOT NULL,
            school_id INT NOT NULL,
            status VARCHAR(20) DEFAULT 'open',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
        )`,

        // Table des messages de discussion
        `CREATE TABLE IF NOT EXISTS discussion_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            discussion_id INT NOT NULL,
            sender VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
        )`,

        // Table des sessions chat IA
        `CREATE TABLE IF NOT EXISTS ai_chat_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id VARCHAR(50) UNIQUE NOT NULL,
            school_id INT,
            status VARCHAR(20) DEFAULT 'active',
            ended_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL
        )`,

        // Table des messages chat IA
        `CREATE TABLE IF NOT EXISTS ai_chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            session_id INT NOT NULL,
            sender VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            category VARCHAR(50),
            file_path TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES ai_chat_sessions(id) ON DELETE CASCADE
        )`
    ];

    for (const query of queries) {
        try {
            await pool.execute(query);
        } catch (err) {
            console.error('Erreur création table:', err.message);
        }
    }
    
    // Corriger la collation des tables existantes pour éviter les problèmes
    try {
        await pool.execute("ALTER DATABASE " + (process.env.MYSQL_DATABASE || 'speakfree') + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (err) {
        // Ignorer si pas les droits
    }
    
    // Corriger spécifiquement les tables de chat IA
    const fixCollationQueries = [
        "ALTER TABLE ai_chat_sessions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
        "ALTER TABLE ai_chat_messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];
    
    for (const query of fixCollationQueries) {
        try {
            await pool.execute(query);
        } catch (err) {
            // Ignorer les erreurs de collation
        }
    }

    console.log('✅ Tables de base de données créées/vérifiées');
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

// CORS - Configuration pour dev et production
const corsOptions = {
    origin: function (origin, callback) {
        // Origines autorisées
        const allowedOrigins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5500',          // Live Server VSCode
            'http://127.0.0.1:5500',
            'https://speakfree.netlify.app',  // Production Netlify
            'https://speakfree-school.netlify.app',  // Production Netlify
            // Cloudflare Pages sera ajouté automatiquement via les règles ci-dessous
        ];
        
        // Autoriser les requêtes sans origin (comme les applis mobiles ou Postman)
        if (!origin) return callback(null, true);
        
        // Autoriser tous les sous-domaines Cloudflare Pages (*.pages.dev)
        if (origin.includes('.pages.dev')) return callback(null, true);
        
        // Autoriser tous les sous-domaines netlify.app
        if (origin.includes('netlify.app')) return callback(null, true);
        
        // Autoriser tous les localhost
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
        
        // Vérifier la liste blanche
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        // En production, autoriser aussi l'origin par défaut
        if (process.env.NODE_ENV === 'production') {
            return callback(null, true);
        }
        
        callback(new Error('CORS non autorisé'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000,
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

// Middleware pour passer le pool MySQL aux routes
// Le pool est stocké dans app.locals.db après initDatabase()
app.use((req, res, next) => {
    req.db = app.locals.db || pool;
    if (!req.db) {
        console.warn('[MIDDLEWARE] DB non disponible pour', req.path);
    }
    next();
});

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
        database: 'MySQL',
        timestamp: new Date().toISOString()
    });
});

// Routes des pages HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/welcome', (req, res) => res.sendFile(path.join(__dirname, 'public', 'welcome.html')));
app.get('/chat-ia', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat-ia.html')));
app.get('/report', (req, res) => res.sendFile(path.join(__dirname, 'public', 'report.html')));
app.get('/discussion', (req, res) => res.sendFile(path.join(__dirname, 'public', 'discussion.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/super-admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'super-admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register-school', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register-school.html')));
app.get('/guide', (req, res) => res.sendFile(path.join(__dirname, 'public', 'guide.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, 'public', 'about.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, 'public', 'terms.html')));
app.get('/schools', (req, res) => res.sendFile(path.join(__dirname, 'public', 'schools.html')));
app.get('/statistics', (req, res) => res.sendFile(path.join(__dirname, 'public', 'statistics.html')));
app.get('/schools-list', (req, res) => res.sendFile(path.join(__dirname, 'public', 'schools-list.html')));
app.get('/getting-started', (req, res) => res.sendFile(path.join(__dirname, 'public', 'getting-started.html')));

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
async function startServer() {
    await initDatabase();
    
    app.listen(PORT, () => {
        console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║            💬 SpeakFree API Server                    ║
║                                                       ║
║   🚀 Serveur démarré sur http://localhost:${PORT}     ║
║   📅 ${new Date().toLocaleString('fr-FR')}            ║
║   🔒 Mode: ${process.env.NODE_ENV || 'development'}   ║
║   🗄️  Base: MySQL                                     ║
║   👨‍💻 Par: Haniel DJEBLE                               ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
        `);
    });
}

// Gestion de l'arrêt propre
process.on('SIGINT', async () => {
    console.log('\n👋 Arrêt du serveur...');
    if (pool) {
        await pool.end();
        console.log('✅ Connexion MySQL fermée');
    }
    process.exit(0);
});

startServer();

module.exports = app;
