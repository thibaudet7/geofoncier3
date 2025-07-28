// api/services/PricingService.js - Service pour la gestion des nouveaux tarifs
const { supabase } = require('../supabase-config')

class PricingService {
    
    // Calculer le tarif pour un propriétaire selon la nouvelle grille
    static async calculateProprietairePricing(superficie) {
        try {
            const { data, error } = await supabase
                .rpc('calculate_proprietaire_pricing', { superficie })

            if (error) throw error

            return { 
                success: true, 
                pricing: data[0] 
            }
        } catch (error) {
            console.error('Erreur calcul tarif propriétaire:', error)
            return { success: false, error: error.message }
        }
    }

    // Obtenir tous les paliers tarifaires
    static async getPricingTiers() {
        try {
            const { data, error } = await supabase
                .from('pricing_tiers')
                .select('*')
                .eq('is_active', true)
                .order('user_type, min_superficie')

            if (error) throw error

            // Organiser par type d'utilisateur
            const tiers = {
                proprietaire: data.filter(t => t.user_type === 'proprietaire'),
                client: data.filter(t => t.user_type === 'client')
            }

            return { success: true, tiers }
        } catch (error) {
            console.error('Erreur récupération paliers:', error)
            return { success: false, error: error.message }
        }
    }

    // Calculer le tarif détaillé avec explication
    static calculateDetailedPricing(superficie) {
        const basePrice = 1000
        let pricePerM2, tierName, tierDescription

        if (superficie <= 1000) {
            pricePerM2 = 2
            tierName = 'Palier 1 (0-1000 m²)'
            tierDescription = 'Tarif standard pour petites parcelles'
        } else if (superficie <= 5000) {
            pricePerM2 = 1.5
            tierName = 'Palier 2 (1001-5000 m²)'
            tierDescription = 'Tarif réduit pour parcelles moyennes'
        } else if (superficie <= 10000) {
            pricePerM2 = 1
            tierName = 'Palier 3 (5001-10000 m²)'
            tierDescription = 'Tarif préférentiel pour grandes parcelles'
        } else {
            pricePerM2 = 0.5
            tierName = 'Palier 4 (Plus de 10000 m²)'
            tierDescription = 'Tarif très avantageux pour très grandes parcelles'
        }

        const monthlyPrice = basePrice + (superficie * pricePerM2)
        const annualPrice = monthlyPrice * 12 * 0.9 // 10% de réduction

        return {
            success: true,
            pricing: {
                superficie,
                tierName,
                tierDescription,
                basePrice,
                pricePerM2,
                monthlyPrice: Math.ceil(monthlyPrice),
                annualPrice: Math.ceil(annualPrice),
                annualSavings: Math.ceil(monthlyPrice * 12 - annualPrice),
                calculation: `${basePrice} XAF + (${superficie} m² × ${pricePerM2} XAF/m²) = ${Math.ceil(monthlyPrice)} XAF/mois`,
                breakdown: {
                    base: basePrice,
                    superficie: superficie * pricePerM2,
                    total: monthlyPrice
                }
            }
        }
    }

    // Obtenir les tarifs clients
    static getClientPricing() {
        return {
            success: true,
            pricing: {
                afrique: {
                    mensuel: {
                        price: 5000,
                        currency: 'XAF',
                        description: 'Accès complet à la plateforme'
                    },
                    annuel: {
                        price: 50000,
                        currency: 'XAF',
                        description: 'Économisez 2 mois (10000 XAF)',
                        savings: 10000
                    }
                },
                hors_afrique: {
                    mensuel: {
                        price: 50000,
                        currency: 'XAF',
                        description: 'Accès complet à la plateforme'
                    },
                    annuel: {
                        price: 500000,
                        currency: 'XAF',
                        description: 'Économisez 2 mois (100000 XAF)',
                        savings: 100000
                    }
                }
            }
        }
    }

    // Créer un abonnement avec le nouveau système de tarification
    static async createSubscriptionWithPricing(subscriptionData) {
        try {
            let calculatedPrice = subscriptionData.montant
            let tierName = null

            // Si c'est un propriétaire, calculer le tarif selon la superficie
            if (subscriptionData.type_abonnement === 'proprietaire_superficie') {
                if (!subscriptionData.superficie_declaree) {
                    throw new Error('Superficie requise pour les propriétaires')
                }

                const pricingResult = this.calculateDetailedPricing(subscriptionData.superficie_declaree)
                if (!pricingResult.success) {
                    throw new Error('Erreur calcul tarif')
                }

                calculatedPrice = subscriptionData.period === 'annuel' 
                    ? pricingResult.pricing.annualPrice 
                    : pricingResult.pricing.monthlyPrice
                
                tierName = pricingResult.pricing.tierName
            }

            // Créer l'abonnement
            const { data, error } = await supabase
                .from('subscriptions')
                .insert([{
                    ...subscriptionData,
                    montant: calculatedPrice,
                    tarif_calcule: calculatedPrice,
                    palier_tarifaire: tierName,
                    documents_required: subscriptionData.type_abonnement === 'proprietaire_superficie',
                    documents_complete: false
                }])
                .select()

            if (error) throw error

            return { success: true, subscription: data[0] }
        } catch (error) {
            console.error('Erreur création abonnement:', error)
            return { success: false, error: error.message }
        }
    }

    // Simuler un tarif avant création d'abonnement
    static simulateSubscriptionPricing(userType, region, period, superficie = null) {
        try {
            if (userType === 'proprietaire') {
                if (!superficie) {
                    throw new Error('Superficie requise pour simulation propriétaire')
                }

                const result = this.calculateDetailedPricing(superficie)
                const price = period === 'annuel' ? result.pricing.annualPrice : result.pricing.monthlyPrice

                return {
                    success: true,
                    simulation: {
                        userType,
                        period,
                        superficie,
                        price,
                        currency: 'XAF',
                        tierName: result.pricing.tierName,
                        calculation: result.pricing.calculation,
                        savings: period === 'annuel' ? result.pricing.annualSavings : 0
                    }
                }
            } else {
                // Client
                const clientPricing = this.getClientPricing()
                const regionPricing = region === 'afrique' ? clientPricing.pricing.afrique : clientPricing.pricing.hors_afrique
                const periodPricing = regionPricing[period]

                return {
                    success: true,
                    simulation: {
                        userType,
                        region,
                        period,
                        price: periodPricing.price,
                        currency: periodPricing.currency,
                        description: periodPricing.description,
                        savings: periodPricing.savings || 0
                    }
                }
            }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    // Mettre à jour les tarifs d'un abonnement existant
    static async updateSubscriptionPricing(subscriptionId, newSuperficie) {
        try {
            // Récupérer l'abonnement
            const { data: subscription, error: fetchError } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('id', subscriptionId)
                .single()

            if (fetchError) throw fetchError

            // Recalculer le tarif
            const pricingResult = this.calculateDetailedPricing(newSuperficie)
            if (!pricingResult.success) {
                throw new Error('Erreur recalcul tarif')
            }

            const newPrice = subscription.period === 'annuel' 
                ? pricingResult.pricing.annualPrice 
                : pricingResult.pricing.monthlyPrice

            // Mettre à jour
            const { data, error } = await supabase
                .from('subscriptions')
                .update({
                    superficie_declaree: newSuperficie,
                    montant: newPrice,
                    tarif_calcule: newPrice,
                    palier_tarifaire: pricingResult.pricing.tierName
                })
                .eq('id', subscriptionId)
                .select()

            if (error) throw error

            return { success: true, subscription: data[0] }
        } catch (error) {
            console.error('Erreur mise à jour tarif:', error)
            return { success: false, error: error.message }
        }
    }

    // Obtenir l'historique des tarifs
    static async getPricingHistory(userId) {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select(`
                    id,
                    type_abonnement,
                    montant,
                    tarif_calcule,
                    palier_tarifaire,
                    superficie_declaree,
                    created_at,
                    statut
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })

            if (error) throw error

            return { success: true, history: data }
        } catch (error) {
            console.error('Erreur historique tarifs:', error)
            return { success: false, error: error.message }
        }
    }
}

module.exports = { PricingService }