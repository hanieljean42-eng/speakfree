// config.js - Configuration centralisée de l'API
// Utilisé par tous les fichiers frontend

const CONFIG = {
    // URL de base de l'API
    API_URL: window.location.hostname === 'localhost' 
        ? 'http://localhost:3000'
        : (window.location.protocol + '//' + window.location.host),
    
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
    
    const defaultOptions = {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeout: CONFIG.TIMEOUT
    };

    // Ajouter le token d'authentification s'il existe
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    // Fusionner avec les options fournies
    const fetchOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };

    // Retry logic
    let attempt = 0;
    while (attempt < CONFIG.MAX_RETRIES) {
        try {
            console.log(`[API] ${fetchOptions.method} ${endpoint} (tentative ${attempt + 1}/${CONFIG.MAX_RETRIES})`);
            
            const response = await Promise.race([
                fetch(url, fetchOptions),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), CONFIG.TIMEOUT)
                )
            ]);

            // Vérifier le statut HTTP
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                console.error(`[API ERROR] ${response.status} - ${response.statusText}`, error);
                throw new Error(`${response.status}: ${error.error || response.statusText}`);
            }

            // Parser la réponse
            const data = await response.json();
            console.log(`[API SUCCESS] ${endpoint}`, data);
            return data;

        } catch (error) {
            attempt++;
            console.warn(`[API RETRY] Tentative ${attempt}/${CONFIG.MAX_RETRIES} échouée:`, error.message);
            
            if (attempt < CONFIG.MAX_RETRIES) {
                // Attendre avant de réessayer
                await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
            } else {
                // Dernier essai échoué
                console.error(`[API FAILED] ${endpoint} - Tous les essais échoués`, error);
                throw error;
            }
        }
    }
}

/**
 * Vérifier la connexion au backend
 */
async function checkBackendHealth() {
    try {
        const response = await fetch(CONFIG.API_URL + '/api/schools/stats/global');
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Faire une authentification
 */
async function apiLogin(email, password) {
    return apiCall(CONFIG.ENDPOINTS.auth.login, {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
}

/**
 * Déconnexion
 */
async function apiLogout() {
    localStorage.removeItem('speakfree_token');
    localStorage.removeItem('speakfree_admin');
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
