// api/services/CoordinateTransformService.js
const { spawn } = require('child_process');
const path = require('path');

class CoordinateTransformService {
    
    static async transformCoordinates(coordinates, fromSRID, toSRID = 4326) {
        try {
            console.log(`🔄 Transformation ${fromSRID} → ${toSRID}`);
            console.log('📍 Coordonnées source:', coordinates);
            
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
                    transformedCoordinates: coordinates,
                    message: 'Déjà en WGS84'
                };
            }
            
            // Appeler le script Python pour la transformation
            const result = await this.callPythonTransform(coordinates, fromSRID, toSRID);
            
            if (result.success) {
                console.log('✅ Transformation réussie');
                console.log('📍 Coordonnées transformées:', result.coordinates);
                
                return {
                    success: true,
                    transformedCoordinates: result.coordinates
                };
            } else {
                throw new Error(result.error);
            }
            
        } catch (error) {
            console.error('❌ Erreur transformation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    static async callPythonTransform(coordinates, fromSRID, toSRID) {
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
    
    static getSRIDFromSystemName(systemName) {
        const mapping = {
            'wgs84': 4326,
            'utm32': 32632,
            'utm33': 32633,
            'douala': 'douala' // Code spécial pour Douala 1948
        };
        
        return mapping[systemName] || 4326;
    }
    
    static validateCoordinates(coordinates, systemType = 'wgs84') {
        if (!Array.isArray(coordinates)) {
            return { valid: false, error: 'Coordonnées doivent être un tableau' };
        }
        
        if (coordinates.length < 3) {
            return { valid: false, error: 'Au moins 3 points requis' };
        }
        
        for (let i = 0; i < coordinates.length; i++) {
            const coord = coordinates[i];
            
            if (!Array.isArray(coord) || coord.length !== 2) {
                return { valid: false, error: `Point ${i + 1}: format invalide [lat, lng]` };
            }
            
            const [lat, lng] = coord;
            
            if (typeof lat !== 'number' || typeof lng !== 'number') {
                return { valid: false, error: `Point ${i + 1}: coordonnées doivent être des nombres` };
            }
            
            if (isNaN(lat) || isNaN(lng)) {
                return { valid: false, error: `Point ${i + 1}: coordonnées invalides` };
            }
            
            // Validation selon le système
            if (systemType === 'wgs84') {
                if (lat < -90 || lat > 90) {
                    return { valid: false, error: `Point ${i + 1}: latitude hors limites [-90, 90]` };
                }
                if (lng < -180 || lng > 180) {
                    return { valid: false, error: `Point ${i + 1}: longitude hors limites [-180, 180]` };
                }
            }
        }
        
        return { valid: true };
    }
    
    static async transformBatch(coordinateSets, fromSRID, toSRID = 4326) {
        try {
            const results = [];
            
            for (let i = 0; i < coordinateSets.length; i++) {
                const coords = coordinateSets[i];
                const result = await this.transformCoordinates(coords, fromSRID, toSRID);
                
                results.push({
                    index: i,
                    original: coords,
                    transformed: result.success ? result.transformedCoordinates : null,
                    error: result.success ? null : result.error
                });
            }
            
            return {
                success: true,
                results: results
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = { CoordinateTransformService };