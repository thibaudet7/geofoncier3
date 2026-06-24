// api/server.js - VERSION CORRIGÉE ET SÉCURISÉE
const express = require('express')
const cors = require('cors')
const path = require('path')
const multer = require('multer')
const rateLimit = require('express-rate-limit')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 3000

// CORRECTION : Vérifier la configuration Supabase au démarrage
console.log('🔧 Configuration Supabase:')
console.log('- URL:', process.env.SUPABASE_URL ? '✅ Défini' : '❌ Manquant')
console.log('- Service Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Défini' : '❌ Manquant')
console.log('- Anon Key:', process.env.SUPABASE_ANON_KEY ? '✅ Défini' : '❌ Manquant')

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Variables d\'environnement Supabase manquantes ! Vérifiez votre fichier .env')
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET manquant ou trop court (minimum 32 caractères) !')
    console.error('   Ajoutez JWT_SECRET=<votre_secret_de_32_caracteres_minimum> dans .env')
    if (!process.env.VERCEL) process.exit(1)
}

// Configuration multer pour upload de fichiers
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// CORRECTION : Middleware de logging AVANT les autres middlewares
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - ${new Date().toISOString()}`);
    if (req.body && Object.keys(req.body).length > 0 && req.path !== '/api/auth/login') {
        // Ne pas logger les mots de passe
        console.log('📋 Body:', req.body);
    }
    next();
});

// Middleware CORS amélioré
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'https://www.geofoncier.shop', 'https://geofoncier.shop', 'https://geofoncier3.vercel.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Rate limiting global - 200 requetes par minute par IP
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
    standardHeaders: true,
    legacyHeaders: false
})
app.use(globalLimiter)

// Rate limiting strict pour l'authentification - 10 tentatives par 15 minutes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
})

// Rate limiting pour la création de compte - 5 par heure par IP
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Trop de créations de compte. Réessayez dans une heure.' },
    standardHeaders: true,
    legacyHeaders: false
})

// Middlewares de parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../')))
app.use('/uploads', express.static(path.join(__dirname, '../uploads')))

// Route de santé en PREMIER (pour diagnostics)
app.get('/api/health', (req, res) => {
    console.log('🏥 Health check appelé')
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        config: {
            SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING',
            VERCEL: process.env.VERCEL ? 'YES' : 'NO'
        }
    })
})

// CORRECTION : Chargement sécurisé des routes avec gestion d'erreur
console.log('📁 Chargement des routes API...')

try {
    // Route auth (obligatoire) avec rate limiting strict
    const authRoutes = require('./routes/auth')
    if (authRoutes && typeof authRoutes === 'function') {
        app.use('/api/auth/login', authLimiter)
        app.use('/api/auth/register', registerLimiter)
        app.use('/api/auth', authRoutes)
        console.log('✅ Routes /api/auth chargées (avec rate limiting)')
    } else {
        console.error('❌ Erreur: ./routes/auth ne retourne pas un router valide')
        console.log('Type reçu:', typeof authRoutes)
    }
} catch (error) {
    console.error('❌ Impossible de charger ./routes/auth:', error.message)
    console.log('📝 Créez le fichier api/routes/auth.js avec un router Express valide')
}

try {
    // Route parcelles (obligatoire)
    const parcelleRoutes = require('./routes/parcelles')
    if (parcelleRoutes && typeof parcelleRoutes === 'function') {
        app.use('/api/parcelles', parcelleRoutes)
        console.log('✅ Routes /api/parcelles chargées')
    } else {
        console.error('❌ Erreur: ./routes/parcelles ne retourne pas un router valide')
    }
} catch (error) {
    console.error('❌ Impossible de charger ./routes/parcelles:', error.message)
}

try {
    // Route spatial (importante)
    const spatialRoutes = require('./routes/spatial')
    if (spatialRoutes && typeof spatialRoutes === 'function') {
        app.use('/api/spatial', spatialRoutes)
        console.log('✅ Routes /api/spatial chargées')
    } else {
        console.error('❌ Erreur: ./routes/spatial ne retourne pas un router valide')
    }
} catch (error) {
    console.error('❌ Impossible de charger ./routes/spatial:', error.message)
    console.log('📝 Créez api/routes/spatial.js si nécessaire')
}

// Routes optionnelles (ne pas planter le serveur si elles n'existent pas)
const optionalRoutes = [
    { path: './routes/payment', mount: '/api/payment', name: 'payment' },
    { path: './routes/contact', mount: '/api/contact', name: 'contact' },
    { path: './routes/csv', mount: '/api/csv', name: 'csv' },
    { path: './routes/admin', mount: '/api/admin', name: 'admin' }
]

optionalRoutes.forEach(({ path, mount, name }) => {
    try {
        const routes = require(path)
        if (routes && typeof routes === 'function') {
            app.use(mount, routes)
            console.log(`✅ Routes ${mount} chargées`)
        } else {
            console.warn(`⚠️ ${path} existe mais ne retourne pas un router valide`)
        }
    } catch (error) {
        console.warn(`⚠️ Route optionnelle ${name} non disponible:`, error.message)
    }
})

// Route spéciale pour admin.html
app.get('/admin.html', (req, res) => {
    const filePath = path.join(__dirname, '../admin.html');
    console.log("📊 Serving admin:", filePath);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('❌ Erreur serving admin.html:', err)
            res.status(404).send('admin.html non trouvé')
        }
    });
});

// CORRECTION : Routes 404 API avant le fallback SPA
app.use('/api/*', (req, res) => {
    console.log(`❌ Route API non trouvée: ${req.originalUrl}`)
    res.status(404).json({
        success: false,
        error: `Route API non trouvée: ${req.originalUrl}`,
        availableRoutes: [
            '/api/health',
            '/api/auth/register',
            '/api/auth/login',
            '/api/auth/verify',
            '/api/parcelles',
            '/api/spatial/arrondissements'
        ]
    })
})

// Servir index.html pour toutes les autres routes (SPA fallback)
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../index.html')
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('❌ Erreur serving index.html:', err)
            res.status(500).send('Erreur serveur')
        }
    })
})

// CORRECTION : Gestionnaire d'erreurs global amélioré
app.use((error, req, res, next) => {
    console.error('❌ Erreur serveur globale:', error)
    
    // Erreur Multer
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Fichier trop volumineux (max 10MB)'
            })
        }
    }
    
    // Erreur de parsing JSON
    if (error.type === 'entity.parse.failed') {
        return res.status(400).json({
            success: false,
            error: 'Format JSON invalide'
        })
    }
    
    // Erreur générique
    res.status(500).json({ 
        success: false,
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
    })
})

// Démarrage du serveur (uniquement hors Vercel)
if (!process.env.VERCEL) {
const server = app.listen(PORT, () => {
    console.log('')
    console.log('🚀 =====================================')
    console.log(`🚀 Serveur GéoFoncier démarré avec succès`)
    console.log(`📍 URL: http://localhost:${PORT}`)
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
    console.log('📋 Routes API disponibles:')
    console.log('   - GET  /api/health')
    console.log('   - POST /api/auth/register')
    console.log('   - POST /api/auth/login')
    console.log('   - GET  /api/auth/verify')
    console.log('   - POST /api/parcelles')
    console.log('   - GET  /api/parcelles')
    console.log('   - GET  /api/spatial/arrondissements')
    console.log('🚀 =====================================')
    console.log('')
})

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...')
    server.close(() => {
        console.log('✅ Serveur arrêté proprement')
        process.exit(0)
    })
})

process.on('SIGINT', () => {
    console.log('\n🛑 Arrêt du serveur (Ctrl+C)...')
    server.close(() => {
        console.log('✅ Serveur arrêté proprement')
        process.exit(0)
    })
})
} // fin if (!process.env.VERCEL)

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('❌ Erreur non capturée:', error)
    if (!process.env.VERCEL) process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée non gérée:', reason)
    console.log('À:', promise)
})

module.exports = app