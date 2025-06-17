// api/server.js - Version avec route arrondissements DIRECTE
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

// Test de santé
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        node_version: process.version
    })
})

// Test Supabase
app.get('/api/test-db', async (req, res) => {
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                error: 'Timeout - Requête trop lente'
            })
        }
    }, 8000)

    try {
        console.log('🔧 Test connexion Supabase...')
        
        const { supabase } = require('./supabase-config')
        
        const { data, error } = await supabase
            .from('regions')
            .select('nom_region')
            .limit(1)

        clearTimeout(timeoutId)

        if (error) throw error

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
                error: error.message
            })
        }
    }
})

// ============================================
// ROUTE ARRONDISSEMENTS DIRECTE (SOLUTION)
// ============================================
app.get('/api/spatial/arrondissements', async (req, res) => {
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                error: 'Timeout arrondissements',
                arrondissements: []
            })
        }
    }, 25000) // 25 secondes max

    try {
        console.log('🔄 Route arrondissements DIRECTE')
        
        const { supabase } = require('./supabase-config')
        
        // Requête SIMPLE et RAPIDE
        const { data, error } = await supabase
            .from('arrondissements')
            .select(`
                id_arrondissement,
                nom_arrondissement,
                geom,
                id_departement
            `)
            .order('nom_arrondissement')
            .limit(30) // Limite raisonnable

        if (error) {
            console.error('❌ Erreur Supabase arrondissements:', error)
            throw error
        }

        console.log(`✅ ${data?.length || 0} arrondissements récupérés`)

        // Transformation simple
        const processedData = (data || []).map(item => {
            let coordinates = []
            
            // Parsing géométrique simple
            if (item.geom) {
                try {
                    const coords = item.geom.match(/[\d\.-]+/g)
                    if (coords && coords.length >= 6) {
                        for (let i = 0; i < Math.min(coords.length - 1, 40); i += 2) {
                            const lng = parseFloat(coords[i])
                            const lat = parseFloat(coords[i + 1])
                            if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                                coordinates.push([lat, lng])
                            }
                        }
                    }
                } catch (parseError) {
                    console.warn('⚠️ Erreur parsing géométrie:', parseError)
                }
            }

            return {
                id_arrondissement: item.id_arrondissement,
                nom_arrondissement: item.nom_arrondissement,
                geom_wkt: item.geom,
                geom: item.geom,
                coordinates: coordinates,
                // Données minimales pour compatibilité
                id_departement: item.id_departement || 1,
                nom_departement: 'Département Test',
                id_region: 1,
                nom_region: 'Région Test',
                departements: {
                    id_departement: item.id_departement || 1,
                    nom_departement: 'Département Test',
                    regions: {
                        id_region: 1,
                        nom_region: 'Région Test'
                    }
                }
            }
        }).filter(item => item.coordinates && item.coordinates.length >= 3)

        clearTimeout(timeoutId)

        console.log(`📊 ${processedData.length} arrondissements avec géométries valides`)

        if (!res.headersSent) {
            res.json({ 
                success: true, 
                arrondissements: processedData,
                count: processedData.length,
                message: 'Arrondissements chargés depuis route directe'
            })
        }

    } catch (error) {
        clearTimeout(timeoutId)
        console.error('❌ Erreur route arrondissements:', error)
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false, 
                error: error.message,
                arrondissements: []
            })
        }
    }
})

// Route de test simple
app.get('/api/test-arrondissements-fast', async (req, res) => {
    try {
        const { supabase } = require('./supabase-config')
        
        const { data, error } = await supabase
            .from('arrondissements')
            .select('id_arrondissement, nom_arrondissement')
            .limit(5)

        if (error) throw error

        res.json({ 
            success: true, 
            message: 'Test arrondissements OK',
            count: data?.length || 0,
            sample: data || []
        })
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message
        })
    }
})

// Routes API avec gestion d'erreur (OPTIONNELLES maintenant)
try {
    app.use('/api/auth', require('./routes/auth'))
    app.use('/api/parcelles', require('./routes/parcelles'))
    // Note: /api/spatial est maintenant géré directement ci-dessus
} catch (routeError) {
    console.error('⚠️ Certaines routes optionnelles non chargées:', routeError.message)
}

// Gestionnaire d'erreurs global
app.use((error, req, res, next) => {
    console.error('❌ Erreur serveur:', error)
    if (!res.headersSent) {
        res.status(500).json({ 
            error: 'Erreur interne du serveur',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
        })
    }
})

// Export pour Vercel
module.exports = app

// Démarrage local uniquement
if (require.main === module) {
    const PORT = process.env.PORT || 3000
    app.listen(PORT, () => {
        console.log(`🚀 Serveur GéoFoncier démarré sur le port ${PORT}`)
        console.log(`📍 Node.js version: ${process.version}`)
    })
}