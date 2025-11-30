// config.js - Configuration centralisée de l'API
// Utilisé par tous les fichiers frontend

console.log('[CONFIG] Initialisation...');

// Déterminer l'URL de base selon l'environnement
function getApiUrl() {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    console.log(`[CONFIG] Hostname: ${hostname}, Protocol: ${protocol}`);
    
    // Environnement local
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return 'http://localhost:3000';
    }
    
    // Production sur Netlify → API sur Render
    if (hostname.includes('netlify.app') || hostname.includes('speakfree')) {
        // ⚠️ APRÈS DÉPLOIEMENT RENDER: Remplacez l'URL ci-dessous par votre vraie URL Render
        // Exemple: https://speakfree-api.onrender.com ou https://votre-nom.onrender.com
        return 'https://VOTRE-APP-RENDER.onrender.com';
    }
    
    // Production sur domaine personnalisé
    // Si le frontend et backend sont sur le même domaine
    if (protocol === 'https:') {
        return 'https://api.' + hostname;
    }
    
    // Fallback: même domaine
    return window.location.origin;
}

const CONFIG = {
    API_URL: getApiUrl(),
    
    // Endpoints
    ENDPOINTS: {
        // Authentification
        auth: {
            login: '/api/auth/login',
            register: '/api/auth/register',
            logout: '/api/auth/logout',
            verify: '/api/auth/verify'
        },
        
        // Écoles
        schools: {
            list: '/api/schools',
            register: '/api/schools/register',
            stats: '/api/schools/stats/global',
            pending: '/api/schools/pending',
            active: '/api/schools/active'
        },
        
        // Signalements
        reports: {
            create: '/api/reports',
            list: '/api/reports',
            detail: '/api/reports/:id',
            update: '/api/reports/:id',
            files: '/api/reports/:id/files'
        },
        
        // Chat IA
        aiChat: {
            createSession: '/api/ai-chat/create-session',
            sendMessage: '/api/ai-chat/message',
            getHistory: '/api/ai-chat/session/:sessionId'
        },
        
        // Discussions
        discussions: {
            create: '/api/discussions',
            list: '/api/discussions/:reportId'
        },
        
        // Admin
        admin: {
            dashboard: '/api/admin/dashboard',
            reports: '/api/admin/reports'
        },
        
        // Super Admin
        superAdmin: {
            stats: '/api/super-admin/stats',
            schools: {
                pending: '/api/super-admin/schools/pending',
                active: '/api/super-admin/schools/active',
                approve: '/api/super-admin/schools/:id/approve',
                reject: '/api/super-admin/schools/:id/reject'
            }
        }
    },

    // Timeouts (ms)
    TIMEOUT: 30000,
    
    // Retry config
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000
};

/**
 * Wrapper pour les appels API avec gestion d'erreur
 * @param {string} endpoint - URL de l'endpoint
 * @param {object} options - Options fetch (method, body, etc.)
 * @returns {Promise} Response data or error
 */
async function apiCall(endpoint, options = {}) {
    const url = CONFIG.API_URL + endpoint;
    const token = localStorage.getItem('speakfree_token');
    
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const fetchOptions = {
        method: options.method || 'GET',
        headers: { ...headers, ...(options.headers || {}) }
    };
    
    if (options.body) {
        fetchOptions.body = options.body;
    }
    
    console.log(`[API] ${fetchOptions.method} ${url}`);
    
    let lastError;
    
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, fetchOptions);
            console.log(`[API] Réponse: ${response.status}`);
            
            if (!response.ok) {
                const text = await response.text();
                let errObj = { error: text };
                try {
                    errObj = JSON.parse(text);
                } catch (e) {}
                throw new Error(`HTTP ${response.status}: ${errObj.error || errObj.message || response.statusText}`);
            }
            
            const data = await response.json();
            console.log(`[API] ✅ OK:`, data);
            return data;
            
        } catch (error) {
            lastError = error;
            console.error(`[API] Tentative ${attempt} échouée:`, error.message);
            
            if (attempt < CONFIG.MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 500 * attempt));
            }
        }
    }
    
    console.error(`[API] ❌ ÉCHOUÉ:`, lastError.message);
    throw lastError;
}

/**
 * Vérifier la santé du backend
 */
async function checkBackendHealth() {
    try {
        console.log('[HEALTH] Vérification...');
        const response = await fetch(CONFIG.API_URL + '/api/schools/stats/global');
        const ok = response.ok;
        console.log(`[HEALTH] ${ok ? '✅ OK' : '❌ FAIL'}`);
        return ok;
    } catch (err) {
        console.error('[HEALTH] Erreur:', err.message);
        return false;
    }
}

/**
 * Faire une authentification
 */
async function apiLogin(identifier, password) {
    return apiCall(CONFIG.ENDPOINTS.auth.login, {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
    });
}

/**
 * Déconnexion
 */
function apiLogout() {
    localStorage.removeItem('speakfree_token');
    localStorage.removeItem('speakfree_admin');
    console.log('[AUTH] Logout');
    return true;
}

/**
 * Récupérer les stats globales
 */
async function apiGetStats() {
    return apiCall(CONFIG.ENDPOINTS.schools.stats);
}

// Exporter pour utilisation globale
window.CONFIG = CONFIG;
window.apiCall = apiCall;
window.checkBackendHealth = checkBackendHealth;
window.apiLogin = apiLogin;
window.apiLogout = apiLogout;
window.apiGetStats = apiGetStats;

console.log('[CONFIG] ✅ Chargé');
console.log(`[CONFIG] API_URL = ${CONFIG.API_URL}`);
