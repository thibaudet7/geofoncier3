// api/server.js - VERSION DEBUG ULTIME pour identifier le problème
const express = require('express')
const cors = require('cors')

console.log('🚀 DÉMARRAGE DEBUG ULTIME')

const app = express()

// Middleware basique
app.use(cors({ origin: '*' }))
app.use(express.json())

// ============================================
// ROUTES DE DEBUG PROGRESSIF
// ============================================

// Test 1: Route ultra-simple
app.get('/api/test-simple', (req, res) => {
    console.log('✅ Route test-simple appelée')
    res.json({ 
        success: true, 
        message: 'Route simple fonctionne',
        timestamp: new Date().toISOString()
    })
})

// Test 2: Test de require supabase-config
app.get('/api/test-supabase-require', (req, res) => {
    console.log('🔧 Test require supabase-config...')
    try {
        const supabaseConfig = require('./supabase-config')
        console.log('✅ supabase-config chargé')
        res.json({
            success: true,
            message: 'supabase-config require OK',
            hasSupabase: !!supabaseConfig.supabase
        })
    } catch (error) {
        console.error('❌ Erreur require supabase-config:', error)
        res.status(500).json({
            success: false,
            error: 'Erreur require supabase-config',
            details: error.message,
            stack: error.stack
        })
    }
})

// Test 3: Test connexion Supabase basique
app.get('/api/test-supabase-connect', async (req, res) => {
    console.log('🔧 Test connexion Supabase...')
    try {
        const { supabase } = require('./supabase-config')
        console.log('✅ Module supabase chargé')
        
        // Test de connexion très simple
        const { data, error, status } = await supabase
            .from('regions')
            .select('nom_region')
            .limit(1)
            .single()

        console.log('📊 Réponse Supabase:', { data, error, status })

        if (error) {
            console.error('❌ Erreur Supabase:', error)
            return res.status(500).json({
                success: false,
                error: 'Erreur requête Supabase',
                supabaseError: error,
                status: status
            })
        }

        console.log('✅ Connexion Supabase OK')
        res.json({
            success: true,
            message: 'Connexion Supabase réussie',
            data: data,
            status: status
        })
    } catch (error) {
        console.error('❌ Erreur test connexion:', error)
        res.status(500).json({
            success: false,
            error: 'Exception test connexion',
            details: error.message,
            stack: error.stack
        })
    }
})

// Test 4: Test table arrondissements existence
app.get('/api/test-arrondissements-table', async (req, res) => {
    console.log('🔧 Test existence table arrondissements...')
    try {
        const { supabase } = require('./supabase-config')
        
        // Test 1: Compter les lignes
        const { count, error: countError } = await supabase
            .from('arrondissements')
            .select('*', { count: 'exact', head: true })

        if (countError) {
            console.error('❌ Erreur count arrondissements:', countError)
            return res.status(500).json({
                success: false,
                error: 'Erreur count arrondissements',
                details: countError
            })
        }

        console.log(`📊 Nombre d'arrondissements: ${count}`)

        // Test 2: Récupérer 1 ligne
        const { data, error } = await supabase
            .from('arrondissements')
            .select('id_arrondissement, nom_arrondissement')
            .limit(1)
            .single()

        if (error) {
            console.error('❌ Erreur select arrondissements:', error)
            return res.status(500).json({
                success: false,
                error: 'Erreur select arrondissements',
                details: error
            })
        }

        console.log('✅ Table arrondissements accessible')
        res.json({
            success: true,
            message: 'Table arrondissements OK',
            count: count,
            sample: data
        })
    } catch (error) {
        console.error('❌ Exception test table:', error)
        res.status(500).json({
            success: false,
            error: 'Exception test table',
            details: error.message
        })
    }
})

// Test 5: Route arrondissements MINIMALE
app.get('/api/test-arrondissements-minimal', async (req, res) => {
    console.log('🔧 Test arrondissements minimal...')
    
    // Timeout de sécurité
    const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
            console.log('⏰ TIMEOUT arrondissements minimal')
            res.status(504).json({
                success: false,
                error: 'Timeout arrondissements minimal'
            })
        }
    }, 20000)

    try {
        const { supabase } = require('./supabase-config')
        
        console.log('📡 Requête arrondissements...')
        const startTime = Date.now()
        
        const { data, error } = await supabase
            .from('arrondissements')
            .select('id_arrondissement, nom_arrondissement')
            .order('nom_arrondissement')
            .limit(3)

        const duration = Date.now() - startTime
        console.log(`⏱️ Durée requête: ${duration}ms`)

        clearTimeout(timeoutId)

        if (error) {
            console.error('❌ Erreur requête:', error)
            return res.status(500).json({
                success: false,
                error: 'Erreur requête arrondissements',
                details: error,
                duration: duration
            })
        }

        console.log(`✅ ${data.length} arrondissements récupérés en ${duration}ms`)
        res.json({
            success: true,
            message: 'Arrondissements minimal OK',
            count: data.length,
            data: data,
            duration: duration
        })

    } catch (error) {
        clearTimeout(timeoutId)
        console.error('❌ Exception arrondissements minimal:', error)
        res.status(500).json({
            success: false,
            error: 'Exception arrondissements minimal',
            details: error.message
        })
    }
})

// Test 6: Route arrondissements finale (comme dans l'interface)
app.get('/api/spatial/arrondissements', async (req, res) => {
    console.log('🎯 ROUTE FINALE: /api/spatial/arrondissements')
    
    try {
        // Rediriger vers le test minimal pour commencer
        const { supabase } = require('./supabase-config')
        
        const { data, error } = await supabase
            .from('arrondissements')
            .select('id_arrondissement, nom_arrondissement')
            .limit(5)

        if (error) throw error

        // Format attendu par le frontend
        const arrondissements = data.map(item => ({
            id_arrondissement: item.id_arrondissement,
            nom_arrondissement: item.nom_arrondissement,
            // Données minimales pour test
            coordinates: [[4.05, 9.77], [4.06, 9.77], [4.06, 9.78], [4.05, 9.78], [4.05, 9.77]],
            geom_wkt: 'POLYGON((9.77 4.05, 9.77 4.06, 9.78 4.06, 9.78 4.05, 9.77 4.05))',
            departements: {
                nom_departement: 'Test Dept',
                regions: { nom_region: 'Test Region' }
            }
        }))

        console.log(`✅ Route finale: ${arrondissements.length} arrondissements`)
        res.json({
            success: true,
            arrondissements: arrondissements
        })

    } catch (error) {
        console.error('❌ Erreur route finale:', error)
        res.status(500).json({
            success: false,
            error: error.message,
            arrondissements: []
        })
    }
})

// Gestionnaire d'erreurs
app.use((error, req, res, next) => {
    console.error('💥 ERREUR GLOBALE:', error)
    res.status(500).json({
        error: 'Erreur serveur globale',
        details: error.message
    })
})

// Export pour Vercel
module.exports = app

console.log('🏁 Configuration serveur DEBUG terminée')