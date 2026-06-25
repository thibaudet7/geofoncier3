const { supabase } = require('./supabase-config');

async function findValidEnumValues() {
    console.log('🔍 Recherche des valeurs valides pour activite_type...');
    
    // Tester différentes variantes possibles
    const possibleValues = [
        // Français
        'agriculture', 'habitation', 'commerce', 'industrie', 'mixte', 'autre',
        
        // Anglais
        'agricultural', 'residential', 'commercial', 'industrial', 'mixed', 'other',
        
        // Majuscules
        'AGRICULTURE', 'HABITATION', 'COMMERCE', 'INDUSTRIE', 'MIXTE', 'AUTRE',
        'AGRICULTURAL', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED', 'OTHER',
        
        // Variantes
        'agri', 'resi', 'comm', 'indu', 'mix', 'oth',
        'farming', 'housing', 'business', 'factory', 'combined', 'others',
        
        // Avec underscores
        'agriculture_type', 'habitation_type', 'commerce_type',
        
        // Valeurs courtes
        'A', 'H', 'C', 'I', 'M', 'O',
        'AG', 'HA', 'CO', 'IN', 'MI', 'AU',
        
        // Valeurs numériques
        '1', '2', '3', '4', '5', '6',
        
        // Autres possibilités
        'terrain_agricole', 'terrain_habitation', 'terrain_commercial',
        'usage_agricole', 'usage_habitation', 'usage_commercial'
    ];
    
    console.log(`🧪 Test de ${possibleValues.length} valeurs possibles...`);
    
    const validValues = [];
    
    for (let i = 0; i < possibleValues.length; i++) {
        const value = possibleValues[i];
        
        try {
            console.log(`[${i+1}/${possibleValues.length}] Test: "${value}"`);
            
            const testData = {
                matricule: `FIND_${Date.now()}_${i}`,
                proprietaire_id: '00000000-0000-0000-0000-000000000000',
                geom: 'POLYGON((11.5 3.8, 11.6 3.8, 11.6 3.9, 11.5 3.9, 11.5 3.8))',
                is_terrain_titre: false,
                date_mise_en_valeur: '2024-01-01',
                quartier_village: 'Test Village',
                activite: value,
                description_activite: `Test ${value}`,
                prix_m2: 1000,
                nom_proprietaire: 'Test Proprietaire',
                telephone_proprietaire: '+237600000000'
            };
            
            const { data: result, error: insertError } = await supabase
                .from('parcelles')
                .insert([testData])
                .select();
                
            if (!insertError && result && result.length > 0) {
                console.log(`✅ VALEUR VALIDE TROUVÉE: "${value}"`);
                validValues.push(value);
                
                // Nettoyer immédiatement
                await supabase
                    .from('parcelles')
                    .delete()
                    .eq('id', result[0].id);
                    
            } else if (insertError && !insertError.message.includes('activite_type')) {
                // Si l'erreur n'est pas liée à l'enum, c'est peut-être un autre problème
                console.log(`⚠️ Autre erreur pour "${value}":`, insertError.message);
            }
            
        } catch (error) {
            // Ignorer les erreurs d'enum, on cherche juste les valeurs valides
            if (!error.message.includes('activite_type')) {
                console.log(`⚠️ Exception pour "${value}":`, error.message);
            }
        }
        
        // Petite pause pour éviter de surcharger
        if (i % 10 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log('\n📋 RÉSULTATS:');
    if (validValues.length > 0) {
        console.log('✅ Valeurs valides trouvées:', validValues);
    } else {
        console.log('❌ Aucune valeur valide trouvée');
        console.log('💡 L\'enum existe mais avec des valeurs différentes');
        console.log('📋 Vérifiez la capture Supabase pour voir les vraies valeurs');
    }
}

findValidEnumValues().catch(console.error);