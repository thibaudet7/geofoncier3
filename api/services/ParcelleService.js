// api/services/ParcelleService.js
const { supabase } = require('../supabase-config')

class ParcelleService {
    
    static async createParcelle(parcelleData) {
        try {
            // Validation des coordonnées
            if (!parcelleData.coordinates || parcelleData.coordinates.length < 3) {
                throw new Error('Au moins 3 coordonnées sont requises pour créer un polygone')
            }

            // Formatter les coordonnées pour PostGIS
            const coordinates = parcelleData.coordinates
                .map(coord => `${coord[1]} ${coord[0]}`) // lng lat
                .join(', ')
            const geomWKT = `POLYGON((${coordinates}))`

            const { data, error } = await supabase
                .from('parcelles')
                .insert([{
                    matricule: parcelleData.matricule,
                    proprietaire_id: parcelleData.proprietaire_id,
                    geom: geomWKT,
                    is_terrain_titre: parcelleData.is_terrain_titre,
                    date_delivrance: parcelleData.date_delivrance,
                    date_mise_en_valeur: parcelleData.date_mise_en_valeur,
                    quartier_village: parcelleData.quartier_village,
                    activite: parcelleData.activite,
                    description_activite: parcelleData.description_activite,
                    prix_m2: parcelleData.prix_m2 || 0,
                    nom_proprietaire: parcelleData.nom_proprietaire,
                    telephone_proprietaire: parcelleData.telephone_proprietaire
                }])
                .select()

            if (error) throw error

            return { success: true, parcelle: data[0] }
        } catch (error) {
            console.error('Erreur création parcelle:', error)
            return { success: false, error: error.message }
        }
    }

    static async getParcelles(filters = {}) {
        try {
            let query = supabase
                .from('parcelles')
                .select(`
                    *,
                    users!parcelles_proprietaire_id_fkey(nom_complet, telephone),
                    parcelle_images(image_url, image_ordre)
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
            console.error('Erreur récupération parcelles:', error)
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
                    parcelle_images(image_url, image_ordre)
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

    static async uploadParcelleImages(parcelleId, files) {
        try {
            const uploads = []
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const fileName = `parcelles/${parcelleId}/${Date.now()}_${i}.jpg`
                
                // Upload vers Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('parcelle-images')
                    .upload(fileName, file.buffer, {
                        contentType: file.mimetype,
                        upsert: false
                    })

                if (uploadError) throw uploadError

                // Obtenir l'URL publique
                const { data: { publicUrl } } = supabase.storage
                    .from('parcelle-images')
                    .getPublicUrl(fileName)

                // Enregistrer en base
                const { data: imageData, error: imageError } = await supabase
                    .from('parcelle_images')
                    .insert([{
                        parcelle_id: parcelleId,
                        image_url: publicUrl,
                        image_ordre: i + 1
                    }])
                    .select()

                if (imageError) throw imageError

                uploads.push(imageData[0])
            }

            return { success: true, images: uploads }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

module.exports = { ParcelleService }

