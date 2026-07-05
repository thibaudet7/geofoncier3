// api/routes/payment.js
const express = require('express')
const router = express.Router()
const { FlutterwaveService } = require('../services/FlutterwaveService')
const { authenticateUser } = require('../middleware/auth')
const { supabase } = require('../supabase-config')

// POST /api/payment/initiate (authentifié)
router.post('/initiate', authenticateUser, async (req, res) => {
    try {
        const paymentData = req.body
        paymentData.user_id = req.user.id

        if (!paymentData.amount || !paymentData.customer) {
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

// GET /api/payment/subscription-status (authentifié) - vérifier abonnement actif
router.get('/subscription-status', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', req.user.id)
            .eq('statut', 'active')
            .gte('date_fin', new Date().toISOString().split('T')[0])
            .order('date_fin', { ascending: false })
            .limit(1)

        if (error) throw error

        const hasActive = data && data.length > 0
        res.json({
            has_active_subscription: hasActive,
            subscription: hasActive ? data[0] : null
        })
    } catch (error) {
        console.error('Erreur vérification abonnement:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/payment/my-subscriptions (authentifié) - historique abonnements utilisateur
router.get('/my-subscriptions', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.json({ subscriptions: data || [] })
    } catch (error) {
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

// GET /api/payment/callback - retour Flutterwave après paiement
router.get('/callback', async (req, res) => {
    try {
        const { transaction_id, tx_ref, status } = req.query

        if (status === 'successful' && transaction_id) {
            const verification = await FlutterwaveService.verifyPayment(transaction_id)

            if (verification.success) {
                await supabase
                    .from('subscriptions')
                    .update({
                        statut: 'active',
                        flutterwave_transaction_id: String(transaction_id)
                    })
                    .eq('flutterwave_transaction_id', tx_ref)
            }
        } else if (status === 'cancelled' && tx_ref) {
            await supabase
                .from('subscriptions')
                .update({ statut: 'cancelled' })
                .eq('flutterwave_transaction_id', tx_ref)
        }

        // Rediriger vers le frontend avec le résultat
        res.redirect(`/?payment=${status}&tx_ref=${tx_ref || ''}`)
    } catch (error) {
        console.error('Erreur callback paiement:', error)
        res.redirect('/?payment=error')
    }
})

module.exports = router