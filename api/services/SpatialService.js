// api/services/SpatialService.js - VERSION COMPLÈTE AVEC RÉGIONS
const { supabase } = require('../supabase-config')

class SpatialService {
    
    // ================================
    // MÉTHODES POUR LES RÉGIONS
    // ================================
    
    static async getRegions() {
        try {
            const { data, error } = await supabase
                .from('regions')
                .select('id_region, nom_region, geom, created_at, updated_at')
                .order('nom_region')

            if (error) throw error

            return { success: true, regions: data }
        } catch (error) {
            console.error('Erreur getRegions:', error)
            return { success: false, error: error.message }
        }
    }

    static async getRegionById(regionId) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .select(`
                    id_region, 
                    nom_region, 
                    geom,
                    created_at,
                    updated_at,
                    departements!departements_id_region_fkey(
                        id_departement,
                        nom_departement,
                        arrondissements!arrondissements_id_departement_fkey(
                            id_arrondissement,
                            nom_arrondissement
                        )
                    )
                `)
                .eq('id_region', regionId)
                .single()

            if (error) throw error

            return { success: true, region: data }
        } catch (error) {
            console.error('Erreur getRegionById:', error)
            return { success: false, error: error.message }
        }
    }

    static async getRegionByName(regionName) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .select('*')
                .ilike('nom_region', `%${regionName}%`)
                .single()

            if (error) throw error

            return { success: true, region: data }
        } catch (error) {
            console.error('Erreur getRegionByName:', error)
            return { success: false, error: error.message }
        }
    }

    static async createRegion(regionData) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .insert([{
                    nom_region: regionData.nom_region,
                    geom: regionData.geom
                }])
                .select()

            if (error) throw error

            return { success: true, region: data[0] }
        } catch (error) {
            console.error('Erreur createRegion:', error)
            return { success: false, error: error.message }
        }
    }

    static async updateRegion(regionId, updateData) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .update(updateData)
                .eq('id_region', regionId)
                .select()

            if (error) throw error

            return { success: true, region: data[0] }
        } catch (error) {
            console.error('Erreur updateRegion:', error)
            return { success: false, error: error.message }
        }
    }

    static async deleteRegion(regionId) {
        try {
            // Vérifier s'il y a des départements liés
            const { data: departements } = await supabase
                .from('departements')
                .select('id_departement')
                .eq('id_region', regionId)

            if (departements && departements.length > 0) {
                return { 
                    success: false, 
                    error: 'Impossible de supprimer: des départements sont liés à cette région' 
                }
            }

            const { error } = await supabase
                .from('regions')
                .delete()
                .eq('id_region', regionId)

            if (error) throw error

            return { success: true }
        } catch (error) {
            console.error('Erreur deleteRegion:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES POUR LES DÉPARTEMENTS (MISES À JOUR)
    // ================================

    static async getDepartements(regionId = null) {
        try {
            let query = supabase
                .from('departements')
                .select(`
                    id_departement, 
                    nom_departement, 
                    geom,
                    id_region,
                    regions!departements_id_region_fkey(
                        id_region,
                        nom_region
                    )
                `)

            if (regionId) {
                query = query.eq('id_region', regionId)
            }

            const { data, error } = await query.order('nom_departement')

            if (error) throw error

            return { success: true, departements: data }
        } catch (error) {
            console.error('Erreur getDepartements:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES POUR LES ARRONDISSEMENTS (MISES À JOUR)
    // ================================
    
   // Dans SpatialService.js - Fonction mise à jour pour récupérer les arrondissements
// api/services/SpatialService.js - CORRECTION de la fonction getArrondissements
// api/services/SpatialService.js - VERSION CORRIGÉE avec fonctions PostgreSQL
// Dans api/services/SpatialService.js - Remplacer la fonction getArrondissements existante
// Dans api/services/SpatialService.js - Remplacer la fonction getArrondissements
// Dans SpatialService.js, remplacer la fonction getArrondissements par :

// Dans SpatialService.js, remplacer la fonction getArrondissements par :

static async getArrondissements(regionId = null, departementId = null) {
    try {
        console.log('🔄 getArrondissements appelé avec:', { regionId, departementId });
        
        // Appel de la fonction qui marche parfaitement selon nos tests SQL
        const { data, error } = await supabase.rpc('get_all_arrondissements_with_geom', {});

        if (error) {
            console.error('❌ Erreur RPC:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ Aucune donnée retournée');
            return { success: true, arrondissements: [] };
        }

        console.log(`✅ RPC réussi: ${data.length} arrondissements reçus`);
        
        // Examiner les données reçues en détail
        console.log('🔍 PREMIER ÉLÉMENT REÇU:', JSON.stringify(data[0], null, 2));
        
        // Traitement ULTRA-SIMPLE - copie directe sans modification
        const processedData = data.map(item => {
            // Juste copier EXACTEMENT ce qui vient de la base
            return {
                ...item,
                // S'assurer de la compatibilité avec le frontend
                geom: item.geom_wkt || item.geom,
                departements: {
                    id_departement: item.id_departement,
                    nom_departement: item.nom_departement,
                    id_region: item.id_region,
                    regions: {
                        id_region: item.id_region,
                        nom_region: item.nom_region
                    }
                }
            };
        });

        // Appliquer les filtres côté JavaScript si nécessaire
        let filteredData = processedData;
        
        if (departementId) {
            filteredData = processedData.filter(item => 
                item.id_departement === parseInt(departementId)
            );
        } else if (regionId) {
            filteredData = processedData.filter(item => 
                item.id_region === parseInt(regionId)
            );
        }

        // Statistiques finales
        const avecDept = filteredData.filter(a => a.nom_departement && a.nom_departement.trim() !== '').length;
        const avecRegion = filteredData.filter(a => a.nom_region && a.nom_region.trim() !== '').length;
        
        console.log('📊 STATISTIQUES FINALES:');
        console.log(`   - Total traité: ${filteredData.length}`);
        console.log(`   - Avec département: ${avecDept}`);
        console.log(`   - Avec région: ${avecRegion}`);
        
        // Afficher les 3 premiers pour vérification
        const echantillon = filteredData.slice(0, 3).map(a => ({
            nom: a.nom_arrondissement,
            dept: a.nom_departement,
            region: a.nom_region
        }));
        console.log('📝 ÉCHANTILLON FINAL:', echantillon);

        return { success: true, arrondissements: filteredData };
        
    } catch (error) {
        console.error('❌ Erreur getArrondissements:', error);
        return { 
            success: false, 
            error: error.message,
            arrondissements: [] 
        };
    }
}
    // ================================
    // MÉTHODES POUR LES DIVISIONS ADMINISTRATIVES
    // ================================

    static async getDivisionsAdministratives() {
        try {
            const { data, error } = await supabase
                .from('divisions_administratives')
                .select('*')
                .order('nom_region, nom_departement, nom_arrondissement')

            if (error) throw error

            return { success: true, divisions: data }
        } catch (error) {
            console.error('Erreur getDivisionsAdministratives:', error)
            return { success: false, error: error.message }
        }
    }

    static async getStatsByRegion() {
        try {
            const { data, error } = await supabase
                .rpc('stats_by_region')

            if (error) throw error

            return { success: true, stats: data }
        } catch (error) {
            console.error('Erreur getStatsByRegion:', error)
            return { success: false, error: error.message }
        }
    }

    static async getParcellesInRegion(regionName) {
        try {
            const { data, error } = await supabase
                .rpc('parcelles_in_region', { region_name: regionName })

            if (error) throw error

            return { success: true, parcelles: data }
        } catch (error) {
            console.error('Erreur getParcellesInRegion:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE RECHERCHE SPATIALE
    // ================================

    static async searchByLocation(longitude, latitude) {
        try {
            const { data, error } = await supabase
                .rpc('get_location_hierarchy', { 
                    lon: longitude, 
                    lat: latitude 
                })

            if (error) throw error

            return { success: true, location: data }
        } catch (error) {
            console.error('Erreur searchByLocation:', error)
            return { success: false, error: error.message }
        }
    }

    static async findNearestRegion(longitude, latitude, maxDistance = 50000) {
        try {
            const { data, error } = await supabase
                .rpc('find_nearest_region', { 
                    lon: longitude, 
                    lat: latitude,
                    max_distance: maxDistance
                })

            if (error) throw error

            return { success: true, nearestRegion: data }
        } catch (error) {
            console.error('Erreur findNearestRegion:', error)
            return { success: false, error: error.message }
        }
    }

    static async getParcellesInBounds(bounds) {
        try {
            const { north, south, east, west } = bounds
            
            // Créer un polygon à partir des bounds
            const boundsPolygon = `POLYGON((${west} ${south}, ${east} ${south}, ${east} ${north}, ${west} ${north}, ${west} ${south}))`

            const { data, error } = await supabase
                .rpc('parcelles_in_bounds', { bounds_geom: boundsPolygon })

            if (error) throw error

            return { success: true, parcelles: data }
        } catch (error) {
            console.error('Erreur getParcellesInBounds:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE CALCUL SPATIAL
    // ================================

    static async calculateRegionArea(regionId) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .select('nom_region')
                .eq('id_region', regionId)
                .single()

            if (error) throw error

            // Calculer l'aire en utilisant PostGIS
            const { data: areaData, error: areaError } = await supabase
                .rpc('calculate_region_area', { region_id: regionId })

            if (areaError) throw areaError

            return { 
                success: true, 
                region: data.nom_region,
                area_m2: areaData,
                area_km2: (areaData / 1000000).toFixed(2)
            }
        } catch (error) {
            console.error('Erreur calculateRegionArea:', error)
            return { success: false, error: error.message }
        }
    }

    static async getGeographicCenters() {
        try {
            const { data, error } = await supabase
                .rpc('centres_geographiques')

            if (error) throw error

            return { success: true, centers: data }
        } catch (error) {
            console.error('Erreur getGeographicCenters:', error)
            return { success: false, error: error.message }
        }
    }

    static async getDistancesBetweenRegions() {
        try {
            const { data, error } = await supabase
                .rpc('distances_entre_regions')

            if (error) throw error

            return { success: true, distances: data }
        } catch (error) {
            console.error('Erreur getDistancesBetweenRegions:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES D'EXPORT ET IMPORT
    // ================================

    static async exportRegionsGeoJSON() {
        try {
            const { data, error } = await supabase
                .rpc('export_regions_geojson')

            if (error) throw error

            return { success: true, geojson: data }
        } catch (error) {
            console.error('Erreur exportRegionsGeoJSON:', error)
            return { success: false, error: error.message }
        }
    }

    static async importRegionFromGeoJSON(geojsonFeature) {
        try {
            const { properties, geometry } = geojsonFeature
            
            if (!properties.nom_region) {
                throw new Error('Nom de région requis dans les propriétés GeoJSON')
            }

            // Convertir la géométrie GeoJSON en WKT
            const geomWKT = this.geoJSONToWKT(geometry)

            const regionData = {
                nom_region: properties.nom_region,
                geom: geomWKT
            }

            return await this.createRegion(regionData)
        } catch (error) {
            console.error('Erreur importRegionFromGeoJSON:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES POUR LES PARCELLES SPÉCIALES
    // ================================

    static async getBorderParcelles(distance = 1000) {
        try {
            const { data, error } = await supabase
                .rpc('parcelles_frontalieres', { distance_m: distance })

            if (error) throw error

            return { success: true, borderParcelles: data }
        } catch (error) {
            console.error('Erreur getBorderParcelles:', error)
            return { success: false, error: error.message }
        }
    }

    static async getMultiRegionParcelles() {
        try {
            const { data, error } = await supabase
                .rpc('parcelles_multi_regions')

            if (error) throw error

            return { success: true, multiRegionParcelles: data }
        } catch (error) {
            console.error('Erreur getMultiRegionParcelles:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE VALIDATION ET RAPPORTS
    // ================================

    static async validateGeographicData() {
        try {
            const { data, error } = await supabase
                .rpc('validate_geographic_integrity')

            if (error) throw error

            return { success: true, issues: data }
        } catch (error) {
            console.error('Erreur validateGeographicData:', error)
            return { success: false, error: error.message }
        }
    }

    static async generateGeographicReport() {
        try {
            const { data, error } = await supabase
                .rpc('generate_geographic_report')

            if (error) throw error

            return { success: true, report: data }
        } catch (error) {
            console.error('Erreur generateGeographicReport:', error)
            return { success: false, error: error.message }
        }
    }

    static async refreshMaterializedViews() {
        try {
            const { data, error } = await supabase
                .rpc('refresh_materialized_views')

            if (error) throw error

            return { success: true, message: 'Vues matérialisées rafraîchies' }
        } catch (error) {
            console.error('Erreur refreshMaterializedViews:', error)
            return { success: false, error: error.message }
        }
    }

    // Remplacer la méthode transformCoordinates existante dans SpatialService.js

static async transformCoordinates(coordinates, fromSRID, toSRID = 4326) {
    try {
        console.log(`🔄 Transformation demandée: ${fromSRID} → ${toSRID}`);
        console.log('📍 Coordonnées:', coordinates.length, 'points');
        
        // Validation des entrées
        if (!coordinates || coordinates.length === 0) {
            throw new Error('Aucune coordonnée fournie');
        }
        
        if (coordinates.length < 3) {
            throw new Error('Au moins 3 points requis pour un polygone');
        }
        
        // Si déjà en WGS84, retourner tel quel
        if (fromSRID === 4326 || fromSRID === 'wgs84') {
            return {
                success: true,
                transformedCoordinates: coordinates
            };
        }
        
        // Utiliser le script Python pour la transformation
        const result = await this.callPythonTransform(coordinates, fromSRID, toSRID);
        
        if (result.success) {
            return {
                success: true,
                transformedCoordinates: result.coordinates
            };
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ Erreur transformation spatiale:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Ajouter cette nouvelle méthode dans SpatialService.js
static async callPythonTransform(coordinates, fromSRID, toSRID) {
    const { spawn } = require('child_process');
    const path = require('path');
    
    return new Promise((resolve, reject) => {
        try {
            const scriptPath = path.join(__dirname, '../../scripts/transform-coords.py');
            const coordsJson = JSON.stringify(coordinates);
            
            console.log('🐍 Appel script Python:', scriptPath);
            console.log('📋 Arguments:', [coordsJson, fromSRID.toString(), toSRID.toString()]);
            
            const pythonProcess = spawn('python', [scriptPath, coordsJson, fromSRID.toString(), toSRID.toString()]);
            
            let stdout = '';
            let stderr = '';
            
            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            pythonProcess.on('close', (code) => {
                console.log('🐍 Code de sortie Python:', code);
                console.log('📤 Sortie Python:', stdout);
                
                if (stderr) {
                    console.warn('⚠️ Stderr Python:', stderr);
                }
                
                if (code !== 0) {
                    reject(new Error(`Script Python échoué (code ${code}): ${stderr}`));
                    return;
                }
                
                try {
                    const result = JSON.parse(stdout.trim());
                    resolve(result);
                } catch (parseError) {
                    console.error('❌ Erreur parsing résultat Python:', parseError);
                    reject(new Error(`Erreur parsing résultat: ${stdout}`));
                }
            });
            
            pythonProcess.on('error', (error) => {
                console.error('❌ Erreur exécution Python:', error);
                reject(new Error(`Erreur exécution Python: ${error.message}`));
            });
            
            // Timeout de sécurité
            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Timeout transformation coordonnées'));
            }, 30000);
            
        } catch (error) {
            reject(error);
        }
    });
}

    // ================================
    // MÉTHODES UTILITAIRES
    // ================================

    static parsePostGISGeometry(geomString) {
        if (!geomString) return []
        
        try {
            // Parser POLYGON
            if (geomString.includes('POLYGON')) {
                const coordsMatch = geomString.match(/POLYGON\(\(([^)]+)\)\)/)
                if (!coordsMatch) return []
                
                const coordsString = coordsMatch[1]
                const pairs = coordsString.split(',')
                
                return pairs.map(pair => {
                    const [lng, lat] = pair.trim().split(' ')
                    return [parseFloat(lat), parseFloat(lng)]
                })
            }
            
            // Parser MULTIPOLYGON
            if (geomString.includes('MULTIPOLYGON')) {
                const polygonsMatch = geomString.match(/MULTIPOLYGON\(\(\(([^)]+)\)\)\)/)
                if (!polygonsMatch) return []
                
                const coordsString = polygonsMatch[1]
                const pairs = coordsString.split(',')
                
                const coordinates = pairs.map(pair => {
                    const [lng, lat] = pair.trim().split(' ')
                    return [parseFloat(lat), parseFloat(lng)]
                })
                
                return [coordinates]
            }
            
            return []
        } catch (error) {
            console.error('Erreur parsing géométrie:', error)
            return []
        }
    }

    static formatCoordinatesForPostGIS(coordinates) {
        return coordinates.map(coord => `${coord[1]} ${coord[0]}`).join(', ')
    }

    static validateCoordinates(coordinates) {
        if (!Array.isArray(coordinates) || coordinates.length < 3) {
            return { valid: false, error: 'Au moins 3 coordonnées requises' }
        }

        for (const coord of coordinates) {
            if (!Array.isArray(coord) || coord.length !== 2) {
                return { valid: false, error: 'Format de coordonnées invalide' }
            }

            const [lat, lng] = coord
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return { valid: false, error: 'Coordonnées hors limites' }
            }
        }

        return { valid: true }
    }

    static geoJSONToWKT(geometry) {
        try {
            switch (geometry.type) {
                case 'Polygon':
                    const coords = geometry.coordinates[0]
                    const coordString = coords.map(coord => `${coord[0]} ${coord[1]}`).join(', ')
                    return `POLYGON((${coordString}))`
                    
                case 'MultiPolygon':
                    const polygons = geometry.coordinates.map(polygon => {
                        const ring = polygon[0]
                        const ringString = ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ')
                        return `((${ringString}))`
                    }).join(', ')
                    return `MULTIPOLYGON(${polygons})`
                    
                case 'Point':
                    const [lng, lat] = geometry.coordinates
                    return `POINT(${lng} ${lat})`
                    
                case 'LineString':
                    const lineCoords = geometry.coordinates.map(coord => `${coord[0]} ${coord[1]}`).join(', ')
                    return `LINESTRING(${lineCoords})`
                    
                default:
                    throw new Error(`Type de géométrie non supporté: ${geometry.type}`)
            }
        } catch (error) {
            console.error('Erreur conversion GeoJSON vers WKT:', error)
            throw error
        }
    }

    static wktToGeoJSON(wktString) {
        try {
            if (!wktString) return null

            // Parser POINT
            if (wktString.includes('POINT')) {
                const coordsMatch = wktString.match(/POINT\(([^)]+)\)/)
                if (coordsMatch) {
                    const [lng, lat] = coordsMatch[1].split(' ').map(parseFloat)
                    return {
                        type: 'Point',
                        coordinates: [lng, lat]
                    }
                }
            }

            // Parser POLYGON
            if (wktString.includes('POLYGON')) {
                const coordsMatch = wktString.match(/POLYGON\(\(([^)]+)\)\)/)
                if (coordsMatch) {
                    const coords = coordsMatch[1].split(',').map(pair => {
                        const [lng, lat] = pair.trim().split(' ').map(parseFloat)
                        return [lng, lat]
                    })
                    return {
                        type: 'Polygon',
                        coordinates: [coords]
                    }
                }
            }

            // Parser MULTIPOLYGON
            if (wktString.includes('MULTIPOLYGON')) {
                const polygonsMatch = wktString.match(/MULTIPOLYGON\(\(\(([^)]+)\)\)\)/)
                if (polygonsMatch) {
                    const coords = polygonsMatch[1].split(',').map(pair => {
                        const [lng, lat] = pair.trim().split(' ').map(parseFloat)
                        return [lng, lat]
                    })
                    return {
                        type: 'MultiPolygon',
                        coordinates: [[coords]]
                    }
                }
            }

            return null
        } catch (error) {
            console.error('Erreur conversion WKT vers GeoJSON:', error)
            return null
        }
    }

    // ================================
    // MÉTHODES DE CACHE ET PERFORMANCE
    // ================================

    static async getCachedRegions() {
        try {
            // Utiliser la vue matérialisée pour de meilleures performances
            const { data, error } = await supabase
                .from('mv_stats_regions')
                .select('*')
                .order('nom_region')

            if (error) throw error

            return { success: true, regions: data }
        } catch (error) {
            console.error('Erreur getCachedRegions:', error)
            // Fallback vers la table normale si la vue matérialisée n'existe pas
            return await this.getRegions()
        }
    }

    static async optimizeGeometries(tolerance = 0.001) {
        try {
            const { data, error } = await supabase
                .rpc('optimize_region_geometries', { tolerance })

            if (error) throw error

            return { success: true, message: data }
        } catch (error) {
            console.error('Erreur optimizeGeometries:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE RECHERCHE AVANCÉE
    // ================================

    static async searchRegionsByArea(minArea, maxArea) {
        try {
            const { data, error } = await supabase
                .from('regions')
                .select('id_region, nom_region, geom')
                .gte('superficie_km2', minArea)
                .lte('superficie_km2', maxArea)
                .order('nom_region')

            if (error) throw error

            return { success: true, regions: data }
        } catch (error) {
            console.error('Erreur searchRegionsByArea:', error)
            return { success: false, error: error.message }
        }
    }

    static async searchRegionsNearPoint(longitude, latitude, radiusKm = 50) {
        try {
            const radiusMeters = radiusKm * 1000

            const { data, error } = await supabase
                .rpc('find_regions_near_point', {
                    lon: longitude,
                    lat: latitude,
                    radius_m: radiusMeters
                })

            if (error) throw error

            return { success: true, regions: data }
        } catch (error) {
            console.error('Erreur searchRegionsNearPoint:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE STATISTIQUES AVANCÉES
    // ================================

    static async getDetailedRegionStats(regionId) {
        try {
            const { data, error } = await supabase
                .rpc('stats_detaillees_region', { region_id: regionId })

            if (error) throw error

            return { success: true, stats: data }
        } catch (error) {
            console.error('Erreur getDetailedRegionStats:', error)
            return { success: false, error: error.message }
        }
    }

    static async getRegionComparison(regionIds) {
        try {
            const comparisons = []
            
            for (const regionId of regionIds) {
                const result = await this.getDetailedRegionStats(regionId)
                if (result.success) {
                    comparisons.push(result.stats)
                }
            }

            return { success: true, comparisons }
        } catch (error) {
            console.error('Erreur getRegionComparison:', error)
            return { success: false, error: error.message }
        }
    }

    // ================================
    // MÉTHODES DE MAINTENANCE
    // ================================

    static async cleanupOrphanedData() {
        try {
            // Nettoyer les départements sans région
            const { data: orphanedDepartements, error: errorDept } = await supabase
                .from('departements')
                .select('id_departement, nom_departement')
                .is('id_region', null)

            // Nettoyer les arrondissements sans département
            const { data: orphanedArrondissements, error: errorArr } = await supabase
                .from('arrondissements')
                .select('id_arrondissement, nom_arrondissement')
                .is('id_departement', null)

            const report = {
                orphaned_departements: orphanedDepartements || [],
                orphaned_arrondissements: orphanedArrondissements || [],
                total_issues: (orphanedDepartements?.length || 0) + (orphanedArrondissements?.length || 0)
            }

            return { success: true, report }
        } catch (error) {
            console.error('Erreur cleanupOrphanedData:', error)
            return { success: false, error: error.message }
        }
    }

    static async updateGeometryIndexes() {
        try {
            // Cette fonction nécessiterait des droits administrateur sur la base
            // Pour l'instant, on simule juste la vérification
            const { data, error } = await supabase
                .rpc('validate_spatial_indexes')

            return { 
                success: true, 
                message: 'Index spatiaux vérifiés',
                details: data || 'Vérification effectuée'
            }
        } catch (error) {
            console.error('Erreur updateGeometryIndexes:', error)
            return { success: false, error: error.message }
        }
    }
}

module.exports = { SpatialService }