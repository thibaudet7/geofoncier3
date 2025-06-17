const { ParcelleService } = require('./ParcelleService')
const csv = require('csv-parser')
const fs = require('fs')

class CSVImportService {
    
    static async importParcelles(filePath, proprietaireId) {
        try {
            const results = []
            const errors = []
            const csvData = []

            // Lire le fichier CSV
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => {
                        csvData.push(row)
                    })
                    .on('end', resolve)
                    .on('error', reject)
            })

            // Traiter chaque ligne
            for (const row of csvData) {
                try {
                    // Valider les données requises
                    if (!row.matricule || !row.longitude || !row.latitude) {
                        errors.push(`Ligne ignorée - données manquantes: ${JSON.stringify(row)}`)
                        continue
                    }

                    // Créer un polygone simple (point étendu en petit carré)
                    const size = 0.0001 // ~10m
                    const lng = parseFloat(row.longitude)
                    const lat = parseFloat(row.latitude)
                    
                    const coordinates = [
                        [lat, lng],
                        [lat, lng + size],
                        [lat + size, lng + size],
                        [lat + size, lng],
                        [lat, lng] // Fermer le polygone
                    ]

                    const parcelleData = {
                        matricule: row.matricule,
                        proprietaire_id: proprietaireId,
                        coordinates: coordinates,
                        is_terrain_titre: row.is_terrain_titre === 'true' || row.statut === 'titre',
                        date_delivrance: row.date_delivrance || null,
                        date_mise_en_valeur: row.date_mise_en_valeur || new Date().toISOString().split('T')[0],
                        quartier_village: row.quartier_village || row.quartier || 'Non spécifié',
                        activite: row.activite || 'propriete_privee',
                        description_activite: row.description_activite || row.description || 'Importé depuis CSV',
                        prix_m2: parseFloat(row.prix_m2) || 0,
                        nom_proprietaire: row.nom_proprietaire || 'Non spécifié',
                        telephone_proprietaire: row.telephone_proprietaire || ''
                    }

                    const result = await ParcelleService.createParcelle(parcelleData)
                    
                    if (result.success) {
                        results.push(result.parcelle)
                    } else {
                        errors.push(`Erreur pour ${row.matricule}: ${result.error}`)
                    }
                } catch (error) {
                    errors.push(`Erreur ligne ${JSON.stringify(row)}: ${error.message}`)
                }
            }

            // Nettoyer le fichier temporaire
            fs.unlinkSync(filePath)

            return { 
                success: true, 
                imported: results.length,
                errors: errors,
                details: results
            }
        } catch (error) {
            console.error('Erreur import CSV:', error)
            return { success: false, error: error.message }
        }
    }

    static validateCSVHeaders(headers) {
        const requiredHeaders = ['matricule', 'longitude', 'latitude']
        const missingHeaders = requiredHeaders.filter(header => 
            !headers.includes(header.toLowerCase())
        )
        
        return {
            valid: missingHeaders.length === 0,
            missingHeaders
        }
    }

    static generateSampleCSV() {
        return `matricule,longitude,latitude,quartier_village,activite,description_activite,prix_m2,is_terrain_titre
TF-001234,9.7679,4.0511,Bonanjo,vente_terrain,Terrain résidentiel avec vue,15000,true
NT-0012345,9.7690,4.0520,Akwa,location_construction,Terrain pour construction,8000,false
TF-001235,9.7681,4.0513,Bonanjo,propriete_privee,Résidence privée familiale,0,true`
    }
}

module.exports = { CSVImportService }