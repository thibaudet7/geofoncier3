// api/server.js - Version optimisée pour Vercel
const express = require('express')
const cors = require('cors')
const path = require('path')
const multer = require('multer')
require('dotenv').config()

const app = express()

// Configuration multer pour upload de fichiers (en mémoire pour Vercel)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Servir les fichiers statiques (pour développement local uniquement)
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, '../')))
}

// Routes API
app.use('/api/auth', require('./routes/auth'))
app.use('/api/parcelles', require('./routes/parcelles'))
app.use('/api/payment', require('./routes/payment'))
app.use('/api/contact', require('./routes/contact'))
app.use('/api/spatial', require('./routes/spatial'))
app.use('/api/csv', require('./routes/csv'))
app.use('/api/admin', require('./routes/admin'))

// Route de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    })
})

// Route de test pour vérifier la connexion Supabase
app.get('/api/test-db', async (req, res) => {
    try {
        const { supabase } = require('./supabase-config')
        const { data, error } = await supabase
            .from('regions')
            .select('nom_region')
            .limit(1)

        if (error) throw error

        res.json({ 
            success: true, 
            message: 'Connexion Supabase OK',
            sample: data[0] || null
        })
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        })
    }
})

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('Erreur serveur:', error)
    res.status(500).json({ 
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
})

// Pour Vercel, exporter l'app au lieu de démarrer un serveur
if (process.env.NODE_ENV === 'production') {
    module.exports = app
} else {
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
        console.log(`🚀 Serveur GéoFoncier démarré sur le port ${PORT}`)
        console.log(`📍 URL: http://localhost:${PORT}`)
        console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)
    })
}