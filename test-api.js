// Script de test API
const http = require('http');

function testEndpoint(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function runTests() {
    console.log('\n🧪 TEST API ENDPOINTS\n');

    // Test 1: Stats super-admin
    console.log('1️⃣  GET /api/super-admin/stats');
    try {
        const res = await testEndpoint('/api/super-admin/stats');
        console.log(`   Status: ${res.status}`);
        console.log(`   Data:`, res.data);
    } catch (e) {
        console.error(`   ❌ Erreur:`, e.message);
    }

    // Test 2: Écoles en attente
    console.log('\n2️⃣  GET /api/super-admin/schools/pending');
    try {
        const res = await testEndpoint('/api/super-admin/schools/pending');
        console.log(`   Status: ${res.status}`);
        console.log(`   Data:`, res.data);
    } catch (e) {
        console.error(`   ❌ Erreur:`, e.message);
    }

    // Test 3: Écoles actives
    console.log('\n3️⃣  GET /api/super-admin/schools/active');
    try {
        const res = await testEndpoint('/api/super-admin/schools/active');
        console.log(`   Status: ${res.status}`);
        console.log(`   Data:`, res.data);
    } catch (e) {
        console.error(`   ❌ Erreur:`, e.message);
    }

    console.log('\n✅ Tests terminés\n');
    process.exit(0);
}

runTests().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
});
