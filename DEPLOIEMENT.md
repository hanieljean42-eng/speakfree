# 🚀 Guide de Déploiement SpeakFree

## Prérequis

1. **Compte GitHub** - Pour héberger le code
2. **Compte Render.com** - Pour le backend (gratuit)
3. **Compte Netlify.com** - Pour le frontend (gratuit)
4. **Base de données MySQL** - PlanetScale, Railway, Aiven, ou autre

---

## ÉTAPE 1: Base de Données MySQL Cloud

### Option A: PlanetScale (Recommandé - Gratuit)
1. Allez sur https://planetscale.com
2. Créez un compte gratuit
3. Créez une nouvelle base de données "speakfree"
4. Cliquez sur "Connect" → "Connect with: Node.js"
5. Copiez les informations de connexion:
   - Host: `aws.connect.psdb.cloud`
   - Username: `xxxxx`
   - Password: `pscale_pw_xxxxx`

### Option B: Railway
1. Allez sur https://railway.app
2. New Project → Provision MySQL
3. Cliquez sur le service MySQL → Variables
4. Copiez MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

### Option C: Aiven (Gratuit 1 mois)
1. https://aiven.io → Créer un service MySQL

---

## ÉTAPE 2: Push du Code sur GitHub

```bash
# Dans le dossier du projet
cd "E:\ECOLE V 5"

# Initialiser Git (si pas déjà fait)
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit - SpeakFree Platform"

# Créer le repo sur GitHub, puis:
git remote add origin https://github.com/VOTRE-USERNAME/speakfree.git
git branch -M main
git push -u origin main
```

---

## ÉTAPE 3: Déploiement Backend sur Render

### 3.1 Créer le Web Service
1. Allez sur https://render.com
2. Connectez-vous avec GitHub
3. Dashboard → **New** → **Web Service**
4. Sélectionnez votre repo `speakfree`
5. Configurez:
   - **Name**: `speakfree-api`
   - **Region**: Frankfurt (EU) ou Oregon (US)
   - **Branch**: main
   - **Root Directory**: (laissez vide)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3.2 Configurer les Variables d'Environnement
Dans l'onglet **Environment**, ajoutez:

| Clé | Valeur |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `MYSQL_HOST` | (votre host MySQL) |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | (votre username) |
| `MYSQL_PASSWORD` | (votre mot de passe) |
| `MYSQL_DATABASE` | `speakfree` |
| `MYSQL_SSL` | `true` |
| `JWT_SECRET` | (cliquez Generate) |
| `ANTHROPIC_API_KEY` | (votre clé API si vous utilisez le chat IA) |

### 3.3 Déployer
1. Cliquez **Create Web Service**
2. Attendez le build (5-10 minutes)
3. Une fois déployé, vous aurez une URL comme:
   `https://speakfree-api.onrender.com`

### 3.4 Tester
Ouvrez: `https://speakfree-api.onrender.com/api/health`
Vous devriez voir: `{"status":"ok","message":"SpeakFree API est en ligne"}`

---

## ÉTAPE 4: Déploiement Frontend sur Netlify

### 4.1 Mettre à jour config.js
**IMPORTANT**: Avant de déployer, modifiez `public/config.js`:

```javascript
// Ligne ~20, remplacez:
return 'https://VOTRE-APP-RENDER.onrender.com';

// Par votre vraie URL Render:
return 'https://speakfree-api.onrender.com';
```

Commitez et pushez:
```bash
git add public/config.js
git commit -m "Update API URL for production"
git push
```

### 4.2 Déployer sur Netlify
1. Allez sur https://netlify.com
2. Connectez-vous avec GitHub
3. **Add new site** → **Import an existing project**
4. Sélectionnez votre repo `speakfree`
5. Configurez:
   - **Branch**: main
   - **Base directory**: `public`
   - **Build command**: (laissez vide)
   - **Publish directory**: `public`

6. Cliquez **Deploy site**

### 4.3 Personnaliser le nom de domaine
1. Site Settings → Domain management
2. Cliquez sur le nom par défaut (ex: `random-name-123.netlify.app`)
3. Changez pour: `speakfree.netlify.app`

---

## ÉTAPE 5: Vérification Finale

1. Ouvrez votre site Netlify: `https://speakfree.netlify.app`
2. Testez:
   - [ ] Page d'accueil charge
   - [ ] Super Admin (code: 200700) fonctionne
   - [ ] Inscription école fonctionne
   - [ ] Connexion admin fonctionne
   - [ ] Signalements fonctionnent

---

## 🔧 Dépannage

### Erreur CORS
Si vous avez des erreurs CORS, vérifiez que l'URL Netlify est bien dans la liste des origines autorisées dans `server.js`.

### Base de données non connectée
Vérifiez les logs sur Render: Dashboard → Logs
Assurez-vous que toutes les variables MySQL sont correctes.

### Render "sleep" après 15 min
Le plan gratuit de Render met le serveur en veille. La première requête peut prendre 30-50 secondes.
Solution: Passez au plan Starter ($7/mois) ou utilisez un service de "ping" gratuit.

---

## 📊 Architecture Finale

```
┌─────────────────────────────────┐
│  speakfree.netlify.app          │
│  (Frontend - HTML/CSS/JS)       │
└───────────────┬─────────────────┘
                │
                │ API Calls (fetch)
                ▼
┌─────────────────────────────────┐
│  speakfree-api.onrender.com     │
│  (Backend - Node.js/Express)    │
└───────────────┬─────────────────┘
                │
                │ MySQL Connection
                ▼
┌─────────────────────────────────┐
│  PlanetScale / Railway / Aiven  │
│  (Base de données MySQL)        │
└─────────────────────────────────┘
```

---

## 💰 Coûts

| Service | Plan Gratuit | Limites |
|---------|--------------|---------|
| Render | ✅ Free | 750h/mois, sleep après 15min |
| Netlify | ✅ Free | 100GB bande passante |
| PlanetScale | ✅ Free | 1 base, 1GB stockage |

**Total: 0€/mois** pour démarrer!

---

Bonne chance pour votre déploiement! 🚀
