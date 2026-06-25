const { supabase } = require('../api/supabase-config')
const fs = require('fs')
const path = require('path')

async function setupDatabase() {
    try {
        console.log('🚀 Configuration de la base de données...')
        
        // Lire et exécuter le schéma SQL
        const schemaPath = path.join(__dirname, '../supabase/schema.sql')
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8')
            console.log('📊 Exécution du schéma...')
            // Note: Supabase ne permet pas d'exécuter du SQL directement via l'API
            // Ce script sert de référence - exécuter manuellement dans l'éditeur SQL
            console.log('⚠️  Veuillez exécuter le schéma manuellement dans l\'éditeur SQL Supabase')
        }
        
        // Vérifier la connexion
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true })
        
        if (error) {
            console.error('❌ Erreur de connexion:', error.message)
        } else {
            console.log('✅ Connexion à la base de données réussie')
            console.log(`📊 Utilisateurs en base: ${data ? data.length : 0}`)
        }
        
        // Créer les données de test
        await createTestData()
        
        console.log('🎉 Configuration terminée!')
        
    } catch (error) {
        console.error('❌ Erreur setup:', error)
    }
}

async function createTestData() {
    try {
        console.log('📝 Création des données de test...')
        
        // Insérer un admin de test
        const { error: adminError } = await supabase
            .from('users')
            .upsert([{
                id: '00000000-0000-0000-0000-000000000001',
                email: 'admin@geofoncier.com',
                nom_complet: 'Administrateur GéoFoncier',
                telephone: '+237677000000',
                type_utilisateur: 'admin',
                type_piece_identite: 'CNI',
                numero_piece_identite: 'ADM001',
                localisation: 'Cameroun',
                is_verified: true
            }], { onConflict: 'email' })

        if (adminError) {
            console.log('Admin existe déjà ou erreur:', adminError.message)
        } else {
            console.log('✅ Admin de test créé')
        }
        
        // Insérer des arrondissements de test
        const { error: arrondError } = await supabase
            .from('arrondissements')
            .upsert([
                {
                    id_arrondissement: 1,
                    nom_arrondissement: 'Douala 1er',
                    id_departement: 1,
                    name: 'Douala I',
                    geom: 'MULTIPOLYGON(((9.70 4.04, 9.75 4.04, 9.75 4.08, 9.70 4.08, 9.70 4.04)))'
                },
                {
                    id_arrondissement: 2,
                    nom_arrondissement: 'Douala 2ème',
                    id_departement: 1,
                    name: 'Douala II',
                    geom: 'MULTIPOLYGON(((9.75 4.04, 9.80 4.04, 9.80 4.08, 9.75 4.08, 9.75 4.04)))'
                }
            ], { onConflict: 'id_arrondissement' })

        if (!arrondError) {
            console.log('✅ Arrondissements de test créés')
        }
        
    } catch (error) {
        console.log('⚠️  Erreur création données test:', error.message)
    }
}

if (require.main === module) {
    setupDatabase()
}

module.exports = { setupDatabase }