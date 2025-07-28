// api/services/FlutterwaveService.js
const { supabase } = require('../supabase-config')
const crypto = require('crypto')

class FlutterwaveService {
    
    static getSubscriptionPricing() {
        return {
            client_mensuel_afrique: { amount: 5000, currency: 'XAF', description: 'Abonnement mensuel Afrique' },
            client_annuel_afrique: { amount: 50000, currency: 'XAF', description: 'Abonnement annuel Afrique (2 mois gratuits)' },
            client_mensuel_hors_afrique: { amount: 50000, currency: 'XAF', description: 'Abonnement mensuel hors Afrique' },
            client_annuel_hors_afrique: { amount: 500000, currency: 'XAF', description: 'Abonnement annuel hors Afrique (2 mois gratuits)' }
        }
    }

    static calculateProprietairePrice(superficie) {
        const basePrice = 1000
        let pricePerM2

        // Nouveau système de paliers
        if (superficie <= 1000) {
            pricePerM2 = 2
        } else if (superficie <= 5000) {
            pricePerM2 = 1.5
        } else if (superficie <= 10000) {
            pricePerM2 = 1
        } else {
            pricePerM2 = 0.5
        }

        const monthlyPrice = basePrice + (superficie * pricePerM2)
        const annualPrice = monthlyPrice * 12 * 0.9 // 10% de réduction

        return {
            monthly: Math.ceil(monthlyPrice),
            annual: Math.ceil(annualPrice),
            basePrice,
            pricePerM2,
            superficie,
            savings: Math.ceil(monthlyPrice * 12 - annualPrice)
        }
    }

    static async initiatePayment(paymentData) {
        try {
            const tx_ref = `geofoncier_${Date.now()}`
            
            const flutterwaveConfig = {
                public_key: process.env.FLUTTERWAVE_PUBLIC_KEY,
                tx_ref: tx_ref,
                amount: paymentData.amount,
                currency: paymentData.currency || 'XAF',
                payment_options: 'card,mobilemoney,ussd',
                customer: {
                    email: paymentData.customer.email,
                    phone_number: paymentData.customer.phone,
                    name: paymentData.customer.name,
                },
                customizations: {
                    title: 'GéoFoncier',
                    description: paymentData.description,
                    logo: `${process.env.APP_URL}/images/logo.png`,
                },
                redirect_url: `${process.env.APP_URL}/payment/callback`,
                meta: {
                    user_id: paymentData.user_id,
                    subscription_type: paymentData.subscription_type
                }
            }

            // Sauvegarder la transaction en attente
            const { data, error } = await supabase
                .from('subscriptions')
                .insert([{
                    user_id: paymentData.user_id,
                    type_abonnement: paymentData.subscription_type,
                    montant: paymentData.amount,
                    devise: paymentData.currency || 'XAF',
                    date_debut: new Date().toISOString().split('T')[0],
                    date_fin: paymentData.end_date,
                    statut: 'pending',
                    flutterwave_transaction_id: tx_ref
                }])
                .select()

            if (error) throw error

            return { success: true, config: flutterwaveConfig, subscription_id: data[0].id }
        } catch (error) {
            console.error('Erreur initiation paiement:', error)
            return { success: false, error: error.message }
        }
    }

    static async handlePaymentCallback(response) {
        try {
            if (response.status === 'successful') {
                // Vérifier le paiement avec l'API Flutterwave
                const verification = await this.verifyPayment(response.transaction_id)
                
                if (verification.success) {
                    // Mettre à jour le statut de l'abonnement
                    const { error } = await supabase
                        .from('subscriptions')
                        .update({ 
                            statut: 'active',
                            flutterwave_transaction_id: response.transaction_id
                        })
                        .eq('flutterwave_transaction_id', response.tx_ref)

                    if (error) throw error

                    return { success: true, message: 'Paiement confirmé' }
                }
            }
            
            return { success: false, message: 'Paiement échoué' }
        } catch (error) {
            console.error('Erreur callback paiement:', error)
            return { success: false, error: error.message }
        }
    }

    static async verifyPayment(transactionId) {
        try {
            const response = await fetch(
                `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            )

            const data = await response.json()
            
            return { 
                success: data.status === 'success' && data.data.status === 'successful',
                data: data.data
            }
        } catch (error) {
            console.error('Erreur vérification paiement:', error)
            return { success: false, error: error.message }
        }
    }

    static verifyWebhookSignature(payload, signature) {
        const hash = crypto
            .createHmac('sha256', process.env.FLUTTERWAVE_SECRET_KEY)
            .update(JSON.stringify(payload))
            .digest('hex')
        
        return hash === signature
    }
}

module.exports = { FlutterwaveService }