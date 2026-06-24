// Script de debug pour tester l'insertion de parcelles
const { supabase } = require('./supabase-config');

async function debugParcelle() {
    console.log('🔍 Debug insertion parcelle...');
    
    try {
        // 1. Test connexion basique
        console.log('\n1. Test connexion Supabase...');
        const { data: testData, error: testError } = await supabase
            .from('parcelles')
            .select('*', { count: 'exact', head: true });
        
        if (testError) {
            console.error('❌ Erreur connexion:', testError);
            return;
        }
        console.log('✅ Connexion OK');
        
        // 2. Vérifier la structure de la table
        console.log('\n2. Vérification structure table...');
        const { data: existingParcelles, error: selectError } = await supabase
            .from('parcelles')
            .select('*')
            .limit(1);
            
        if (selectError) {
            console.error('❌ Erreur select:', selectError);
        } else {
            console.log('✅ Table accessible, colonnes disponibles');
        }
        
        // 3. Test insertion simple
        console.log('\n3. Test insertion simple...');
        const testInsertData = {
            matricule: 'TEST_' + Date.now(),
            proprietaire_id: '00000000-0000-0000-0000-000000000000', // UUID test
            geom: 'POLYGON((11.5 3.8, 11.6 3.8, 11.6 3.9, 11.5 3.9, 11.5 3.8))',
            is_terrain_titre: false,
            date_mise_en_valeur: '2024-01-01',
            quartier_village: 'Test Village',
            activite: 'agriculture',
            description_activite: 'Test agriculture',
            prix_m2: 1000,
            nom_proprietaire: 'Test Proprietaire',
            telephone_proprietaire: '+237600000000',
            has_acte_foncier: false,
            acte_foncier_verified: false,
            documents_complete: false
        };
        
        console.log('📋 Données à insérer:', {
            matricule: testInsertData.matricule,
            proprietaire_id: testInsertData.proprietaire_id,
            geom: testInsertData.geom
        });
        
        const { data: insertedData, error: insertError } = await supabase
            .from('parcelles')
            .insert([testInsertData])
            .select();
            
        if (insertError) {
            console.error('❌ Erreur insertion:', insertError);
            console.error('Détails:', JSON.stringify(insertError, null, 2));
        } else {
            console.log('✅ Insertion réussie!');
            console.log('📋 Parcelle créée:', insertedData[0]);
            
            // Nettoyer le test
            await supabase
                .from('parcelles')
                .delete()
                .eq('id', insertedData[0].id);
            console.log('🧹 Test nettoyé');
        }
        
    } catch (error) {
        console.error('❌ Exception:', error);
    }
}

debugParcelle();