// api/server.js - Version CORRIGÉE avec gestion timeout
const express = require('express')
const cors = require('cors')
const path = require('path')
const multer = require('multer')

// Configuration dotenv pour Vercel
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const app = express()

// Configuration multer pour Vercel (mémoire uniquement)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
})

// Middleware avec gestion d'erreurs
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Test de santé AVANT les routes complexes
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        node_version: process.version
    })
})

// Route de debug Node.js COMPLÈTE
app.get('/api/debug-nodejs', (req, res) => {
    try {
        const debug = {
            // Version Node.js
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            
            // Variables d'environnement
            env: {
                NODE_ENV: process.env.NODE_ENV,
                hasSupabaseUrl: !!process.env.SUPABASE_URL,
                hasSupabaseAnon: !!process.env.SUPABASE_ANON_KEY,
                hasSupabaseService: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
                supabaseUrlPreview: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 25) + '...' : 'NOT_FOUND'
            },
            
            // Modules disponibles
            modules: {
                hasSupabaseJs: checkModule('@supabase/supabase-js'),
                hasExpress: checkModule('express'),
                hasCors: checkModule('cors'),
                hasDotenv: checkModule('dotenv')
            },
            
            // Chemins et structure
            paths: {
                currentDir: process.cwd(),
                __dirname: __dirname,
                supabaseConfigExists: checkFile('./supabase-config.js'),
                spatialServiceExists: checkFile('./services/SpatialService.js')
            },
            
            // Mémoire et limites
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            },
            
            timestamp: new Date().toISOString()
        }
        
        res.json({
            success: true,
            nodejs_debug: debug,
            message: 'Diagnostic Node.js complet'
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        })
    }
})

// Test Supabase avec TIMEOUT PROTECTION
app.get('/api/test-db', async (req, res) => {
    // Protection timeout - répondre en max 8 secondes
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                error: 'Timeout - Requête trop lente',
                timeout: '8 secondes dépassées'
            })
        }
    }, 8000)

    try {
        console.log('🔧 Test connexion Supabase...')
        
        // Vérifier que le module existe
        let supabase
        try {
            const supabaseConfig = require('./supabase-config')
            supabase = supabaseConfig.supabase
        } catch (requireError) {
            clearTimeout(timeoutId)
            console.error('❌ Erreur require supabase-config:', requireError)
            return res.status(500).json({
                success: false,
                error: 'Impossible de charger supabase-config.js',
                details: requireError.message
            })
        }
        
        // Test de connexion avec timeout court
        const { data, error } = await supabase
            .from('regions')
            .select('nom_region')
            .limit(1)
            .abortSignal(AbortSignal.timeout(5000)) // 5 secondes max

        clearTimeout(timeoutId)

        if (error) {
            console.error('❌ Erreur requête Supabase:', error)
            throw error
        }

        console.log('✅ Test Supabase réussi')
        if (!res.headersSent) {
            res.json({ 
                success: true, 
                message: 'Connexion Supabase OK',
                sample: data[0] || null,
                node_version: process.version
            })
        }
    } catch (error) {
        clearTimeout(timeoutId)
        console.error('❌ Erreur test-db:', error)
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        }
    }
})

// Routes API avec gestion d'erreur
try {
    app.use('/api/auth', require('./routes/auth'))
    app.use('/api/parcelles', require('./routes/parcelles'))
    app.use('/api/payment', require('./routes/payment'))
    app.use('/api/contact', require('./routes/contact'))
    app.use('/api/spatial', require('./routes/spatial'))
    app.use('/api/csv', require('./routes/csv'))
    app.use('/api/admin', require('./routes/admin'))
} catch (routeError) {
    console.error('❌ Erreur chargement routes:', routeError)
}

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('❌ Erreur serveur:', error)
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
            node_version: process.version
        })
    }
})

// Fonctions utilitaires pour debug
function checkModule(moduleName) {
    try {
        require.resolve(moduleName)
        return true
    } catch (e) {
        return false
    }
}

function checkFile(filePath) {
    try {
        const fs = require('fs')
        const path = require('path')
        return fs.existsSync(path.join(__dirname, filePath))
    } catch (e) {
        return false
    }
}

// Export pour Vercel
module.exports = app

// Démarrage local uniquement
if (require.main === module) {
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
        console.log(`🚀 Serveur GéoFoncier démarré sur le port ${PORT}`)
        console.log(`📍 Node.js version: ${process.version}`)
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
}

// Ajoutez cette route dans api/server.js pour tester directement

// Route de test ULTRA-RAPIDE pour les arrondissements
app.get('/api/test-arrondissements-fast', async (req, res) => {
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                error: 'Timeout test arrondissements'
            })
        }
    }, 8000)

    try {
        console.log('🔧 Test arrondissements rapide...')
        
        const { supabase } = require('./supabase-config')
        
        // Test DIRECT sur la table
        const { data, error } = await supabase
            .from('arrondissements')
            .select('id_arrondissement, nom_arrondissement')
            .limit(5)

        clearTimeout(timeoutId)

        if (error) {
            console.error('❌ Erreur test arrondissements:', error)
            throw error
        }

        console.log('✅ Test arrondissements réussi')
        if (!res.headersSent) {
            res.json({ 
                success: true, 
                message: 'Test arrondissements OK',
                count: data?.length || 0,
                sample: data || [],
                note: 'Version rapide sans géométrie'
            })
        }
    } catch (error) {
        clearTimeout(timeoutId)
        console.error('❌ Erreur test arrondissements:', error)
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error.message
            })
        }
    }
})