// api/routes/payment.js
const express = require('express')
const router = express.Router()
const { FlutterwaveService } = require('../services/FlutterwaveService')

// POST /api/payment/initiate
router.post('/initiate', async (req, res) => {
    try {
        const paymentData = req.body
        
        // Validation des données de paiement
        if (!paymentData.user_id || !paymentData.amount || !paymentData.customer) {
            return res.status(400).json({
                error: 'Données de paiement incomplètes'
            })
        }

        const result = await FlutterwaveService.initiatePayment(paymentData)
        
        if (result.success) {
            res.json({ 
                payment_config: result.config,
                subscription_id: result.subscription_id
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur initiation paiement:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/payment/webhook
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['verif-hash']
        const payload = req.body
        
        // Vérifier la signature webhook Flutterwave
        if (!FlutterwaveService.verifyWebhookSignature(payload, signature)) {
            return res.status(401).json({
                error: 'Signature webhook invalide'
            })
        }

        const result = await FlutterwaveService.handlePaymentCallback(payload)
        
        res.json({ message: 'Webhook traité', result })
    } catch (error) {
        console.error('Erreur webhook paiement:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/payment/verify/:transactionId
router.get('/verify/:transactionId', async (req, res) => {
    try {
        const { transactionId } = req.params
        
        const result = await FlutterwaveService.verifyPayment(transactionId)
        
        if (result.success) {
            res.json({ verified: true, data: result.data })
        } else {
            res.json({ verified: false, error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/payment/pricing
router.get('/pricing', (req, res) => {
    try {
        const pricing = FlutterwaveService.getSubscriptionPricing()
        res.json({ pricing })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/payment/calculate-proprietaire
router.post('/calculate-proprietaire', (req, res) => {
    try {
        const { superficie } = req.body
        
        if (!superficie || superficie <= 0) {
            return res.status(400).json({
                error: 'Superficie valide requise'
            })
        }

        const pricing = FlutterwaveService.calculateProprietairePrice(superficie)
        res.json({ pricing })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router