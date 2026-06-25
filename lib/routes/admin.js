// api/routes/admin.js - MISE À JOUR AVEC RÉGIONS
const express = require('express')
const router = express.Router()
const { supabase } = require('../supabase-config')
const { SpatialService } = require('../services/SpatialService')

// ================================
// ROUTES EXISTANTES (INCHANGÉES)
// ================================

// GET /api/admin/contacts
router.get('/contacts', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('contacts')
            .select(`
                *,
                client:client_id(nom_complet, email),
                proprietaire:proprietaire_id(nom_complet, telephone),
                parcelle:parcelle_id(matricule, quartier_village)
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
// ROUTES STATISTIQUES MISES À JOUR
// ================================

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
    try {
        // Statistiques générales
        const [usersResult, parcellesResult, contactsResult, regionsResult] = await Promise.all([
            supabase.from('users').select('type_utilisateur', { count: 'exact' }),
            supabase.from('parcelles').select('activite', { count: 'exact' }).eq('is_active', true),
            supabase.from('contacts').select('statut', { count: 'exact' }),
            supabase.from('regions').select('id_region', { count: 'exact' })
        ])

        const stats = {
            users: {
                total: usersResult.count,
                by_type: {}
            },
            parcelles: {
                total: parcellesResult.count,
                by_activity: {}
            },
            contacts: {
                total: contactsResult.count,
                by_status: {}
            },
            geography: {
                regions: regionsResult.count,
                departements: 0,
                arrondissements: 0
            }
        }

        // Compter départements et arrondissements
        const [deptsResult, arrsResult] = await Promise.all([
            supabase.from('departements').select('id_departement', { count: 'exact' }),
            supabase.from('arrondissements').select('id_arrondissement', { count: 'exact' })
        ])

        stats.geography.departements = deptsResult.count
        stats.geography.arrondissements = arrsResult.count

        res.json({ stats })
    } catch (error) {
        console.error('Erreur admin stats:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// NOUVELLES ROUTES POUR LES RÉGIONS
// ================================

// GET /api/admin/regions
router.get('/regions', async (req, res) => {
    try {
        const result = await SpatialService.getCachedRegions()
        
        if (result.success) {
            res.json({ regions: result.regions })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/regions/:id/details
router.get('/regions/:id/details', async (req, res) => {
    try {
        const { id } = req.params
        const result = await SpatialService.getDetailedRegionStats(id)
        
        if (result.success) {
            res.json({ details: result.stats })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin region details:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/geographic-report
router.get('/geographic-report', async (req, res) => {
    try {
        const result = await SpatialService.generateGeographicReport()
        
        if (result.success) {
            res.json({ report: result.report })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin geographic report:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/validate-data
router.get('/validate-data', async (req, res) => {
    try {
        const result = await SpatialService.validateGeographicData()
        
        if (result.success) {
            res.json({ 
                validation: result.issues,
                hasIssues: result.issues && result.issues.length > 0
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin validate data:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES DE MAINTENANCE ADMIN
// ================================

// POST /api/admin/refresh-cache
router.post('/refresh-cache', async (req, res) => {
    try {
        const result = await SpatialService.refreshMaterializedViews()
        
        if (result.success) {
            res.json({ message: result.message })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin refresh cache:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/admin/optimize-geometries
router.post('/optimize-geometries', async (req, res) => {
    try {
        const { tolerance = 0.001 } = req.body
        const result = await SpatialService.optimizeGeometries(tolerance)
        
        if (result.success) {
            res.json({ message: result.message })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin optimize geometries:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/cleanup-report
router.get('/cleanup-report', async (req, res) => {
    try {
        const result = await SpatialService.cleanupOrphanedData()
        
        if (result.success) {
            res.json({ report: result.report })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin cleanup report:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR L'ANALYSE COMPARATIVE
// ================================

// POST /api/admin/compare-regions
router.post('/compare-regions', async (req, res) => {
    try {
        const { regionIds } = req.body
        
        if (!regionIds || !Array.isArray(regionIds) || regionIds.length < 2) {
            return res.status(400).json({
                error: 'Au moins 2 IDs de régions requis'
            })
        }

        const result = await SpatialService.getRegionComparison(regionIds)
        
        if (result.success) {
            res.json({ comparison: result.comparisons })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin compare regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR LES PARCELLES SPÉCIALES
// ================================

// GET /api/admin/border-parcelles
router.get('/border-parcelles', async (req, res) => {
    try {
        const { distance = 1000 } = req.query
        const result = await SpatialService.getBorderParcelles(parseInt(distance))
        
        if (result.success) {
            res.json({ borderParcelles: result.borderParcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin border parcelles:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/multi-region-parcelles
router.get('/multi-region-parcelles', async (req, res) => {
    try {
        const result = await SpatialService.getMultiRegionParcelles()
        
        if (result.success) {
            res.json({ multiRegionParcelles: result.multiRegionParcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur admin multi region parcelles:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR LES EXPORTS ADMIN
// ================================

// GET /api/admin/export/regions
router.get('/export/regions', async (req, res) => {
    try {
        const { format = 'geojson' } = req.query
        
        if (format === 'geojson') {
            const result = await SpatialService.exportRegionsGeoJSON()
            
            if (result.success) {
                res.setHeader('Content-Type', 'application/geo+json')
                res.setHeader('Content-Disposition', 'attachment; filename="regions-cameroun-admin.geojson"')
                res.json(result.geojson)
            } else {
                res.status(400).json({ error: result.error })
            }
        } else {
            res.status(400).json({ error: 'Format non supporté' })
        }
    } catch (error) {
        console.error('Erreur admin export regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/admin/export/full-report
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
            validation_issues: validationReport.success ? validationReport.issues : null,
            summary: {
                total_issues: validationReport.success ? validationReport.issues.length : 0,
                system_health: validationReport.success && validationReport.issues.length === 0 ? 'Excellent' : 'À vérifier'
            }
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', 'attachment; filename="geofoncier-admin-report.json"')
        res.json(fullReport)
    } catch (error) {
        console.error('Erreur admin full report:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR LA GESTION DES UTILISATEURS (AMÉLIORÉES)
// ================================

// GET /api/admin/users
router.get('/users', async (req, res) => {
    try {
        const { type, region, verified } = req.query
        
        let query = supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })

        if (type) {
            query = query.eq('type_utilisateur', type)
        }
        
        if (verified !== undefined) {
            query = query.eq('is_verified', verified === 'true')
        }

        const { data, error } = await query

        if (error) throw error

        // Si filtre par région, croiser avec les parcelles
        let filteredData = data
        if (region && type === 'proprietaire') {
            const { data: parcelles } = await supabase
                .from('parcelles')
                .select(`
                    proprietaire_id,
                    arrondissements!inner(
                        departements!inner(
                            regions!inner(nom_region)
                        )
                    )
                `)
                .eq('arrondissements.departements.regions.nom_region', region)
                .eq('is_active', true)

            const proprietaireIds = [...new Set(parcelles?.map(p => p.proprietaire_id) || [])]
            filteredData = data.filter(user => proprietaireIds.includes(user.id))
        }

        res.json({ users: filteredData })
    } catch (error) {
        console.error('Erreur admin users:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router