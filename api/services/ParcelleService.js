// api/services/ParcelleService.js - VERSION CORRIGÉE
const { supabase } = require('../supabase-config')

// Mapping des valeurs d'activité utilisateur vers les valeurs de l'enum Supabase
const ACTIVITE_MAPPING = {
    'agriculture': 'location_agriculture',
    'habitation': 'propriete_privee',
    'commerce': 'vente_terrain',
    'industrie': 'location_construction',
    'mixte': 'propriete_privee',
    'autre': 'autres',
    // Ajout direct des valeurs valides
    'propriete_privee': 'propriete_privee',
    'vente_terrain': 'vente_terrain',
    'location_construction': 'location_construction',
    'location_agriculture': 'location_agriculture',
    'autres': 'autres'
};

class ParcelleService {
    
    // MÉTHODE PRINCIPALE CORRIGÉE
    static async createParcelle(parcelleData, files = {}, userId, supabaseClient = null) {
        try {
            console.log('📝 Début création parcelle:', parcelleData.matricule);
            console.log('👤 User ID:', userId);

            // Utiliser le client Supabase avec contexte utilisateur si fourni
            const dbClient = supabaseClient || supabase;

            // Validation des coordonnées
            if (!parcelleData.coordinates || parcelleData.coordinates.length < 3) {
                throw new Error('Au moins 3 coordonnées sont requises pour créer un polygone');
            }

            let finalCoordinates = parcelleData.coordinates;
            let coordinatesTransformed = false;
            
            // Conversion automatique des coordonnées si nécessaire
            const sourceSystem = parcelleData.coordinate_system || 'wgs84';
            console.log('🗺️ Système source détecté:', sourceSystem);
            
            if (sourceSystem !== 'wgs84') {
                console.log('🔄 Conversion requise vers WGS84...');
                
                try {
                    const { SpatialService } = require('../services/SpatialService');
                    
                    const sridMapping = {
                        'utm32': 32632,
                        'utm33': 32633,
                        'douala': 'douala'
                    };
                    
                    const fromSRID = sridMapping[sourceSystem];
                    if (!fromSRID) {
                        throw new Error(`Système de coordonnées non supporté: ${sourceSystem}`);
                    }
                    
                    const transformResult = await SpatialService.transformCoordinates(
                        parcelleData.coordinates, 
                        fromSRID, 
                        4326
                    );
                    
                    if (transformResult.success) {
                        finalCoordinates = transformResult.transformedCoordinates;
                        coordinatesTransformed = true;
                        console.log('✅ Coordonnées transformées avec succès');
                    } else {
                        if (sourceSystem === 'utm32' || sourceSystem === 'utm33') {
                            console.log('⚠️ Transformation échouée, tentative conversion UTM simplifiée...');
                            finalCoordinates = this.simpleUTMToWGS84(parcelleData.coordinates, sourceSystem);
                            coordinatesTransformed = true;
                        } else {
                            throw new Error(`Échec transformation: ${transformResult.error}`);
                        }
                    }
                    
                } catch (transformError) {
                    console.error('❌ Erreur transformation:', transformError);
                    console.log('⚠️ Utilisation des coordonnées originales sans transformation');
                }
            }

            // Validation des coordonnées finales
            const validationResult = this.validateWGS84Coordinates(finalCoordinates);
            if (!validationResult.valid) {
                throw new Error(`Coordonnées invalides après transformation: ${validationResult.error}`);
            }

            // Formatter les coordonnées pour PostGIS (WGS84)
            const coordinates = finalCoordinates
                .map(coord => `${coord[1]} ${coord[0]}`) // lng lat pour PostGIS
                .join(', ');
            const geomWKT = `POLYGON((${coordinates}))`;

            // Déterminer is_terrain_titre
            const isTerrainTitre = parcelleData.statut === 'titre';

            // Mapper l'activité vers la valeur de l'enum Supabase
            const mappedActivite = ACTIVITE_MAPPING[parcelleData.activite] || 'autres';
            console.log(`🔄 Mapping activité: "${parcelleData.activite}" → "${mappedActivite}"`);

            // CORRECTION CRITIQUE : Préparer les données pour l'insertion
            const insertData = {
                matricule: parcelleData.matricule,
                proprietaire_id: userId, // Utiliser l'ID de l'utilisateur authentifié
                geom: geomWKT,
                is_terrain_titre: isTerrainTitre,
                date_delivrance: parcelleData.date_delivrance || null,
                date_mise_en_valeur: parcelleData.date_mise_en_valeur,
                quartier_village: parcelleData.quartier_village,
                activite: mappedActivite,
                description_activite: parcelleData.description_activite,
                prix_m2: parseFloat(parcelleData.prix_m2) || 0,
                nom_proprietaire: parcelleData.nom_proprietaire,
                telephone_proprietaire: parcelleData.telephone_proprietaire,
                has_acte_foncier: isTerrainTitre,
                acte_foncier_verified: false,
                documents_complete: false
            };

            console.log('💾 Données préparées pour insertion:', {
                matricule: insertData.matricule,
                proprietaire_id: insertData.proprietaire_id,
                activite: insertData.activite,
                geom: geomWKT.substring(0, 50) + '...'
            });

            // CORRECTION : Insérer avec le bon client et gestion d'erreur améliorée
            console.log('💾 Insertion dans la base de données...');
            
            const { data: parcelleInserted, error: insertError } = await dbClient
                .from('parcelles')
                .insert([insertData])
                .select();

            if (insertError) {
                console.error('❌ Erreur insertion parcelle détaillée:', {
                    code: insertError.code,
                    message: insertError.message,
                    details: insertError.details,
                    hint: insertError.hint
                });
                
                // Traiter les erreurs spécifiques
                if (insertError.code === '23505') { // Violation de contrainte unique
                    throw new Error(`Le matricule "${parcelleData.matricule}" existe déjà`);
                } else if (insertError.code === '23503') { // Violation de contrainte de clé étrangère
                    throw new Error('Utilisateur propriétaire invalide');
                } else if (insertError.code === '22P02') { // Données invalides
                    throw new Error('Format de données invalide: ' + insertError.message);
                } else if (insertError.message.includes('activite')) {
                    throw new Error(`Type d'activité invalide: "${parcelleData.activite}". Valeurs acceptées: propriete_privee, vente_terrain, location_construction, location_agriculture, autres`);
                } else {
                    throw new Error(`Erreur base de données: ${insertError.message}`);
                }
            }

            if (!parcelleInserted || parcelleInserted.length === 0) {
                throw new Error('Aucune parcelle retournée après insertion');
            }

            const parcelleId = parcelleInserted[0].id;
            console.log('✅ Parcelle créée avec ID:', parcelleId);

            // Upload des documents
            let documentsUploaded = [];
            let uploadErrors = [];

            try {
                // Upload document d'identité
                if (files.documentIdentite) {
                    console.log('📤 Upload document identité...');
                    const identiteResult = await this.uploadDocument(
                        parcelleId, 
                        files.documentIdentite, 
                        'autre',
                        'Document identité',
                        dbClient // Passer le client avec contexte
                    );
                    if (identiteResult.success) {
                        documentsUploaded.push('identite');
                    } else {
                        uploadErrors.push(`Identité: ${identiteResult.error}`);
                    }
                }

                // Upload justificatif acte (obligatoire pour terrains titrés)
                if (files.justificatifActe && isTerrainTitre) {
                    console.log('📤 Upload justificatif acte...');
                    const acteResult = await this.uploadDocument(
                        parcelleId, 
                        files.justificatifActe, 
                        'acte_foncier',
                        'Justificatif acte foncier',
                        dbClient
                    );
                    if (acteResult.success) {
                        documentsUploaded.push('acte_foncier');
                    } else {
                        uploadErrors.push(`Acte: ${acteResult.error}`);
                    }
                }

                // Upload photos du terrain
                if (files.photos && files.photos.length > 0) {
                    console.log('📤 Upload photos terrain...');
                    for (let i = 0; i < Math.min(files.photos.length, 3); i++) {
                        const photoResult = await this.uploadTerrainPhoto(parcelleId, files.photos[i], i + 1, dbClient);
                        if (photoResult.success) {
                            documentsUploaded.push(`photo_${i + 1}`);
                        } else {
                            uploadErrors.push(`Photo ${i + 1}: ${photoResult.error}`);
                        }
                    }
                }

                // Mettre à jour le statut des documents
                const documentsComplete = documentsUploaded.includes('identite') && 
                    (!isTerrainTitre || documentsUploaded.includes('acte_foncier'));

                await dbClient
                    .from('parcelles')
                    .update({ 
                        documents_complete: documentsComplete,
                        acte_foncier_verified: isTerrainTitre && documentsUploaded.includes('acte_foncier')
                    })
                    .eq('id', parcelleId);

                console.log('✅ Documents uploadés:', documentsUploaded);
                if (uploadErrors.length > 0) {
                    console.warn('⚠️ Erreurs upload:', uploadErrors);
                }

            } catch (uploadError) {
                console.error('⚠️ Erreur upload documents:', uploadError);
                uploadErrors.push(`Général: ${uploadError.message}`);
            }

            return { 
                success: true, 
                parcelle: parcelleInserted[0],
                documentsUploaded: documentsUploaded,
                uploadErrors: uploadErrors.length > 0 ? uploadErrors : null,
                coordinatesTransformed: coordinatesTransformed,
                originalSystem: sourceSystem,
                finalCoordinates: finalCoordinates
            };

        } catch (error) {
            console.error('❌ Erreur création parcelle:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    // Méthodes utilitaires (inchangées)
    static validateWGS84Coordinates(coordinates) {
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
            
            if (lat < -90 || lat > 90) {
                return { valid: false, error: `Point ${i + 1}: latitude hors limites [-90, 90]: ${lat}` };
            }
            if (lng < -180 || lng > 180) {
                return { valid: false, error: `Point ${i + 1}: longitude hors limites [-180, 180]: ${lng}` };
            }
        }
        
        return { valid: true };
    }

    static simpleUTMToWGS84(coordinates, utmZone) {
        const transformedCoords = [];
        
        for (const coord of coordinates) {
            const [northing, easting] = coord;
            
            if (easting < 100000 || easting > 900000 || northing < 100000 || northing > 9000000) {
                console.warn(`⚠️ Valeurs UTM douteuses: E=${easting}, N=${northing}`);
            }
            
            let lat, lng;
            
            if (utmZone === 'utm32') {
                lat = (northing - 1000000) / 111000 + 9;
                lng = (easting - 500000) / 111000 + 9;
            } else if (utmZone === 'utm33') {
                lat = (northing - 1000000) / 111000 + 9;
                lng = (easting - 500000) / 111000 + 15;
            } else {
                lat = northing;
                lng = easting;
            }
            
            if (lat >= 1 && lat <= 13 && lng >= 8 && lng <= 17) {
                transformedCoords.push([lat, lng]);
            } else {
                console.warn(`⚠️ Coordonnées transformées hors du Cameroun: ${lat}, ${lng}`);
                if (easting >= 1 && easting <= 13 && northing >= 8 && northing <= 17) {
                    transformedCoords.push([easting, northing]);
                } else {
                    const latAdj = northing / 100000;
                    const lngAdj = easting / 100000;
                    if (latAdj >= 1 && latAdj <= 13 && lngAdj >= 8 && lngAdj <= 17) {
                        transformedCoords.push([latAdj, lngAdj]);
                    } else {
                        transformedCoords.push([northing, easting]);
                    }
                }
            }
        }
        
        return transformedCoords;
    }

    // Upload documents avec client contextualisé
    static async uploadDocument(parcelleId, file, documentType, displayName = null, dbClient = null) {
        try {
            console.log(`📤 Upload document ${documentType} pour parcelle ${parcelleId}`);
            
            const client = dbClient || supabase;
            
            const validTypes = ['acte_foncier', 'titre_propriete', 'certificat_occupation', 'plan_cadastral', 'autre'];
            if (!validTypes.includes(documentType)) {
                throw new Error(`Type de document invalide: ${documentType}`);
            }
            
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            const fileName = `parcelles/${parcelleId}/${documentType}_${Date.now()}.${fileExtension}`;
            
            const { data: uploadData, error: uploadError } = await client.storage
                .from('parcelle-documents')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                console.error('❌ Erreur upload storage:', uploadError);
                throw uploadError;
            }

            // Obtenir l'URL publique
            const { data: { publicUrl } } = client.storage
                .from('parcelle-documents')
                .getPublicUrl(fileName);

            console.log('✅ Fichier uploadé, URL:', publicUrl);

            // Insérer dans la table parcelle_documents
            const documentRecord = {
                parcelle_id: parcelleId,
                document_type: documentType,
                document_name: displayName || file.originalname,
                document_url: publicUrl,
                file_size: file.size,
                mime_type: file.mimetype,
                is_verified: false,
                verified_by: null,
                verified_at: null
            };

            const { data: documentData, error: documentError } = await client
                .from('parcelle_documents')
                .insert([documentRecord])
                .select();

            if (documentError) {
                console.error('❌ Erreur insertion document:', documentError);
                
                // Supprimer le fichier du storage en cas d'erreur d'insertion
                await client.storage
                    .from('parcelle-documents')
                    .remove([fileName]);
                
                throw documentError;
            }

            console.log('✅ Document enregistré en base avec ID:', documentData[0].id);
            return { success: true, document: documentData[0] };

        } catch (error) {
            console.error(`❌ Erreur upload ${documentType}:`, error);
            return { success: false, error: error.message };
        }
    }

    static async uploadTerrainPhoto(parcelleId, file, ordre, dbClient = null) {
        try {
            console.log(`📷 Upload photo ${ordre} pour parcelle ${parcelleId}`);
            
            const client = dbClient || supabase;
            
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            const fileName = `parcelles/${parcelleId}/photo_${ordre}_${Date.now()}.${fileExtension}`;
            
            const { data: uploadData, error: uploadError } = await client.storage
                .from('parcelle-images')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Obtenir l'URL publique
            const { data: { publicUrl } } = client.storage
                .from('parcelle-images')
                .getPublicUrl(fileName);

            // Enregistrer en base
            const { data: imageData, error: imageError } = await client
                .from('parcelle_images')
                .insert([{
                    parcelle_id: parcelleId,
                    image_url: publicUrl,
                    image_ordre: ordre
                }])
                .select();

            if (imageError) throw imageError;

            console.log('✅ Photo enregistrée:', imageData[0].id);
            return { success: true, image: imageData[0] };

        } catch (error) {
            console.error(`❌ Erreur upload photo ${ordre}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Autres méthodes existantes (getParcelles, getParcelleById, etc.) - inchangées
    static async getParcelles(filters = {}) {
        try {
            let query = supabase
                .from('parcelles')
                .select(`
                    *,
                    users!parcelles_proprietaire_id_fkey(nom_complet, telephone),
                    parcelle_images(image_url, image_ordre),
                    parcelle_documents(document_type, document_name, document_url, is_verified)
                `)
                .eq('is_active', true)

            // Appliquer les filtres
            if (filters.arrondissement) {
                query = query.rpc('parcelles_in_arrondissement', {
                    arrondissement_name: filters.arrondissement
                })
            }

            if (filters.activite) {
                query = query.eq('activite', filters.activite)
            }

            if (filters.statut === 'titre') {
                query = query.eq('is_terrain_titre', true)
            } else if (filters.statut === 'non_titre') {
                query = query.eq('is_terrain_titre', false)
            }

            if (filters.prix_min) {
                query = query.gte('prix_m2', filters.prix_min)
            }

            if (filters.prix_max) {
                query = query.lte('prix_m2', filters.prix_max)
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(filters.limit || 100)

            if (error) throw error

            return { success: true, parcelles: data }
        } catch (error) {
            console.error('❌ Erreur récupération parcelles:', error)
            return { success: false, error: error.message }
        }
    }

    static async getParcelleById(id) {
        try {
            const { data, error } = await supabase
                .from('parcelles')
                .select(`
                    *,
                    users!parcelles_proprietaire_id_fkey(nom_complet, telephone, email),
                    parcelle_images(image_url, image_ordre),
                    parcelle_documents(
                        id,
                        document_type,
                        document_name,
                        document_url,
                        file_size,
                        mime_type,
                        is_verified,
                        verified_at,
                        uploaded_at
                    )
                `)
                .eq('id', id)
                .eq('is_active', true)
                .single()

            if (error) throw error

            return { success: true, parcelle: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async searchParcelles(matricule) {
        try {
            const { data, error } = await supabase
                .from('parcelles')
                .select(`
                    *,
                    users!parcelles_proprietaire_id_fkey(nom_complet, telephone),
                    parcelle_images(image_url, image_ordre)
                `)
                .ilike('matricule', `%${matricule}%`)
                .eq('is_active', true)

            if (error) throw error

            return { success: true, parcelles: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async updateParcelle(id, updateData) {
        try {
            const { data, error } = await supabase
                .from('parcelles')
                .update(updateData)
                .eq('id', id)
                .select()

            if (error) throw error

            return { success: true, parcelle: data[0] }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async deleteParcelle(id) {
        try {
            const { error } = await supabase
                .from('parcelles')
                .update({ is_active: false })
                .eq('id', id)

            if (error) throw error

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async checkOverlaps(parcelleId) {
        try {
            const { data, error } = await supabase
                .rpc('detect_parcelle_overlaps', { parcelle_id: parcelleId })

            if (error) throw error

            return { success: true, overlaps: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Méthode pour récupérer les documents d'une parcelle
    static async getParcelleDocuments(parcelleId) {
        try {
            const { data, error } = await supabase
                .from('parcelle_documents')
                .select(`
                    id,
                    document_type,
                    document_name,
                    document_url,
                    file_size,
                    mime_type,
                    is_verified,
                    verified_by,
                    verified_at,
                    uploaded_at,
                    users!parcelle_documents_verified_by_fkey(nom_complet)
                `)
                .eq('parcelle_id', parcelleId)
                .order('uploaded_at', { ascending: false });

            if (error) throw error;

            return { success: true, documents: data };
        } catch (error) {
            console.error('❌ Erreur récupération documents:', error);
            return { success: false, error: error.message };
        }
    }

    // Méthode pour vérifier un document (admin uniquement)
    static async verifyDocument(documentId, verifiedBy) {
        try {
            const { data, error } = await supabase
                .from('parcelle_documents')
                .update({
                    is_verified: true,
                    verified_by: verifiedBy,
                    verified_at: new Date().toISOString()
                })
                .eq('id', documentId)
                .select();

            if (error) throw error;

            return { success: true, document: data[0] };
        } catch (error) {
            console.error('❌ Erreur vérification document:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = { ParcelleService };