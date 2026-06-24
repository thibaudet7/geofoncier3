// api/supabase-config.js - VERSION FINALE ROBUSTE
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { createClient } = require('@supabase/supabase-js')

console.log('🔧 === INITIALISATION SUPABASE ===')

// Récupération des variables d'environnement avec fallbacks
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

// CORRECTION : Gérer les deux noms de variables
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('📋 Vérification des variables:')
console.log('- SUPABASE_URL:', supabaseUrl ? `✅ ${supabaseUrl.substring(0, 30)}...` : '❌ MANQUANT')
console.log('- SUPABASE_ANON_KEY:', supabaseAnonKey ? `✅ ${supabaseAnonKey.substring(0, 20)}...` : '❌ MANQUANT')
console.log('- SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Trouvé (SERVICE_KEY)' : '❌ Manquant')
console.log('- SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Trouvé (SERVICE_ROLE_KEY)' : '❌ Manquant')
console.log('- Service Key utilisé:', supabaseServiceKey ? `✅ ${supabaseServiceKey.substring(0, 20)}...` : '❌ AUCUN')

// Validation des variables obligatoires
const missingVars = []
if (!supabaseUrl) missingVars.push('SUPABASE_URL')
if (!supabaseAnonKey) missingVars.push('SUPABASE_ANON_KEY')  
if (!supabaseServiceKey) missingVars.push('SUPABASE_SERVICE_KEY ou SUPABASE_SERVICE_ROLE_KEY')

if (missingVars.length > 0) {
    console.error('❌ === ERREUR CONFIGURATION ===')
    console.error('Variables manquantes:', missingVars.join(', '))
    console.error('📝 Vérifiez votre fichier .env ou les variables Vercel')
    if (!process.env.VERCEL) {
        throw new Error(`Variables d'environnement Supabase manquantes: ${missingVars.join(', ')}`)
    }
    module.exports = { supabase: null, supabaseAnon: null, config: { url: null, hasServiceKey: false, hasAnonKey: false, missingVars } }
    return
}

console.log('✅ Toutes les variables Supabase sont présentes')

// Client avec service role pour les opérations backend (CRUD, admin)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'geofoncier-backend'
        }
    }
})

// Client anonyme pour l'authentification utilisateur (signIn, signUp)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'geofoncier-client'
        }
    }
})

// Test de connexion au démarrage avec gestion d'erreur robuste
async function testConnections() {
    try {
        console.log('🔄 Test des connexions Supabase...')
        
        // Test 1: Client admin
        try {
            const { data: adminTest, error: adminError } = await supabase
                .from('users')
                .select('count(*)')
                .limit(1)
            
            if (adminError) {
                console.log('⚠️ Client admin (possiblement normal si RLS actif):', adminError.message)
                
                // Test alternatif : appel à l'API auth
                const { data: authTest, error: authError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
                if (authError) {
                    console.error('❌ Client admin - Auth API aussi échoue:', authError.message)
                } else {
                    console.log('✅ Client admin - Auth API fonctionnel')
                }
            } else {
                console.log('✅ Client admin - Accès table users OK')
            }
        } catch (adminErr) {
            console.error('❌ Erreur test client admin:', adminErr.message)
        }
        
        // Test 2: Client anonyme
        try {
            // Test simple : vérifier que l'URL et la clé fonctionnent
            const response = await fetch(`${supabaseUrl}/rest/v1/`, {
                headers: {
                    'apikey': supabaseAnonKey,
                    'Authorization': `Bearer ${supabaseAnonKey}`
                }
            })
            
            if (response.ok || response.status === 406) { // 406 = Not Acceptable is OK for root endpoint
                console.log('✅ Client anonyme - API accessible')
            } else {
                console.log('⚠️ Client anonyme - Status:', response.status)
            }
        } catch (anonErr) {
            console.error('❌ Erreur test client anonyme:', anonErr.message)
        }
        
    } catch (err) {
        console.error('❌ Erreur test connexions globale:', err.message)
    }
    
    console.log('🔧 === FIN INITIALISATION SUPABASE ===')
    console.log('')
}

// Tester au démarrage de façon asynchrone pour ne pas bloquer
setImmediate(testConnections)

// Export avec informations de debug
module.exports = { 
    supabase, 
    supabaseAnon,
    // Informations utiles pour debug
    config: {
        url: supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey,
        serviceKeySource: process.env.SUPABASE_SERVICE_KEY ? 'SUPABASE_SERVICE_KEY' : 'SUPABASE_SERVICE_ROLE_KEY'
    }
}

console.log('✅ Module supabase-config chargé avec succès')