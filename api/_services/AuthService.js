// api/services/AuthService.js - VERSION FINALE
const { supabase, supabaseAnon } = require('../_supabase-config')

class AuthService {
    
    static async registerUser(userData) {
        try {
            console.log('📝 Début inscription pour:', userData.email)

            // Validation des données
            if (!userData.email || !userData.password || !userData.nom_complet) {
                throw new Error('Données obligatoires manquantes')
            }

            // 1. Créer l'utilisateur dans auth.users avec admin.createUser
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: userData.email,
                password: userData.password,
                email_confirm: true, // Important: confirmer l'email automatiquement
                user_metadata: {
                    nom_complet: userData.nom_complet,
                    telephone: userData.telephone,
                    type_utilisateur: userData.type_utilisateur
                }
            })

            if (authError) {
                console.error('❌ Erreur création auth user:', authError)
                throw authError
            }

            console.log('✅ Auth user créé:', authData.user.id)

            // 2. Créer l'entrée dans public.users
            const userRecord = {
                id: authData.user.id,
                email: userData.email,
                nom_complet: userData.nom_complet,
                telephone: userData.telephone || '',
                type_utilisateur: userData.type_utilisateur || 'client',
                type_piece_identite: userData.type_piece_identite || 'CNI',
                numero_piece_identite: userData.numero_piece_identite || '',
                localisation: userData.localisation || 'Cameroun',
                is_verified: false
            }

            const { data: insertData, error: insertError } = await supabase
                .from('users')
                .insert([userRecord])
                .select()

            if (insertError) {
                console.error('❌ Erreur insertion public.users:', insertError)
                // Rollback
                await supabase.auth.admin.deleteUser(authData.user.id)
                throw insertError
            }

            console.log('✅ Utilisateur créé avec succès')

            return { 
                success: true, 
                user: authData.user,
                userData: insertData[0],
                message: 'Inscription réussie'
            }
        } catch (error) {
            console.error('❌ Erreur inscription complète:', error)
            return { 
                success: false, 
                error: error.message || 'Erreur lors de l\'inscription'
            }
        }
    }

    static async loginUser(email, password) {
        try {
            console.log('🔐 Début connexion pour:', email)

            // 1. Connexion avec le client anonyme
            const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password: password
            })

            if (authError) {
                console.error('❌ Erreur signInWithPassword:', authError)
                
                // Messages d'erreur plus explicites
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('Email ou mot de passe incorrect')
                } else if (authError.message.includes('Email not confirmed')) {
                    throw new Error('Veuillez confirmer votre email avant de vous connecter')
                } else if (authError.message.includes('Too many requests')) {
                    throw new Error('Trop de tentatives. Veuillez patienter quelques minutes')
                } else {
                    throw new Error(authError.message || 'Erreur de connexion')
                }
            }

            if (!authData.user) {
                throw new Error('Aucune donnée utilisateur retournée')
            }

            console.log('✅ Auth réussie pour user ID:', authData.user.id)

            // 2. Récupérer les données de public.users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single()

            if (userError) {
                console.error('❌ Erreur récupération userData:', userError)
                
                if (userError.code === 'PGRST116') {
                    // L'utilisateur n'existe pas dans public.users
                    console.log('🔄 Création manquante dans public.users...')
                    
                    const metadata = authData.user.user_metadata || {}
                    const fallbackUserData = {
                        id: authData.user.id,
                        email: authData.user.email,
                        nom_complet: metadata.nom_complet || 'Utilisateur',
                        telephone: metadata.telephone || '',
                        type_utilisateur: metadata.type_utilisateur || 'client',
                        type_piece_identite: 'CNI',
                        numero_piece_identite: '',
                        localisation: 'Cameroun',
                        is_verified: false
                    }

                    const { data: newUserData, error: createError } = await supabase
                        .from('users')
                        .insert([fallbackUserData])
                        .select()
                        .single()

                    if (createError) {
                        console.error('❌ Erreur création public.users:', createError)
                        throw new Error('Impossible de créer le profil utilisateur')
                    }

                    console.log('✅ Profil utilisateur créé')
                    
                    return { 
                        success: true, 
                        user: authData.user, 
                        userData: newUserData, 
                        session: authData.session,
                        message: 'Connexion réussie'
                    }
                } else {
                    throw new Error('Erreur de récupération du profil utilisateur')
                }
            }

            console.log('✅ Données utilisateur récupérées')

            return { 
                success: true, 
                user: authData.user, 
                userData, 
                session: authData.session,
                message: 'Connexion réussie'
            }
        } catch (error) {
            console.error('❌ Erreur connexion complète:', error)
            return { 
                success: false, 
                error: error.message || 'Erreur de connexion'
            }
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
            console.error('❌ Erreur getUserById:', error)
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
            console.error('❌ Erreur updateUser:', error)
            return { success: false, error: error.message }
        }
    }
}

module.exports = { AuthService }