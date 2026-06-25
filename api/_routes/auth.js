// api/routes/auth.js - VERSION SÉCURISÉE AVEC VALIDATION
const express = require('express')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const router = express.Router()
const { AuthService } = require('../_services/AuthService')

console.log('🔧 Initialisation des routes auth...')

// Middleware de logging pour debug
router.use((req, res, next) => {
    console.log(`📡 AUTH: ${req.method} ${req.path}`)
    if (req.body && req.method === 'POST') {
        const logBody = { ...req.body }
        if (logBody.password) logBody.password = '[MASQUÉ]'
        console.log('📋 Body:', logBody)
    }
    next()
})

// GET /api/auth/health - Test de santé spécifique à auth
router.get('/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Auth service operational',
        timestamp: new Date().toISOString()
    })
})

// POST /api/auth/register - INSCRIPTION (avec validation et sanitisation)
router.post('/register', [
    body('email').isEmail().normalizeEmail().withMessage('Format email invalide'),
    body('password').isLength({ min: 6 }).trim().withMessage('Le mot de passe doit contenir au moins 6 caractères'),
    body('nom_complet').notEmpty().trim().escape().withMessage('Nom complet requis'),
    body('telephone').notEmpty().trim().escape().withMessage('Téléphone requis'),
    body('type_utilisateur').isIn(['client', 'proprietaire']).withMessage('Type utilisateur invalide'),
    body('type_piece_identite').isIn(['CNI', 'PASSEPORT', 'TITRE_SEJOUR']).withMessage('Type de pièce invalide'),
    body('numero_piece_identite').notEmpty().trim().escape().withMessage('Numéro de pièce requis'),
    body('localisation').isIn(['Cameroun', 'Afrique', 'Hors_Afrique']).withMessage('Localisation invalide')
], async (req, res) => {
    try {
        console.log('📝 === DÉBUT INSCRIPTION ===')

        // Vérifier les erreurs de validation
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(e => e.msg)
            console.log('❌ Erreurs de validation:', errorMessages)
            return res.status(400).json({
                success: false,
                error: errorMessages.join('. ')
            })
        }

        const userData = req.body
        console.log('Email:', userData.email)
        console.log('✅ Validation OK, appel AuthService...')
        
        // UTILISER AuthService au lieu de Supabase directement
        const result = await AuthService.registerUser(userData)
        
        console.log('📋 Résultat AuthService:', { 
            success: result.success, 
            hasUser: !!result.user,
            error: result.error 
        })
        
        if (result.success) {
            console.log('🎉 Inscription réussie !')
            
            res.status(201).json({
                success: true,
                message: result.message || 'Inscription réussie ! Vous pouvez maintenant vous connecter.',
                user: {
                    id: result.user.id,
                    email: result.user.email
                }
            })
        } else {
            console.log('❌ Échec inscription:', result.error)
            
            // Gestion des erreurs spécifiques
            let statusCode = 400
            let errorMessage = result.error
            
            if (result.error.includes('duplicate key') || result.error.includes('already registered')) {
                statusCode = 409
                errorMessage = 'Cette adresse email est déjà utilisée'
            }
            
            res.status(statusCode).json({
                success: false,
                error: errorMessage
            })
        }
        
    } catch (error) {
        console.error('❌ === ERREUR INSCRIPTION GLOBALE ===')
        console.error('Message:', error.message)
        console.error('Stack:', error.stack)
        
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de l\'inscription',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
})

// POST /api/auth/login - CONNEXION (avec validation et sanitisation)
router.post('/login', [
    body('email').isEmail().normalizeEmail().withMessage('Format email invalide'),
    body('password').notEmpty().trim().withMessage('Mot de passe requis')
], async (req, res) => {
    try {
        console.log('🔐 === DÉBUT CONNEXION ===')

        // Vérifier les erreurs de validation
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(e => e.msg)
            return res.status(400).json({
                success: false,
                error: errorMessages.join('. ')
            })
        }

        const { email, password } = req.body
        console.log('Email de connexion:', email)
        console.log('✅ Validation OK, appel AuthService...')

        const result = await AuthService.loginUser(email, password)
        
        console.log('📋 Résultat AuthService:', { 
            success: result.success, 
            hasUser: !!result.user,
            hasUserData: !!result.userData,
            hasSession: !!result.session,
            error: result.error 
        })
        
        if (result.success) {
            console.log('🎉 Connexion réussie pour:', result.userData?.nom_complet)
            
            // Générer un token JWT pour compatibilité avec le frontend
            const jwtPayload = {
                userId: result.user.id,
                email: result.user.email,
                type: result.userData.type_utilisateur
            }
            
            const jwtSecret = process.env.JWT_SECRET
            if (!jwtSecret) {
                console.error('❌ JWT_SECRET non défini !')
                return res.status(500).json({ success: false, error: 'Configuration serveur incomplète' })
            }
            const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: '7d' })
            
            console.log('🔑 Token JWT généré')
            
            res.json({
                success: true,
                message: result.message || 'Connexion réussie',
                userData: result.userData,
                session: {
                    ...result.session,
                    access_token: token // Ajouter le token JWT pour le frontend
                }
            })
        } else {
            console.log('❌ Échec connexion:', result.error)
            
            // Gestion des erreurs spécifiques
            let statusCode = 401
            let errorMessage = result.error
            
            if (result.error.includes('Invalid login credentials')) {
                errorMessage = 'Email ou mot de passe incorrect'
            } else if (result.error.includes('Email not confirmed')) {
                errorMessage = 'Veuillez confirmer votre email'
                statusCode = 403
            } else if (result.error.includes('Too many requests')) {
                errorMessage = 'Trop de tentatives, patientez'
                statusCode = 429
            }
            
            res.status(statusCode).json({
                success: false,
                error: errorMessage
            })
        }
        
    } catch (error) {
        console.error('❌ === ERREUR CONNEXION GLOBALE ===')
        console.error('Message:', error.message)
        console.error('Stack:', error.stack)
        
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la connexion',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        })
    }
})

// GET /api/auth/verify - VÉRIFICATION TOKEN
router.get('/verify', async (req, res) => {
    try {
        console.log('🔍 Vérification de token demandée')
        
        const authHeader = req.headers.authorization
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Token manquant ou format invalide'
            })
        }
        
        const token = authHeader.substring(7)
        
        try {
            // Vérifier avec JWT d'abord
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            console.log('🔑 Token JWT vérifié pour:', decoded.userId)
            
            // Récupérer les données utilisateur mises à jour
            const userResult = await AuthService.getUserById(decoded.userId)
            
            if (!userResult.success) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                })
            }
            
            res.json({
                success: true,
                userData: userResult.user,
                message: 'Token valide'
            })
            
        } catch (jwtError) {
            console.log('⚠️ Token JWT invalide, test avec Supabase...')
            
            // Fallback: vérifier avec Supabase
            const { supabaseAnon } = require('../_supabase-config')
            const { data: { user }, error } = await supabaseAnon.auth.getUser(token)
            
            if (error || !user) {
                return res.status(401).json({
                    success: false,
                    error: 'Token invalide'
                })
            }
            
            console.log('✅ Token Supabase valide pour:', user.id)
            
            const userResult = await AuthService.getUserById(user.id)
            if (!userResult.success) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                })
            }
            
            res.json({
                success: true,
                userData: userResult.user,
                message: 'Token valide'
            })
        }
        
    } catch (error) {
        console.error('❌ Erreur vérification token:', error)
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la vérification'
        })
    }
})

// POST /api/auth/logout - DÉCONNEXION
router.post('/logout', async (req, res) => {
    try {
        console.log('🚪 Demande de déconnexion')
        
        // Pas besoin de faire grand chose côté serveur pour JWT
        // La déconnexion se fait principalement côté client
        
        res.json({
            success: true,
            message: 'Déconnexion réussie'
        })
        
    } catch (error) {
        console.error('❌ Erreur logout:', error)
        res.status(500).json({
            success: false,
            error: 'Erreur serveur lors de la déconnexion'
        })
    }
})

console.log('✅ Routes auth initialisées')

module.exports = router