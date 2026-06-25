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

// Fichiers statiques (hors Vercel, Vercel les sert via vercel.json)
if (!process.env.VERCEL) {
    app.use(express.static(path.join(__dirname, '../')))
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')))
}

// Route de diagnostic - doit TOUJOURS fonctionner
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.1',
        env: {
            SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
            SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING',
            SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING',
            JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'MISSING',
            VERCEL: process.env.VERCEL ? 'YES' : 'NO',
            NODE_VERSION: process.version
        }
    })
})

// Chargement des routes avec protection totale
const routeErrors = []

function loadRoute(routePath, mountPath, name, limiterMiddleware) {
    try {
        const router = require(routePath)
        if (router && typeof router === 'function') {
            if (limiterMiddleware) {
                app.use(mountPath, limiterMiddleware)
            }
            app.use(mountPath, router)
            console.log(`✅ ${name} chargé`)
        } else {
            routeErrors.push(`${name}: not a valid router`)
        }
    } catch (error) {
        routeErrors.push(`${name}: ${error.message}`)
        console.error(`❌ ${name}:`, error.message)
    }
}

loadRoute('./_routes/auth', '/api/auth', 'auth')
loadRoute('./_routes/parcelles', '/api/parcelles', 'parcelles')
loadRoute('./_routes/spatial', '/api/spatial', 'spatial')
loadRoute('./_routes/payment', '/api/payment', 'payment')
loadRoute('./_routes/contact', '/api/contact', 'contact')
loadRoute('./_routes/csv', '/api/csv', 'csv')
loadRoute('./_routes/admin', '/api/admin', 'admin')

// Route de debug pour voir les erreurs de chargement
app.get('/api/debug', (req, res) => {
    res.json({
        routeErrors,
        loadedAt: new Date().toISOString()
    })
})

// 404 API
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `Route non trouvée: ${req.originalUrl}` })
})

// SPA fallback (hors Vercel - Vercel gère ça via vercel.json)
if (!process.env.VERCEL) {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../index.html'))
    })
}

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
