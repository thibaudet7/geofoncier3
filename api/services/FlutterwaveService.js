// api/services/FlutterwaveService.js
const { supabase } = require('../supabase-config')
const crypto = require('crypto')

class FlutterwaveService {
    
    static getSubscriptionPricing() {
        return {
            client_mensuel_afrique: { amount: 5000, currency: 'XAF' },
            client_annuel_afrique: { amount: 50000, currency: 'XAF' },
            client_mensuel_hors_afrique: { amount: 50000, currency: 'XAF' },
            client_annuel_hors_afrique: { amount: 500000, currency: 'XAF' }
        }
    }

    // Grille tarifaire officielle propriétaire (tarif ANNUEL uniquement, il n'existe pas
    // de tarif mensuel pour ce type d'abonnement) :
    //   ≤ 500 m²            : 5 000 XAF
    //   501 m² à 5 000 m²   : 7 000 XAF / tranche de 1 000 m² entamée
    //   5 001 m² à 1 ha     : 45 000 XAF
    //   1,01 ha à 10 ha     : 60 000 XAF
    //   > 10 ha             : 60 000 XAF + 65 000 XAF par tranche de 10 ha entamée au-delà de 10 ha
    static calculateProprietairePrice(superficie) {
        const M2_PAR_HA = 10000
        let annual

        if (superficie <= 500) {
            annual = 5000
        } else if (superficie <= 5000) {
            const tranches = Math.ceil(superficie / 1000)
            annual = tranches * 7000
        } else if (superficie <= M2_PAR_HA) {
            annual = 45000
        } else if (superficie <= 10 * M2_PAR_HA) {
            annual = 60000
        } else {
            const surplus = superficie - 10 * M2_PAR_HA
            const tranchesSupplementaires = Math.ceil(surplus / (10 * M2_PAR_HA))
            annual = 60000 + tranchesSupplementaires * 65000
        }

        return {
            annual,
            currency: 'XAF'
        }
    }

    static async initiatePayment(paymentData) {
        try {
            if (!supabase) throw new Error('Client Supabase non initialisé (SUPABASE_SERVICE_KEY manquante)')

            const tx_ref = `geofoncier_${Date.now()}`

            const flutterwaveConfig = {
                public_key: process.env.FLUTTERWAVE_PUBLIC_KEY,
                tx_ref: tx_ref,
                amount: paymentData.amount,
                currency: paymentData.currency || 'XAF',
                country: 'CM',
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