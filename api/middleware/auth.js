const { supabaseAnon, supabase } = require('../supabase-config')

async function authenticateUser(req, res, next) {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Authentification requise' })
        }

        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
        if (!token) {
            return res.status(401).json({ success: false, error: 'Format de token invalide' })
        }

        const { data: { user }, error } = await supabaseAnon.auth.getUser(token)

        if (error || !user) {
            return res.status(401).json({ success: false, error: 'Token invalide ou expiré' })
        }

        req.user = user
        next()
    } catch (error) {
        console.error('Erreur middleware authentification:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur lors de l\'authentification' })
    }
}

async function requireAdmin(req, res, next) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Authentification requise' })
        }

        const { data: userData, error } = await supabase
            .from('users')
            .select('type_utilisateur')
            .eq('id', req.user.id)
            .single()

        if (error || !userData || userData.type_utilisateur !== 'admin') {
            return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs' })
        }

        next()
    } catch (error) {
        console.error('Erreur middleware requireAdmin:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
}

function requireRole(...roles) {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, error: 'Authentification requise' })
            }

            const { data: userData, error } = await supabase
                .from('users')
                .select('type_utilisateur')
                .eq('id', req.user.id)
                .single()

            if (error || !userData || !roles.includes(userData.type_utilisateur)) {
                return res.status(403).json({ success: false, error: 'Accès non autorisé' })
            }

            req.userRole = userData.type_utilisateur
            next()
        } catch (error) {
            res.status(500).json({ success: false, error: 'Erreur serveur' })
        }
    }
}

module.exports = { authenticateUser, requireAdmin, requireRole }
