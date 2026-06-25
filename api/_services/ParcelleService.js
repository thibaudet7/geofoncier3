// api/services/ParcelleService.js - VERSION ADAPTÉE AU SCHÉMA EXISTANT
const { supabase } = require('../_supabase-config')

// Mapping des valeurs d'activité utilisateur vers les valeurs de l'enum Supabase
const ACTIVITE_MAPPING = {
    'agriculture': 'location_agriculture',
    'habitation': 'propriete_privee',
    'commerce': 'vente_terrain',
    'industrie': 'location_construction',
    'mixte': 'propriete_privee',
    'autre': 'autres'
};

class ParcelleService {
    
    static async createParcelle(parcelleData, files = {}, userId) {
    try {
        console.log('📝 Début création parcelle:', parcelleData.matricule);

        // Validation des coordonnées
        if (!parcelleData.coordinates || parcelleData.coordinates.length < 3) {
            throw new Error('Au moins 3 coordonnées sont requises pour créer un polygone');
        }

        let finalCoordinates = parcelleData.coordinates;
        let coordinatesTransformed = false;
        
        // NOUVEAU : Conversion automatique des coordonnées si nécessaire
        const sourceSystem = parcelleData.coordinate_system || 'wgs84';
        console.log('🗺️ Système source détecté:', sourceSystem);
        
        if (sourceSystem !== 'wgs84') {
            console.log('🔄 Conversion requise vers WGS84...');
            
            try {
                // Importer le service de transformation spatiale
                const { SpatialService } = require('./SpatialService');
                
                // Mapper les systèmes vers les codes SRID
                const sridMapping = {
                    'utm32': 32632,
                    'utm33': 32633,
                    'douala': 'douala'
                };
                
                const fromSRID = sridMapping[sourceSystem];
                if (!fromSRID) {
                    throw new Error(`Système de coordonnées non supporté: ${sourceSystem}`);
                }
                
                // Effectuer la transformation
                const transformResult = await SpatialService.transformCoordinates(
                    parcelleData.coordinates, 
                    fromSRID, 
                    4326
                );
                
                if (transformResult.success) {
                    finalCoordinates = transformResult.transformedCoordinates;
                    coordinatesTransformed = true;
                    console.log('✅ Coordonnées transformées avec succès');
                    console.log('Original:', parcelleData.coordinates.slice(0, 2));
                    console.log('Transformé:', finalCoordinates.slice(0, 2));
                } else {
                    // Si la transformation échoue, essayer une conversion simple pour UTM
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
                // Si tout échoue, on utilise les coordonnées originales en espérant qu'elles soient correctes
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

        // Préparer les données pour l'insertion
        const insertData = {
            matricule: parcelleData.matricule,
            proprietaire_id: userId, // Utiliser l'ID de l'utilisateur authentifié
            geom: geomWKT,
            is_terrain_titre: isTerrainTitre,
            date_delivrance: parcelleData.date_delivrance || null,
            date_mise_en_valeur: parcelleData.date_mise_en_valeur,
            quartier_village: parcelleData.quartier_village,
            activite: mappedActivite, // Utiliser la valeur mappée
            description_activite: parcelleData.description_activite,
            prix_m2: parseFloat(parcelleData.prix_m2) || 0,
            nom_proprietaire: parcelleData.nom_proprietaire,
            telephone_proprietaire: parcelleData.telephone_proprietaire,
            has_acte_foncier: isTerrainTitre,
            acte_foncier_verified: false,
            documents_complete: false
        };

        console.log('💾 Insertion dans la base de données...');
        
        const { data: parcelleInserted, error: insertError } = await supabase
            .from('parcelles')
            .insert([insertData])
            .select();

        if (insertError) {
            console.error('❌ Erreur insertion parcelle:', insertError);
            throw insertError;
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
                    'autre', // Type pour l'identité
                    'Document identité'
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
                    'Justificatif acte foncier'
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
                    const photoResult = await this.uploadTerrainPhoto(parcelleId, files.photos[i], i + 1);
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

            await supabase
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
            coordinatesTransformed: coordinatesTransformed, // Indiquer si transformation effectuée
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


        // NOUVELLES MÉTHODES UTILITAIRES POUR LA CONVERSION

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
                
                // Validation WGS84
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
            // Conversion UTM simplifiée pour le Cameroun
            // Cette méthode utilise des approximations pour les zones UTM 32N et 33N
            
            const transformedCoords = [];
            
            for (const coord of coordinates) {
                const [northing, easting] = coord; // Format reçu : [Y, X] ou [northing, easting]
                
                // Vérification basique des valeurs UTM
                if (easting < 100000 || easting > 900000 || northing < 100000 || northing > 9000000) {
                    console.warn(`⚠️ Valeurs UTM douteuses: E=${easting}, N=${northing}`);
                }
                
                // Approximation simple pour le Cameroun
                let lat, lng;
                
                if (utmZone === 'utm32') {
                    // Zone UTM 32N - Ouest du Cameroun
                    lat = (northing - 1000000) / 111000 + 9; // Approximation latitude
                    lng = (easting - 500000) / 111000 + 9;   // Approximation longitude
                } else if (utmZone === 'utm33') {
                    // Zone UTM 33N - Est du Cameroun  
                    lat = (northing - 1000000) / 111000 + 9;
                    lng = (easting - 500000) / 111000 + 15;  // Décalage pour zone 33
                } else {
                    // Fallback - garder les coordonnées originales
                    lat = northing;
                    lng = easting;
                }
                
                // Vérification que le résultat est raisonnable pour le Cameroun
                if (lat >= 1 && lat <= 13 && lng >= 8 && lng <= 17) {
                    transformedCoords.push([lat, lng]);
                } else {
                    console.warn(`⚠️ Coordonnées transformées hors du Cameroun: ${lat}, ${lng}`);
                    // Essayer l'inverse (peut-être les coordonnées étaient inversées)
                    if (easting >= 1 && easting <= 13 && northing >= 8 && northing <= 17) {
                        transformedCoords.push([easting, northing]);
                        console.log('✅ Utilisation coordonnées inversées');
                    } else {
                        // Dernière tentative : diviser par 100000 si les valeurs sont trop grandes
                        const latAdj = northing / 100000;
                        const lngAdj = easting / 100000;
                        if (latAdj >= 1 && latAdj <= 13 && lngAdj >= 8 && lngAdj <= 17) {
                            transformedCoords.push([latAdj, lngAdj]);
                            console.log('✅ Utilisation facteur 100000');
                        } else {
                            // En dernier recours, garder les valeurs originales
                            transformedCoords.push([northing, easting]);
                            console.warn('⚠️ Utilisation coordonnées brutes');
                        }
                    }
                }
            }
            
            console.log('🔄 Conversion UTM simplifiée terminée');
            console.log('Exemple transformation:', coordinates[0], '→', transformedCoords[0]);
            
            return transformedCoords;
        }



    static async uploadDocument(parcelleId, file, documentType, displayName = null) {
        try {
            console.log(`📤 Upload document ${documentType} pour parcelle ${parcelleId}`);
            
            // Valider le type de document selon votre constraint
            const validTypes = ['acte_foncier', 'titre_propriete', 'certificat_occupation', 'plan_cadastral', 'autre'];
            if (!validTypes.includes(documentType)) {
                throw new Error(`Type de document invalide: ${documentType}`);
            }
            
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            const fileName = `parcelles/${parcelleId}/${documentType}_${Date.now()}.${fileExtension}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
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
            const { data: { publicUrl } } = supabase.storage
                .from('parcelle-documents')
                .getPublicUrl(fileName);

            console.log('✅ Fichier uploadé, URL:', publicUrl);

            // Insérer dans la table parcelle_documents selon votre schéma exact
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
                // uploaded_at et created_at sont auto-générés
            };

            const { data: documentData, error: documentError } = await supabase
                .from('parcelle_documents') // Nom exact de votre table
                .insert([documentRecord])
                .select();

            if (documentError) {
                console.error('❌ Erreur insertion document:', documentError);
                console.log('🔧 Structure tentée:', documentRecord);
                
                // Supprimer le fichier du storage en cas d'erreur d'insertion
                await supabase.storage
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

    static async uploadTerrainPhoto(parcelleId, file, ordre) {
        try {
            console.log(`📷 Upload photo ${ordre} pour parcelle ${parcelleId}`);
            
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            const fileName = `parcelles/${parcelleId}/photo_${ordre}_${Date.now()}.${fileExtension}`;
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('parcelle-images')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
                .from('parcelle-images')
                .getPublicUrl(fileName);

            // Enregistrer en base
            const { data: imageData, error: imageError } = await supabase
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

    // ... (conserver toutes les autres méthodes existantes comme getParcelles, getParcelleById, etc.)
    
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
}

module.exports = { ParcelleService }