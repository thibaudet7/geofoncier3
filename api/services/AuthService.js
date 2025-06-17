// api/services/AuthService.js
const { supabase, supabaseAnon } = require('../supabase-config')
const crypto = require('crypto')

class AuthService {
    
    static async registerUser(userData) {
        try {
            // Validation des données
            if (!userData.email || !userData.password || !userData.nom_complet) {
                throw new Error('Données obligatoires manquantes')
            }

            // Créer l'utilisateur dans auth.users
            const { data: authData, error: authError } = await supabaseAnon.auth.signUp({
                email: userData.email,
                password: userData.password,
                options: {
                    data: {
                        nom_complet: userData.nom_complet,
                        telephone: userData.telephone,
                        type_utilisateur: userData.type_utilisateur,
                        localisation: userData.localisation
                    }
                }
            })

            if (authError) throw authError

            // Créer l'entrée dans public.users
            const { error: insertError } = await supabase
                .from('users')
                .insert([{
                    id: authData.user.id,
                    email: userData.email,
                    nom_complet: userData.nom_complet,
                    telephone: userData.telephone || '',
                    type_utilisateur: userData.type_utilisateur || 'client',
                    type_piece_identite: userData.type_piece_identite || 'CNI',
                    numero_piece_identite: userData.numero_piece_identite || '',
                    localisation: userData.localisation || 'Cameroun',
                    is_verified: false
                }])

            if (insertError) {
                // Rollback : supprimer l'utilisateur auth si l'insertion échoue
                await supabase.auth.admin.deleteUser(authData.user.id)
                throw insertError
            }

            return { success: true, user: authData.user }
        } catch (error) {
            console.error('Erreur inscription:', error)
            return { success: false, error: error.message }
        }
    }

    static async loginUser(email, password) {
        try {
            const { data, error } = await supabaseAnon.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            // Récupérer les données utilisateur complètes
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single()

            if (userError) throw userError

            return { success: true, user: data.user, userData, session: data.session }
        } catch (error) {
            console.error('Erreur connexion:', error)
            return { success: false, error: error.message }
        }
    }

    static async getUserById(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            if (error) throw error

            return { success: true, user: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async updateUser(userId, updateData) {
        try {
            const { data, error } = await supabase
                .from('users')
                .update(updateData)
                .eq('id', userId)
                .select()

            if (error) throw error

            return { success: true, user: data[0] }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

module.exports = { AuthService }