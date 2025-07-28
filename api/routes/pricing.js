// api/routes/pricing.js - Routes pour la gestion des tarifs
const express = require('express')
const router = express.Router()
const { PricingService } = require('../services/PricingService')

// GET /api/pricing/tiers - Obtenir tous les paliers tarifaires
router.get('/tiers', async (req, res) => {
    try {
        const result = await PricingService.getPricingTiers()
        
        if (result.success) {
            res.json({ tiers: result.tiers })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route pricing tiers:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/pricing/calculate-proprietaire - Calculer le tarif propriétaire
router.post('/calculate-proprietaire', async (req, res) => {
    try {
        const { superficie } = req.body
        
        if (!superficie || superficie <= 0) {
            return res.status(400).json({
                error: 'Superficie valide requise (supérieure à 0)'
            })
        }

        const result = PricingService.calculateDetailedPricing(superficie)
        
        if (result.success) {
            res.json({ pricing: result.pricing })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route calculate proprietaire:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/pricing/client - Obtenir les tarifs clients
router.get('/client', (req, res) => {
    try {
        const result = PricingService.getClientPricing()
        res.json({ pricing: result.pricing })
    } catch (error) {
        console.error('Erreur route client pricing:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/pricing/simulate - Simuler un tarif
router.post('/simulate', (req, res) => {
    try {
        const { userType, region, period, superficie } = req.body
        
        if (!userType || !period) {
            return res.status(400).json({
                error: 'Type d\'utilisateur et période requis'
            })
        }

        if (userType === 'client' && !region) {
            return res.status(400).json({
                error: 'Région requise pour les clients'
            })
        }

        if (userType === 'proprietaire' && !superficie) {
            return res.status(400).json({
                error: 'Superficie requise pour les propriétaires'
            })
        }

        const result = PricingService.simulateSubscriptionPricing(userType, region, period, superficie)
        
        if (result.success) {
            res.json({ simulation: result.simulation })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route simulate pricing:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/pricing/create-subscription - Créer un abonnement avec tarification
router.post('/create-subscription', async (req, res) => {
    try {
        const subscriptionData = req.body
        
        // Validation des données requises
        if (!subscriptionData.user_id || !subscriptionData.type_abonnement) {
            return res.status(400).json({
                error: 'ID utilisateur et type d\'abonnement requis'
            })
        }

        const result = await PricingService.createSubscriptionWithPricing(subscriptionData)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Abonnement créé avec succès',
                subscription: result.subscription 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route create subscription:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/pricing/update-subscription/:id - Mettre à jour le tarif d'un abonnement
router.put('/update-subscription/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { superficie } = req.body
        
        if (!superficie || superficie <= 0) {
            return res.status(400).json({
                error: 'Superficie valide requise'
            })
        }

        const result = await PricingService.updateSubscriptionPricing(id, superficie)
        
        if (result.success) {
            res.json({ 
                message: 'Tarif mis à jour',
                subscription: result.subscription 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route update subscription pricing:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/pricing/history/:userId - Historique des tarifs d'un utilisateur
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params
        
        const result = await PricingService.getPricingHistory(userId)
        
        if (result.success) {
            res.json({ history: result.history })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route pricing history:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/pricing/calculator - Calculateur interactif
router.get('/calculator', (req, res) => {
    try {
        const { superficie } = req.query
        
        if (!superficie) {
            return res.json({
                message: 'Calculateur de tarifs propriétaire',
                instructions: 'Ajoutez ?superficie=XXXX pour calculer un tarif',
                paliers: [
                    { range: '0-1000 m²', rate: '1000 XAF + 2 XAF/m²', example: '500m² = 2000 XAF' },
                    { range: '1001-5000 m²', rate: '1000 XAF + 1.5 XAF/m²', example: '3000m² = 5500 XAF' },
                    { range: '5001-10000 m²', rate: '1000 XAF + 1 XAF/m²', example: '8000m² = 9000 XAF' },
                    { range: 'Plus de 10000 m²', rate: '1000 XAF + 0.5 XAF/m²', example: '15000m² = 8500 XAF' }
                ]
            })
        }

        const superficieNum = parseFloat(superficie)
        if (isNaN(superficieNum) || superficieNum <= 0) {
            return res.status(400).json({
                error: 'Superficie invalide'
            })
        }

        const result = PricingService.calculateDetailedPricing(superficieNum)
        res.json({ calculator: result.pricing })
    } catch (error) {
        console.error('Erreur route calculator:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/pricing/comparison - Comparaison des tarifs
router.get('/comparison', (req, res) => {
    try {
        const superficies = [500, 1500, 3000, 7500, 15000]
        const comparisons = superficies.map(superficie => {
            const result = PricingService.calculateDetailedPricing(superficie)
            return {
                superficie,
                ...result.pricing
            }
        })

        res.json({
            message: 'Comparaison des tarifs par superficie',
            comparisons,
            clientPricing: PricingService.getClientPricing().pricing
        })
    } catch (error) {
        console.error('Erreur route comparison:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router