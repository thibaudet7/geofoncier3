// api/test-connexion.js - Test spécifique pour villagemarte@gmail.com
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

console.log('🔍 === TEST CONNEXION GÉOFONCIER ===')
console.log('Email de test: villagemarte@gmail.com')
console.log('')

async function testComplete() {
    try {
        // 1. Test des variables d'environnement
        console.log('1️⃣ VARIABLES D\'ENVIRONNEMENT:')
        console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ OK' : '❌ MANQUANT')
        console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ OK' : '❌ MANQUANT')
        console.log('   SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ OK' : '❌ MANQUANT')
        console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ OK' : '❌ MANQUANT')
        console.log('')
        
        // 2. Test import des modules
        console.log('2️⃣ IMPORT DES MODULES:')
        
        try {
            const config = require('./supabase-config')
            console.log('   supabase-config.js: ✅ OK')
            console.log('   Client admin:', config.supabase ? '✅ OK' : '❌ Échec')
            console.log('   Client anonyme:', config.supabaseAnon ? '✅ OK' : '❌ Échec')
        } catch (configErr) {
            console.log('   supabase-config.js: ❌ ERREUR -', configErr.message)
            return
        }
        
        try {
            const { AuthService } = require('./services/AuthService')
            console.log('   AuthService: ✅ OK')
        } catch (authErr) {
            console.log('   AuthService: ❌ ERREUR -', authErr.message)
            return
        }
        console.log('')
        
        // 3. Test connexion Supabase directe
        console.log('3️⃣ TEST CONNEXION SUPABASE:')
        
        const { supabase, supabaseAnon } = require('./supabase-config')
        
        // Test client admin
        try {
            const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
            if (error) {
                console.log('   Client admin: ⚠️ -', error.message)
            } else {
                console.log('   Client admin: ✅ OK - Auth API accessible')
            }
        } catch (err) {
            console.log('   Client admin: ❌ ERREUR -', err.message)
        }
        
        // Test client anonyme
        try {
            const { data, error } = await supabaseAnon.from('users').select('count').limit(1)
            if (error && error.code !== 'PGRST301') { // PGRST301 = RLS, c'est normal
                console.log('   Client anonyme: ⚠️ -', error.message)
            } else {
                console.log('   Client anonyme: ✅ OK')
            }
        } catch (err) {
            console.log('   Client anonyme: ❌ ERREUR -', err.message)
        }
        console.log('')
        
        // 4. Test AuthService avec un email existant
        console.log('4️⃣ TEST AUTHSERVICE:')
        
        const { AuthService } = require('./services/AuthService')
        
        // Test avec des identifiants de test
        console.log('   Test connexion avec villagemarte@gmail.com...')
        
        // Vous devez remplacer le mot de passe par le vrai
        const testPassword = 'test123' // REMPLACEZ PAR LE VRAI MOT DE PASSE
        
        try {
            const result = await AuthService.loginUser('villagemarte@gmail.com', testPassword)
            
            console.log('   Résultat AuthService:')
            console.log('     - Success:', result.success)
            console.log('     - User ID:', result.user?.id)
            console.log('     - User Data:', result.userData?.nom_complet)
            console.log('     - Session:', !!result.session)
            console.log('     - Erreur:', result.error)
            
            if (result.success) {
                console.log('   🎉 CONNEXION RÉUSSIE !')
            } else {
                console.log('   ❌ Connexion échouée:', result.error)
                
                // Suggestions basées sur l'erreur
                if (result.error.includes('Invalid login credentials')) {
                    console.log('   💡 SOLUTION: Vérifiez le mot de passe ou créez le compte')
                } else if (result.error.includes('Email not confirmed')) {
                    console.log('   💡 SOLUTION: Confirmez l\'email dans Supabase Auth')
                }
            }
            
        } catch (authServiceErr) {
            console.log('   ❌ ERREUR AuthService:', authServiceErr.message)
            console.log('   Stack:', authServiceErr.stack.split('\n').slice(0, 3).join('\n'))
        }
        console.log('')
        
        // 5. Test des routes express
        console.log('5️⃣ TEST ROUTE EXPRESS (si serveur démarré):')
        
        try {
            const response = await fetch('http://localhost:3000/api/health')
            if (response.ok) {
                console.log('   Serveur: ✅ ACCESSIBLE')
                
                // Test route auth
                const authResponse = await fetch('http://localhost:3000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: 'villagemarte@gmail.com',
                        password: testPassword
                    })
                })
                
                const authResult = await authResponse.json()
                console.log('   Route /api/auth/login:', authResponse.ok ? '✅ OK' : `❌ ${authResponse.status}`)
                if (!authResponse.ok) {
                    console.log('   Erreur:', authResult.error)
                }
                
            } else {
                console.log('   Serveur: ❌ NON ACCESSIBLE (', response.status, ')')
            }
        } catch (fetchErr) {
            console.log('   Serveur: ❌ NON DÉMARRÉ ou inaccessible')
            console.log('   💡 Démarrez le serveur: cd api && node server.js')
        }
        
    } catch (globalErr) {
        console.error('❌ ERREUR GLOBALE:', globalErr.message)
        console.error('Stack:', globalErr.stack)
    }
    
    console.log('')
    console.log('=== FIN DU TEST ===')
    console.log('')
    console.log('📋 CHECKLIST DE RÉSOLUTION:')
    console.log('1. ✅ Variables .env configurées')
    console.log('2. ✅ Modules importables')  
    console.log('3. ⚠️  Connexion Supabase à vérifier')
    console.log('4. ❓ AuthService à tester avec vrai mot de passe')
    console.log('5. ❓ Serveur Express à démarrer')
    console.log('')
    console.log('🔑 Pour tester la connexion, remplacez testPassword dans ce script')
    console.log('🚀 Puis démarrez le serveur: cd api && node server.js')
}

// Exécuter le test
testComplete().catch(console.error)