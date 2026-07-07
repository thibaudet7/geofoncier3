const express = require('express')
const router = express.Router()
const { supabase } = require('../supabase-config')
const { SpatialService } = require('../services/SpatialService')
const { NotificationService } = require('../services/NotificationService')
const { authenticateUser, requireAdmin } = require('../middleware/auth')

// Appliquer auth + admin à toutes les routes
router.use(authenticateUser, requireAdmin)

// ================================
// DEMANDES DE CONTACT
// ================================

// GET /api/admin/contacts
router.get('/contacts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('contacts')
            .select(`
                *,
                client:client_id(nom_complet, email, telephone),
                proprietaire:proprietaire_id(nom_complet, email, telephone),
                parcelle:parcelle_id(matricule, quartier_village, prix_m2)
            `)
            .order('date_contact', { ascending: false })

        if (error) throw error
        res.json({ contacts: data })
    } catch (error) {
        console.error('Erreur admin contacts:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                *,
                contact:contact_id(
                    client:client_id(nom_complet),
                    proprietaire:proprietaire_id(nom_complet),
                    parcelle:parcelle_id(matricule)
                )
            `)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.json({ transactions: data })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// STATISTIQUES
// ================================

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        const [usersResult, parcellesResult, contactsResult] = await Promise.all([
            supabase.from('users').select('type_utilisateur', { count: 'exact' }),
            supabase.from('parcelles').select('activite', { count: 'exact' }).eq('is_active', true),
            supabase.from('contacts').select('statut', { count: 'exact' })
        ])

        // Contacts par statut
        const { data: contactsByStatus } = await supabase
            .from('contacts')
            .select('statut')

        const statusCounts = {}
        ;(contactsByStatus || []).forEach(c => {
            statusCounts[c.statut] = (statusCounts[c.statut] || 0) + 1
        })

        const stats = {
            users: { total: usersResult.count },
            parcelles: { total: parcellesResult.count },
            contacts: { total: contactsResult.count, by_status: statusCounts }
        }

        res.json({ stats })
    } catch (error) {
        console.error('Erreur admin stats:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/visits/weekly - visites par semaine
router.get('/visits/weekly', async (req, res) => {
    try {
        const { data, error } = await supabase.rpc('get_weekly_visits')

        if (error) {
            // Fallback si la fonction RPC n'existe pas
            const { data: visits, error: fallbackError } = await supabase
                .from('site_visits')
                .select('created_at')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })

            if (fallbackError) throw fallbackError

            // Agréger par semaine côté serveur
            const weeklyMap = {}
            ;(visits || []).forEach(v => {
                const date = new Date(v.created_at)
                const weekStart = new Date(date)
                weekStart.setDate(date.getDate() - date.getDay())
                const key = weekStart.toISOString().split('T')[0]
                weeklyMap[key] = (weeklyMap[key] || 0) + 1
            })

            const weekly = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }))
            return res.json({ weekly })
        }

        res.json({ weekly: data })
    } catch (error) {
        console.error('Erreur admin visits:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// GESTION DES PARCELLES (ADMIN)
// ================================

// PUT /api/admin/parcelles/:id - Éditer une parcelle
router.put('/parcelles/:id', async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body

        // Récupérer le propriétaire actuel
        const { data: parcelle, error: fetchError } = await supabase
            .from('parcelles')
            .select('proprietaire_id, matricule')
            .eq('id', id)
            .single()

        if (fetchError) throw fetchError

        // Mettre à jour la parcelle
        const { data, error } = await supabase
            .from('parcelles')
            .update(updateData)
            .eq('id', id)
            .select()

        if (error) throw error

        // Notifier le propriétaire
        if (parcelle.proprietaire_id) {
            await NotificationService.createNotification(
                parcelle.proprietaire_id,
                'parcelle_edited',
                'Votre parcelle a été modifiée',
                `L'administrateur a modifié les informations de votre parcelle ${parcelle.matricule}.`,
                { parcelle_id: id }
            )
        }

        res.json({ message: 'Parcelle mise à jour', parcelle: data[0] })
    } catch (error) {
        console.error('Erreur admin edit parcelle:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// DELETE /api/admin/parcelles/:id - Supprimer une parcelle
router.delete('/parcelles/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Supprimer les documents associés
        await supabase.from('parcelle_documents').delete().eq('parcelle_id', id)
        await supabase.from('parcelle_images').delete().eq('parcelle_id', id)
        await supabase.from('favorites').delete().eq('parcelle_id', id)

        // Supprimer la parcelle
        const { error } = await supabase
            .from('parcelles')
            .delete()
            .eq('id', id)

        if (error) throw error

        res.json({ message: 'Parcelle supprimée' })
    } catch (error) {
        console.error('Erreur admin delete parcelle:', error)
        res.status(500).json({ error: error.message || 'Erreur serveur' })
    }
})

// POST /api/admin/transactions/transfer - Transfert de propriété
router.post('/transactions/transfer', async (req, res) => {
    try {
        const { parcelle_id, buyer_id, contact_id } = req.body

        if (!parcelle_id || !buyer_id) {
            return res.status(400).json({ error: 'parcelle_id et buyer_id requis' })
        }

        // Récupérer l'ancien propriétaire
        const { data: parcelle, error: fetchError } = await supabase
            .from('parcelles')
            .select('proprietaire_id, matricule')
            .eq('id', parcelle_id)
            .single()

        if (fetchError) throw fetchError

        const oldOwnerId = parcelle.proprietaire_id

        // Transférer la propriété
        const { error: updateError } = await supabase
            .from('parcelles')
            .update({ proprietaire_id: buyer_id })
            .eq('id', parcelle_id)

        if (updateError) throw updateError

        // Créer l'enregistrement de transaction
        const transactionData = { parcelle_id, buyer_id, seller_id: oldOwnerId }
        if (contact_id) transactionData.contact_id = contact_id

        const { error: txError } = await supabase
            .from('transactions')
            .insert([transactionData])

        if (txError) {
            console.error('Erreur insert transaction (non-bloquant):', txError)
        }

        // Mettre à jour le contact si fourni
        if (contact_id) {
            await supabase
                .from('contacts')
                .update({ statut: 'completed', updated_at: new Date().toISOString() })
                .eq('id', contact_id)
        }

        // Notifier l'ancien propriétaire
        await NotificationService.createNotification(
            oldOwnerId,
            'ownership_transfer',
            'Vente de votre parcelle confirmée',
            `La vente de votre parcelle ${parcelle.matricule} a été enregistrée. Le transfert de propriété est effectif.`,
            { parcelle_id }
        )

        // Notifier le nouveau propriétaire
        await NotificationService.createNotification(
            buyer_id,
            'ownership_transfer',
            'Achat de parcelle confirmé',
            `Vous êtes maintenant propriétaire de la parcelle ${parcelle.matricule}. Félicitations !`,
            { parcelle_id }
        )

        res.json({ message: 'Transfert de propriété effectué', parcelle_id, new_owner: buyer_id })
    } catch (error) {
        console.error('Erreur admin transfer:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ABONNEMENTS (historique complet)
// ================================

// GET /api/admin/subscriptions - Historique de tous les abonnements
router.get('/subscriptions', async (req, res) => {
    try {
        const { type, statut } = req.query
        let query = supabase
            .from('subscriptions')
            .select(`
                *,
                user:user_id(nom_complet, email, telephone, type_utilisateur)
            `)
            .order('created_at', { ascending: false })

        if (type) query = query.eq('type_abonnement', type)
        if (statut) query = query.eq('statut', statut)

        const { data, error } = await query

        if (error) throw error
        res.json({ subscriptions: data || [] })
    } catch (error) {
        console.error('Erreur admin subscriptions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/subscriptions/stats - Statistiques abonnements
router.get('/subscriptions/stats', async (req, res) => {
    try {
        const { data: allSubs, error } = await supabase
            .from('subscriptions')
            .select('type_abonnement, statut, montant')

        if (error) throw error

        const stats = {
            total: allSubs.length,
            active: allSubs.filter(s => s.statut === 'active').length,
            pending: allSubs.filter(s => s.statut === 'pending').length,
            expired: allSubs.filter(s => s.statut === 'expired').length,
            cancelled: allSubs.filter(s => s.statut === 'cancelled').length,
            revenue_total: allSubs.filter(s => s.statut === 'active').reduce((sum, s) => sum + (s.montant || 0), 0),
            by_type: {
                client: allSubs.filter(s => s.type_abonnement === 'client').length,
                proprietaire: allSubs.filter(s => s.type_abonnement === 'proprietaire').length
            }
        }

        res.json({ stats })
    } catch (error) {
        console.error('Erreur admin subscriptions stats:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES GÉOGRAPHIQUES (EXISTANTES)
// ================================

router.get('/regions', async (req, res) => {
    try {
        const result = await SpatialService.getCachedRegions()
        if (result.success) res.json({ regions: result.regions })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/regions/:id/details', async (req, res) => {
    try {
        const result = await SpatialService.getDetailedRegionStats(req.params.id)
        if (result.success) res.json({ details: result.stats })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/geographic-report', async (req, res) => {
    try {
        const result = await SpatialService.generateGeographicReport()
        if (result.success) res.json({ report: result.report })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/validate-data', async (req, res) => {
    try {
        const result = await SpatialService.validateGeographicData()
        if (result.success) res.json({ validation: result.issues, hasIssues: result.issues && result.issues.length > 0 })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.post('/refresh-cache', async (req, res) => {
    try {
        const result = await SpatialService.refreshMaterializedViews()
        if (result.success) res.json({ message: result.message })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.post('/optimize-geometries', async (req, res) => {
    try {
        const { tolerance = 0.001 } = req.body
        const result = await SpatialService.optimizeGeometries(tolerance)
        if (result.success) res.json({ message: result.message })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/cleanup-report', async (req, res) => {
    try {
        const result = await SpatialService.cleanupOrphanedData()
        if (result.success) res.json({ report: result.report })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.post('/compare-regions', async (req, res) => {
    try {
        const { regionIds } = req.body
        if (!regionIds || !Array.isArray(regionIds) || regionIds.length < 2) {
            return res.status(400).json({ error: 'Au moins 2 IDs de régions requis' })
        }
        const result = await SpatialService.getRegionComparison(regionIds)
        if (result.success) res.json({ comparison: result.comparisons })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/border-parcelles', async (req, res) => {
    try {
        const { distance = 1000 } = req.query
        const result = await SpatialService.getBorderParcelles(parseInt(distance))
        if (result.success) res.json({ borderParcelles: result.borderParcelles })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/multi-region-parcelles', async (req, res) => {
    try {
        const result = await SpatialService.getMultiRegionParcelles()
        if (result.success) res.json({ multiRegionParcelles: result.multiRegionParcelles })
        else res.status(400).json({ error: result.error })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/export/regions', async (req, res) => {
    try {
        const { format = 'geojson' } = req.query
        if (format === 'geojson') {
            const result = await SpatialService.exportRegionsGeoJSON()
            if (result.success) {
                res.setHeader('Content-Type', 'application/geo+json')
                res.setHeader('Content-Disposition', 'attachment; filename="regions-cameroun-admin.geojson"')
                res.json(result.geojson)
            } else res.status(400).json({ error: result.error })
        } else {
            res.status(400).json({ error: 'Format non supporté' })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

router.get('/export/full-report', async (req, res) => {
    try {
        const [geoReport, statsReport, validationReport] = await Promise.all([
            SpatialService.generateGeographicReport(),
            SpatialService.getStatsByRegion(),
            SpatialService.validateGeographicData()
        ])
        const fullReport = {
            generated_at: new Date().toISOString(),
            geographic_report: geoReport.success ? geoReport.report : null,
            regional_stats: statsReport.success ? statsReport.stats : null,
            validation_issues: validationReport.success ? validationReport.issues : null
        }
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', 'attachment; filename="geofoncier-admin-report.json"')
        res.json(fullReport)
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const { type, verified } = req.query
        let query = supabase.from('users').select('*').order('created_at', { ascending: false })
        if (type) query = query.eq('type_utilisateur', type)
        if (verified !== undefined) query = query.eq('is_verified', verified === 'true')
        const { data, error } = await query
        if (error) throw error
        res.json({ users: data })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router
