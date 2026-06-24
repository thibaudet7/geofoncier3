// api/services/CSVImportService.js - VERSION COMPLÈTE AVEC CONVERSION
const { ParcelleService } = require('./ParcelleService')
const { CoordinateTransformService } = require('./CoordinateTransformService')
const csv = require('csv-parser')
const fs = require('fs')

class CSVImportService {
    
    static async importParcelles(filePath, proprietaireId, options = {}) {
        try {
            const results = []
            const errors = []
            const csvData = []
            
            console.log('📂 Début import CSV:', filePath)
            console.log('👤 Propriétaire:', proprietaireId)
            console.log('⚙️ Options:', options)

            // Détecter le délimiteur du CSV
            const csvContent = fs.readFileSync(filePath, 'utf8')
            const delimiter = this.detectDelimiter(csvContent)
            
            console.log('🔍 Délimiteur détecté:', delimiter)

            // Lire le fichier CSV avec le bon délimiteur
            await new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv({ 
                        separator: delimiter,
                        skipEmptyLines: true,
                        trim: true
                    }))
                    .on('data', (row) => {
                        console.log('📄 Ligne CSV:', row)
                        csvData.push(row)
                    })
                    .on('end', resolve)
                    .on('error', reject)
            })

            console.log(`📊 ${csvData.length} lignes lues du CSV`)

            // Vérifier les en-têtes
            if (csvData.length === 0) {
                throw new Error('Fichier CSV vide')
            }

            const headers = Object.keys(csvData[0]).map(h => h.toLowerCase().trim())
            console.log('📋 En-têtes détectés:', headers)

            const validation = this.validateCSVHeaders(headers)
            if (!validation.valid) {
                throw new Error(`Colonnes manquantes: ${validation.missingHeaders.join(', ')}`)
            }

            // Détecter le système de coordonnées
            const coordinateSystem = options.coordinateSystem || this.detectCoordinateSystem(csvData)
            console.log('🗺️ Système de coordonnées détecté:', coordinateSystem)

            // Traiter chaque ligne
            for (let i = 0; i < csvData.length; i++) {
                const row = csvData[i]
                try {
                    console.log(`⚙️ Traitement ligne ${i + 1}:`, row)

                    // Normaliser les clés (gérer les variations)
                    const normalizedRow = this.normalizeRowKeys(row)

                    // Valider les données requises
                    if (!normalizedRow.matricule || !normalizedRow.longitude || !normalizedRow.latitude) {
                        errors.push(`Ligne ${i + 1} ignorée - données manquantes: ${JSON.stringify(row)}`)
                        continue
                    }

                    // Valider les coordonnées
                    const lng = parseFloat(normalizedRow.longitude)
                    const lat = parseFloat(normalizedRow.latitude)
                    
                    if (isNaN(lng) || isNaN(lat)) {
                        errors.push(`Ligne ${i + 1} - coordonnées invalides: lat=${normalizedRow.latitude}, lng=${normalizedRow.longitude}`)
                        continue
                    }

                    // Transformer les coordonnées si nécessaire
                    let finalLat = lat, finalLng = lng
                    
                    if (coordinateSystem !== 'wgs84') {
                        console.log(`🔄 Transformation coordonnées ligne ${i + 1}:`, [lat, lng])
                        
                        const fromSRID = CoordinateTransformService.getSRIDFromSystemName(coordinateSystem)
                        const transformResult = await CoordinateTransformService.transformCoordinates(
                            [[lat, lng]], 
                            fromSRID, 
                            4326
                        )
                        
                        if (transformResult.success && transformResult.transformedCoordinates.length > 0) {
                            [finalLat, finalLng] = transformResult.transformedCoordinates[0]
                            console.log(`✅ Coordonnées transformées: ${lat},${lng} → ${finalLat},${finalLng}`)
                        } else {
                            errors.push(`Ligne ${i + 1} - erreur transformation: ${transformResult.error}`)
                            continue
                        }
                    }

                    // Valider les coordonnées finales
                    if (finalLat < -90 || finalLat > 90 || finalLng < -180 || finalLng > 180) {
                        errors.push(`Ligne ${i + 1} - coordonnées transformées hors limites: lat=${finalLat}, lng=${finalLng}`)
                        continue
                    }

                    // Créer un polygone simple (point étendu en petit carré)
                    const size = 0.0001 // ~10m
                    
                    const coordinates = [
                        [finalLat, finalLng],
                        [finalLat, finalLng + size],
                        [finalLat + size, finalLng + size],
                        [finalLat + size, finalLng],
                        [finalLat, finalLng] // Fermer le polygone
                    ]

                    const parcelleData = {
                        matricule: normalizedRow.matricule,
                        proprietaire_id: proprietaireId,
                        coordinates: coordinates,
                        statut: this.determineStatut(normalizedRow),
                        is_terrain_titre: this.isTerrainTitre(normalizedRow),
                        date_delivrance: normalizedRow.date_delivrance || null,
                        date_mise_en_valeur: normalizedRow.date_mise_en_valeur || new Date().toISOString().split('T')[0],
                        quartier_village: normalizedRow.quartier_village || normalizedRow.quartier || 'Non spécifié',
                        activite: normalizedRow.activite || 'propriete_privee',
                        description_activite: normalizedRow.description_activite || normalizedRow.description || 'Importé depuis CSV',
                        prix_m2: parseFloat(normalizedRow.prix_m2) || 0,
                        nom_proprietaire: normalizedRow.nom_proprietaire || 'Non spécifié',
                        telephone_proprietaire: normalizedRow.telephone_proprietaire || normalizedRow.telephone || ''
                    }

                    console.log('💾 Création parcelle:', parcelleData.matricule)
                    const result = await ParcelleService.createParcelle(parcelleData)
                    
                    if (result.success) {
                        results.push(result.parcelle)
                        console.log(`✅ Parcelle ${parcelleData.matricule} créée`)
                    } else {
                        errors.push(`Erreur pour ${normalizedRow.matricule}: ${result.error}`)
                        console.error(`❌ Erreur pour ${normalizedRow.matricule}:`, result.error)
                    }
                } catch (error) {
                    errors.push(`Erreur ligne ${i + 1} ${JSON.stringify(row)}: ${error.message}`)
                    console.error(`❌ Erreur ligne ${i + 1}:`, error)
                }
            }

            // Nettoyer le fichier temporaire
            try {
                fs.unlinkSync(filePath)
            } catch (cleanupError) {
                console.warn('⚠️ Erreur nettoyage fichier temp:', cleanupError)
            }

            return { 
                success: true, 
                imported: results.length,
                errors: errors,
                details: results,
                coordinateSystem: coordinateSystem
            }
        } catch (error) {
            console.error('❌ Erreur import CSV:', error)
            
            // Nettoyer le fichier en cas d'erreur
            try {
                fs.unlinkSync(filePath)
            } catch (cleanupError) {
                console.warn('⚠️ Erreur nettoyage fichier temp:', cleanupError)
            }
            
            return { success: false, error: error.message }
        }
    }

    static detectDelimiter(csvContent) {
        const firstLine = csvContent.split('\n')[0]
        
        // Compter les occurrences des délimiteurs possibles
        const commaCount = (firstLine.match(/,/g) || []).length
        const semicolonCount = (firstLine.match(/;/g) || []).length
        const tabCount = (firstLine.match(/\t/g) || []).length
        
        console.log('🔍 Délimiteurs comptés:', { comma: commaCount, semicolon: semicolonCount, tab: tabCount })
        
        // Retourner le délimiteur le plus fréquent
        if (semicolonCount > commaCount && semicolonCount > tabCount) {
            return ';'
        } else if (tabCount > commaCount && tabCount > semicolonCount) {
            return '\t'
        } else {
            return ','
        }
    }

    static detectCoordinateSystem(csvData) {
        // Analyser quelques coordonnées pour détecter le système
        for (const row of csvData.slice(0, 5)) { // Analyser les 5 premières lignes
            const normalizedRow = this.normalizeRowKeys(row)
            const lng = parseFloat(normalizedRow.longitude)
            const lat = parseFloat(normalizedRow.latitude)
            
            if (!isNaN(lng) && !isNaN(lat)) {
                // WGS84 typique pour le Cameroun
                if (lat >= 1 && lat <= 13 && lng >= 8 && lng <= 17) {
                    return 'wgs84'
                }
                
                // UTM Zone 32N typique
                if (lng >= 200000 && lng <= 800000 && lat >= 100000 && lat >= 1500000) {
                    return 'utm32'
                }
                
                // UTM Zone 33N typique
                if (lng >= 200000 && lng <= 800000 && lat >= 100000 && lat >= 1500000) {
                    return 'utm33'
                }
                
                // Douala 1948 (valeurs approximatives)
                if (lng >= 100000 && lng <= 900000 && lat >= 100000 && lat <= 1600000) {
                    return 'douala'
                }
            }
        }
        
        // Par défaut, supposer WGS84
        return 'wgs84'
    }

    static normalizeRowKeys(row) {
        const normalized = {}
        
        for (const [key, value] of Object.entries(row)) {
            const normalizedKey = key.toLowerCase().trim()
            normalized[normalizedKey] = typeof value === 'string' ? value.trim() : value
        }
        
        // Gérer les variations de noms de colonnes
        const keyMappings = {
            'lng': 'longitude',
            'lon': 'longitude',
            'x': 'longitude',
            'east': 'longitude',
            'easting': 'longitude',
            'lat': 'latitude',
            'y': 'latitude',
            'north': 'latitude',
            'northing': 'latitude',
            'quartier': 'quartier_village',
            'village': 'quartier_village',
            'description': 'description_activite',
            'telephone': 'telephone_proprietaire',
            'tel': 'telephone_proprietaire',
            'nom': 'nom_proprietaire',
            'proprietaire': 'nom_proprietaire',
            'prix': 'prix_m2',
            'prix_metre_carre': 'prix_m2'
        }
        
        for (const [oldKey, newKey] of Object.entries(keyMappings)) {
            if (normalized[oldKey] && !normalized[newKey]) {
                normalized[newKey] = normalized[oldKey]
            }
        }
        
        return normalized
    }

    static determineStatut(row) {
        const statut = (row.statut || '').toLowerCase()
        const isTitre = (row.is_terrain_titre || '').toLowerCase()
        
        if (statut === 'titre' || isTitre === 'true' || isTitre === '1') {
            return 'titre'
        } else {
            return 'non_titre'
        }
    }

    static isTerrainTitre(row) {
        return this.determineStatut(row) === 'titre'
    }

    static validateCSVHeaders(headers) {
        const requiredHeaders = ['matricule', 'longitude', 'latitude']
        
        // Gérer les variations de noms
        const headerVariations = {
            'lng': 'longitude',
            'lon': 'longitude', 
            'x': 'longitude',
            'east': 'longitude',
            'easting': 'longitude',
            'lat': 'latitude',
            'y': 'latitude',
            'north': 'latitude',
            'northing': 'latitude'
        }
        
        // Normaliser les en-têtes en tenant compte des variations
        const normalizedHeaders = [...headers]
        for (const [variation, standard] of Object.entries(headerVariations)) {
            if (headers.includes(variation) && !headers.includes(standard)) {
                normalizedHeaders.push(standard)
            }
        }
        
        const missingHeaders = requiredHeaders.filter(header => 
            !normalizedHeaders.includes(header)
        )
        
        return {
            valid: missingHeaders.length === 0,
            missingHeaders
        }
    }

    static generateSampleCSV() {
        return `matricule,longitude,latitude,quartier_village,activite,description_activite,prix_m2,is_terrain_titre,nom_proprietaire,telephone_proprietaire,coordinate_system
TF-001234,9.7679,4.0511,Bonanjo,vente_terrain,Terrain résidentiel avec vue,15000,true,Jean Dupont,+237677123456,wgs84
NT-0012345,9.7690,4.0520,Akwa,location_construction,Terrain pour construction,8000,false,Marie Kamga,+237678234567,wgs84
TF-001235,9.7681,4.0513,Bonanjo,propriete_privee,Résidence privée familiale,0,true,Paul Mbarga,+237679345678,wgs84`
    }

    static generateSampleCSVWithUTM() {
        return `matricule,easting,northing,quartier_village,activite,description_activite,prix_m2,is_terrain_titre,nom_proprietaire,telephone_proprietaire,coordinate_system
TF-001234,567890,445123,Bonanjo,vente_terrain,Terrain résidentiel avec vue,15000,true,Jean Dupont,+237677123456,utm32
NT-0012345,568000,445200,Akwa,location_construction,Terrain pour construction,8000,false,Marie Kamga,+237678234567,utm32
TF-001235,567950,445150,Bonanjo,propriete_privee,Résidence privée familiale,0,true,Paul Mbarga,+237679345678,utm32`
    }
}

module.exports = { CSVImportService }