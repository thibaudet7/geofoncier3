// api/routes/auth.js
const express = require('express')
const router = express.Router()
const { AuthService } = require('../services/AuthService')

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const userData = req.body
        
        // Validation des champs obligatoires
        const requiredFields = ['email', 'password', 'nom_complet', 'telephone', 'type_utilisateur']
        for (const field of requiredFields) {
            if (!userData[field]) {
                return res.status(400).json({
                    error: `Le champ ${field} est requis`
                })
            }
        }

        const result = await AuthService.registerUser(userData)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Inscription réussie',
                user: result.user 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route register:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email et mot de passe requis'
            })
        }

        const result = await AuthService.loginUser(email, password)
        
        if (result.success) {
            res.json({ 
                message: 'Connexion réussie',
                user: result.user,
                userData: result.userData,
                session: result.session
            })
        } else {
            res.status(401).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route login:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/auth/user/:id
router.get('/user/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const result = await AuthService.getUserById(id)
        
        if (result.success) {
            res.json({ user: result.user })
        } else {
            res.status(404).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/auth/user/:id
router.put('/user/:id', async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body
        
        const result = await AuthService.updateUser(id, updateData)
        
        if (result.success) {
            res.json({ 
                message: 'Utilisateur mis à jour',
                user: result.user 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router