const { supabase } = require('../api/supabase-config')
const fs = require('fs')
const path = require('path')

async function importGeoData() {
    try {
        console.log('🗺️  Import des données géographiques...')
        
        // Lire le fichier de données géographiques (exemple)
        const geoDataPath = path.join(__dirname, '../data/arrondissements.json')
        
        if (!fs.existsSync(geoDataPath)) {
            console.log('⚠️  Fichier de données géographiques non trouvé')
            console.log('📁 Créer le fichier:', geoDataPath)
            return
        }
        
        const geoData = JSON.parse(fs.readFileSync(geoDataPath, 'utf8'))
        
        // Insérer les arrondissements
        for (const arrond of geoData.arrondissements) {
            const { error } = await supabase
                .from('arrondissements')
                .upsert([arrond], { onConflict: 'id_arrondissement' })
                
            if (error) {
                console.error(`❌ Erreur import ${arrond.nom_arrondissement}:`, error.message)
            } else {
                console.log(`✅ ${arrond.nom_arrondissement} importé`)
            }
        }
        
        console.log('🎉 Import géographique terminé!')
        
    } catch (error) {
        console.error('❌ Erreur import géo:', error)
    }
}

if (require.main === module) {
    importGeoData()
}

module.exports = { importGeoData }