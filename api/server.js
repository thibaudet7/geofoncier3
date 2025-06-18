// api/server.js - VERSION NETTOYÉE SANS ROUTES DE DEBUG QUI INTERFÈRENT
const express = require('express')
const cors = require('cors')

console.log('🚀 DÉMARRAGE GéoFoncier - Production')

const app = express()

// Middleware
app.use(cors({ origin: '*' }))
app.use(express.json())

// ============================================
// ROUTES PRINCIPALES - ORDRE IMPORTANT !
// ============================================

// Import des routes (vérifiez que ces fichiers existent)
try {
    const spatialRoutes = require('./routes/spatial')
    const authRoutes = require('./routes/auth')
    const parcellesRoutes = require('./routes/parcelles')
    const paymentRoutes = require('./routes/payment')
    const contactRoutes = require('./routes/contact')
    const csvRoutes = require('./routes/csv')

    // Utilisation des routes dans l'ordre
    app.use('/api/spatial', spatialRoutes)
    app.use('/api/auth', authRoutes)
    app.use('/api/parcelles', parcellesRoutes)
    app.use('/api/payment', paymentRoutes)
    app.use('/api/contact', contactRoutes)
    app.use('/api/csv', csvRoutes)
    
    console.log('✅ Toutes les routes principales chargées')
} catch (error) {
    console.error('❌ Erreur chargement routes:', error.message)
    
    // Routes de fallback si les fichiers de routes n'existent pas
    app.get('/api/spatial/arrondissements', async (req, res) => {
        try {
            const { SpatialService } = require('./services/SpatialService')
            const result = await SpatialService.getArrondissements()
            
            if (result.success) {
                res.json({ arrondissements: result.arrondissements })
            } else {
                res.status(400).json({ error: result.error })
            }
        } catch (error) {
            console.error('Erreur fallback arrondissements:', error)
            res.status(500).json({ error: 'Erreur serveur' })
        }
    })
}

// ============================================
// ROUTES UTILITAIRES (sans interférer)
// ============================================

// Test basique
app.get('/api/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API GéoFoncier opérationnelle',
        timestamp: new Date().toISOString()
    })
})

// Route santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    })
})

// Version
app.get('/api/version', (req, res) => {
    res.json({
        name: 'GéoFoncier API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    })
})

// ============================================
// GESTION DES ERREURS
// ============================================

// 404 pour routes API
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.path
    })
})

// Gestionnaire d'erreurs
app.use((error, req, res, next) => {
    console.error('💥 Erreur:', error)
    res.status(500).json({
        error: 'Erreur serveur',
        message: error.message
    })
})

// Export pour Vercel
module.exports = app

console.log('✅ Serveur configuré')