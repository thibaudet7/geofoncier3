// api/middleware/auth.js - Middleware d'authentification
const { supabaseAnon } = require('../supabase-config')

/**
 * Middleware pour vérifier l'authentification de l'utilisateur
 * @param {Request} req - La requête Express
 * @param {Response} res - La réponse Express
 * @param {Function} next - Fonction pour passer au middleware suivant
 */
async function authenticateUser(req, res, next) {
    try {
        console.log('🔐 Vérification authentification utilisateur')
        
        // Récupérer le token d'authentification
        const authHeader = req.headers.authorization
        if (!authHeader) {
            console.error('❌ Aucun header d\'authentification fourni')
            return res.status(401).json({
                success: false,
                error: 'Authentification requise'
            })
        }
        
        // Vérifier que le header commence par "Bearer "
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
        if (!token) {
            console.error('❌ Format de token invalide')
            return res.status(401).json({
                success: false,
                error: 'Format de token invalide'
            })
        }
        
        console.log('🔍 Vérification token...')
        
        // Vérifier le token avec Supabase
        const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
        
        if (error || !user) {
            console.error('❌ Token invalide:', error ? error.message : 'Utilisateur non trouvé')
            return res.status(401).json({
                success: false,
                error: 'Token invalide ou expiré'
            })
        }
        
        console.log('✅ Utilisateur authentifié:', user.id)
        
        // Ajouter l'utilisateur à la requête pour utilisation dans les routes suivantes
        req.user = user
        next()
    } catch (error) {
        console.error('❌ Erreur middleware authentification:', error)
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de l\'authentification'
        })
    }
}

module.exports = { authenticateUser }
