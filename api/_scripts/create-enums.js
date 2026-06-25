// Script pour créer les enums manquants via Supabase
const { supabase } = require('./supabase-config');
const fs = require('fs');
const path = require('path');

async function createEnums() {
    console.log('🔧 Création des enums manquants...');
    
    try {
        // Lire le script SQL
        const sqlScript = fs.readFileSync(path.join(__dirname, '../create-enums.sql'), 'utf8');
        
        // Extraire chaque CREATE TYPE individuellement
        const enumStatements = sqlScript
            .split('\n')
            .filter(line => line.trim().startsWith('CREATE TYPE'))
            .map(line => {
                const match = line.match(/CREATE TYPE public\.(\w+) AS ENUM/);
                return match ? match[1] : null;
            })
            .filter(Boolean);
            
        console.log('📋 Enums à créer:', enumStatements);
        
        // Essayer de créer chaque enum individuellement
        const enumDefinitions = {
            activite_type: ['agriculture', 'habitation', 'commerce', 'industrie', 'mixte', 'autre'],
            contact_status: ['pending', 'accepted', 'rejected', 'completed'],
            subscription_type: ['proprietaire', 'client', 'premium'],
            subscription_status: ['pending', 'active', 'expired', 'cancelled'],
            transaction_status: ['pending', 'completed', 'failed', 'refunded'],
            user_type: ['client', 'proprietaire', 'admin'],
            piece_type: ['CNI', 'passeport', 'permis_conduire', 'autre']
        };
        
        for (const [enumName, values] of Object.entries(enumDefinitions)) {
            try {
                console.log(`\n🔧 Création de l'enum ${enumName}...`);
                
                const enumValues = values.map(v => `'${v}'`).join(', ');
                const createSQL = `CREATE TYPE public.${enumName} AS ENUM (${enumValues});`;
                
                console.log('SQL:', createSQL);
                
                // Supabase ne permet pas d'exécuter du DDL via l'API REST
                // Nous devons utiliser une fonction RPC ou le faire manuellement
                console.log('⚠️  Supabase ne permet pas de créer des types via l\'API REST');
                console.log('📋 Veuillez exécuter ce SQL manuellement dans l\'éditeur SQL Supabase:');
                console.log(createSQL);
                
            } catch (error) {
                console.error(`❌ Erreur création ${enumName}:`, error.message);
            }
        }
        
        console.log('\n📋 INSTRUCTIONS:');
        console.log('1. Ouvrez l\'éditeur SQL dans votre dashboard Supabase');
        console.log('2. Copiez et exécutez le contenu du fichier create-enums.sql');
        console.log('3. Relancez le test d\'insertion de parcelle');
        
        // Test si les enums existent déjà
        console.log('\n🔍 Test si les enums existent...');
        await testEnumExistence();
        
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

async function testEnumExistence() {
    try {
        // Tester avec une valeur valide d'activite_type
        const testData = {
            matricule: `TEST_ENUM_${Date.now()}`,
            proprietaire_id: '00000000-0000-0000-0000-000000000000',
            geom: 'POLYGON((11.5 3.8, 11.6 3.8, 11.6 3.9, 11.5 3.9, 11.5 3.8))',
            is_terrain_titre: false,
            date_mise_en_valeur: '2024-01-01',
            quartier_village: 'Test Village',
            activite: 'agriculture',
            description_activite: 'Test agriculture',
            prix_m2: 1000,
            nom_proprietaire: 'Test Proprietaire',
            telephone_proprietaire: '+237600000000'
        };
        
        const { data: result, error: insertError } = await supabase
            .from('parcelles')
            .insert([testData])
            .select();
            
        if (!insertError && result && result.length > 0) {
            console.log('✅ Enum activite_type existe et fonctionne !');
            
            // Nettoyer
            await supabase
                .from('parcelles')
                .delete()
                .eq('id', result[0].id);
                
            return true;
        } else {
            console.log('❌ Enum activite_type n\'existe pas encore');
            console.log('Erreur:', insertError?.message);
            return false;
        }
        
    } catch (error) {
        console.log('❌ Exception test enum:', error.message);
        return false;
    }
}

if (require.main === module) {
    createEnums();
}

module.exports = { createEnums, testEnumExistence };