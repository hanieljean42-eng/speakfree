// test-all.js - Script de test complet pour SpeakFree
// Exécuter: node test-all.js

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const tests = [
    // Pages HTML
    { name: 'Page Accueil', url: '/', expect: 200 },
    { name: 'Page Login', url: '/login.html', expect: 200 },
    { name: 'Page Chat IA', url: '/chat-ia.html', expect: 200 },
    { name: 'Page Report', url: '/report.html', expect: 200 },
    { name: 'Page Discussion', url: '/discussion.html', expect: 200 },
    { name: 'Page Admin', url: '/admin.html', expect: 200 },
    { name: 'Page Super Admin', url: '/super-admin.html', expect: 200 },
    { name: 'Page Register School', url: '/register-school.html', expect: 200 },
    { name: 'Page Guide', url: '/guide.html', expect: 200 },
    { name: 'Page About', url: '/about.html', expect: 200 },
    { name: 'Page Terms', url: '/terms.html', expect: 200 },
    { name: 'Page Schools', url: '/schools.html', expect: 200 },
    { name: 'Page Config JS', url: '/config.js', expect: 200 },
    
    // API Routes
    { name: 'API Health', url: '/api/health', expect: 200 },
    { name: 'API Stats Global', url: '/api/schools/stats/global', expect: 200 },
    { name: 'API Schools List', url: '/api/schools', expect: 200 },
    { name: 'API Super Admin Stats', url: '/api/super-admin/stats', expect: 200 },
    { name: 'API Schools Pending', url: '/api/super-admin/schools/pending', expect: 200 },
    { name: 'API Schools Active', url: '/api/super-admin/schools/active', expect: 200 },
];

async function testUrl(test) {
    return new Promise((resolve) => {
        const url = new URL(test.url, BASE_URL);
        
        http.get(url.href, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const success = res.statusCode === test.expect;
                resolve({
                    ...test,
                    status: res.statusCode,
                    success,
                    size: data.length
                });
            });
        }).on('error', (err) => {
            resolve({
                ...test,
                status: 'ERROR',
                success: false,
                error: err.message
            });
        });
    });
}

async function runTests() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║         🧪 TEST COMPLET DE SPEAKFREE                             ║');
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        const result = await testUrl(test);
        
        if (result.success) {
            console.log(`  ✅ ${result.name.padEnd(25)} → ${result.status} (${result.size} bytes)`);
            passed++;
        } else {
            console.log(`  ❌ ${result.name.padEnd(25)} → ${result.status} ${result.error || ''}`);
            failed++;
        }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log(`  📊 RÉSULTATS: ${passed} réussis, ${failed} échoués sur ${tests.length} tests`);
    console.log('═══════════════════════════════════════════════════════════════════');
    
    if (failed === 0) {
        console.log('');
        console.log('  🎉 TOUS LES TESTS SONT PASSÉS ! Le site est prêt pour le déploiement.');
        console.log('');
    } else {
        console.log('');
        console.log('  ⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.');
        console.log('');
    }
    
    // Test de login
    console.log('');
    console.log('🔐 TEST DE CONNEXION ADMIN...');
    
    const loginData = JSON.stringify({
        identifier: 'jeanhaniel0232@gmail.com',
        password: 'Test1234'
    });
    
    const loginOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': loginData.length
        }
    };
    
    const loginReq = http.request(loginOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.success && result.token) {
                    console.log(`  ✅ Connexion réussie pour: ${result.admin.email}`);
                    console.log(`     École: ${result.admin.schoolName}`);
                    console.log(`     Token généré: ${result.token.substring(0, 20)}...`);
                } else {
                    console.log(`  ❌ Échec connexion: ${result.error || 'Erreur inconnue'}`);
                }
            } catch (e) {
                console.log(`  ❌ Erreur parsing réponse: ${e.message}`);
            }
            
            // Test création session chat IA
            console.log('');
            console.log('🤖 TEST CHAT IA HANIEL...');
            
            const chatData = JSON.stringify({});
            const chatOptions = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/ai-chat/create-session',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': chatData.length
                }
            };
            
            const chatReq = http.request(chatOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        if (result.success && result.sessionCode) {
                            console.log(`  ✅ Session créée: ${result.sessionCode}`);
                            console.log(`     Message: ${result.message.substring(0, 50)}...`);
                        } else {
                            console.log(`  ❌ Échec création session: ${result.error || 'Erreur'}`);
                        }
                    } catch (e) {
                        console.log(`  ❌ Erreur parsing: ${e.message}`);
                    }
                    
                    console.log('');
                    console.log('═══════════════════════════════════════════════════════════════════');
                    console.log('  🏁 TESTS TERMINÉS');
                    console.log('═══════════════════════════════════════════════════════════════════');
                    console.log('');
                });
            });
            
            chatReq.write(chatData);
            chatReq.end();
        });
    });
    
    loginReq.write(loginData);
    loginReq.end();
}

runTests();
