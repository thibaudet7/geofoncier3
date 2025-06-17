// api/server.js - Version optimisée pour Node.js sur Vercel
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

// Route de debug Node.js (ajoutez le code de l'artifact précédent ici)
app.get('/api/debug-nodejs', (req, res) => {
    // ... code de debug de l'artifact précédent
})

// Test Supabase avec gestion d'erreur améliorée
app.get('/api/test-db', async (req, res) => {
    try {
        console.log('🔧 Test connexion Supabase...')
        
        // Vérifier que le module existe
        let supabase
        try {
            const supabaseConfig = require('./supabase-config')
            supabase = supabaseConfig.supabase
        } catch (requireError) {
            console.error('❌ Erreur require supabase-config:', requireError)
            return res.status(500).json({
                success: false,
                error: 'Impossible de charger supabase-config.js',
                details: requireError.message
            })
        }
        
        // Test de connexion
        const { data, error } = await supabase
            .from('regions')
            .select('nom_region')
            .limit(1)

        if (error) {
            console.error('❌ Erreur requête Supabase:', error)
            throw error
        }

        console.log('✅ Test Supabase réussi')
        res.json({ 
            success: true, 
            message: 'Connexion Supabase OK',
            sample: data[0] || null,
            node_version: process.version
        })
    } catch (error) {
        console.error('❌ Erreur test-db:', error)
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        })
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
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur',
        node_version: process.version
    })
})

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