// api/server.js - VERSION VERCEL COMPATIBLE
const express = require('express')
const cors = require('cors')
const path = require('path')
const rateLimit = require('express-rate-limit')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 3000

// CORS
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

// Rate limiting
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { success: false, error: 'Trop de requêtes. Réessayez dans une minute.' },
    standardHeaders: true,
    legacyHeaders: false
})
app.use(globalLimiter)

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
    skipSuccessfulRequests: true
})

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { success: false, error: 'Trop de créations de compte. Réessayez dans une heure.' }
})

// Parsing
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Fichiers statiques (exclure api/ du static serving)
app.use('/public', express.static(path.join(__dirname, '../public')))
app.use(express.static(path.join(__dirname, '../'), {
    index: 'index.html',
    dotfiles: 'ignore'
}))
if (!process.env.VERCEL) {
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
}

// Politique de confidentialité (page statique pour Play Store)
app.get('/politique-confidentialite', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/politique-confidentialite.html'))
})

// Visit tracking (fire-and-forget on page load)
app.use((req, res, next) => {
    if (req.method === 'GET' && (req.path === '/' || req.path === '/index.html')) {
        const { supabase: sb } = require('./supabase-config')
        sb.from('site_visits').insert([{
            visitor_ip: req.headers['x-forwarded-for'] || req.ip,
            user_agent: req.headers['user-agent'],
            path: req.path
        }]).then(() => {}).catch(() => {})
    }
    next()
})

// POST /api/visits/track - explicit visit tracking from frontend
app.post('/api/visits/track', (req, res) => {
    const { supabase: sb } = require('./supabase-config')
    sb.from('site_visits').insert([{
        visitor_ip: req.headers['x-forwarded-for'] || req.ip,
        user_agent: req.headers['user-agent'],
        path: req.body?.path || '/'
    }]).then(() => {}).catch(() => {})
    res.json({ success: true })
})

// Route de diagnostic - doit TOUJOURS fonctionner
app.get('/api/health', (req, res) => {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.2',
        env: {
            SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_KEY: serviceKey ? 'SET' : 'MISSING',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING',
            VERCEL: process.env.VERCEL ? 'YES' : 'NO',
            NODE_VERSION: process.version
        }
    })
})

// Chargement des routes - imports statiques pour le bundler Vercel
const routeErrors = []

function mountRoute(router, mountPath, name) {
    if (router && typeof router === 'function') {
        app.use(mountPath, router)
        console.log(`✅ ${name} chargé`)
    } else {
        routeErrors.push(`${name}: not a valid router (type: ${typeof router})`)
    }
}

try { mountRoute(require('./routes/auth'), '/api/auth', 'auth') }
catch (e) { routeErrors.push(`auth: ${e.message}`); console.error('❌ auth:', e.message) }

try { mountRoute(require('./routes/parcelles'), '/api/parcelles', 'parcelles') }
catch (e) { routeErrors.push(`parcelles: ${e.message}`); console.error('❌ parcelles:', e.message) }

try { mountRoute(require('./routes/spatial'), '/api/spatial', 'spatial') }
catch (e) { routeErrors.push(`spatial: ${e.message}`); console.error('❌ spatial:', e.message) }

try { mountRoute(require('./routes/payment'), '/api/payment', 'payment') }
catch (e) { routeErrors.push(`payment: ${e.message}`); console.error('❌ payment:', e.message) }

try { mountRoute(require('./routes/contact'), '/api/contact', 'contact') }
catch (e) { routeErrors.push(`contact: ${e.message}`); console.error('❌ contact:', e.message) }

try { mountRoute(require('./routes/csv'), '/api/csv', 'csv') }
catch (e) { routeErrors.push(`csv: ${e.message}`); console.error('❌ csv:', e.message) }

try { mountRoute(require('./routes/admin'), '/api/admin', 'admin') }
catch (e) { routeErrors.push(`admin: ${e.message}`); console.error('❌ admin:', e.message) }

try { mountRoute(require('./routes/notifications'), '/api/notifications', 'notifications') }
catch (e) { routeErrors.push(`notifications: ${e.message}`); console.error('❌ notifications:', e.message) }

try { mountRoute(require('./routes/favorites'), '/api/favorites', 'favorites') }
catch (e) { routeErrors.push(`favorites: ${e.message}`); console.error('❌ favorites:', e.message) }

// Route de debug pour voir les erreurs de chargement
app.get('/api/debug', (req, res) => {
    res.json({
        routeErrors,
        routesLoaded: routeErrors.length === 0 ? 'ALL OK' : `${7 - routeErrors.length}/7`,
        loadedAt: new Date().toISOString(),
        cwd: process.cwd(),
        dirname: __dirname
    })
})

// 404 API
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `Route non trouvée: ${req.originalUrl}` })
})

// SPA fallback - servir index.html pour toute route non-API
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'))
})

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('Erreur:', error.message)
    res.status(500).json({ success: false, error: 'Erreur interne du serveur' })
})

// Démarrage serveur (hors Vercel)
if (!process.env.VERCEL) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        console.error('❌ JWT_SECRET manquant ou trop court (minimum 32 caractères)')
        process.exit(1)
    }

    app.listen(PORT, () => {
        console.log(`🚀 Serveur GéoFoncier démarré sur http://localhost:${PORT}`)
    })
}

module.exports = app
