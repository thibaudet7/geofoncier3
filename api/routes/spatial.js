// api/routes/spatial.js - VERSION COMPLÈTE AVEC RÉGIONS
const express = require('express')
const router = express.Router()
const { SpatialService } = require('../services/SpatialService')

// ================================
// ROUTES POUR LES RÉGIONS
// ================================

// GET /api/spatial/regions
router.get('/regions', async (req, res) => {
    try {
        const result = await SpatialService.getRegions()
        
        if (result.success) {
            res.json({ regions: result.regions })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/regions/:id
router.get('/regions/:id', async (req, res) => {
    try {
        const { id } = req.params
        const result = await SpatialService.getRegionById(id)
        
        if (result.success) {
            res.json({ region: result.region })
        } else {
            res.status(404).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route region by id:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/regions (Admin seulement)
router.post('/regions', async (req, res) => {
    try {
        const regionData = req.body
        
        if (!regionData.nom_region) {
            return res.status(400).json({
                error: 'Nom de région requis'
            })
        }

        const result = await SpatialService.createRegion(regionData)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Région créée avec succès',
                region: result.region 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route create region:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/spatial/regions/:id (Admin seulement)
router.put('/regions/:id', async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body
        
        const result = await SpatialService.updateRegion(id, updateData)
        
        if (result.success) {
            res.json({ 
                message: 'Région mise à jour',
                region: result.region 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route update region:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// DELETE /api/spatial/regions/:id (Admin seulement)
router.delete('/regions/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const result = await SpatialService.deleteRegion(id)
        
        if (result.success) {
            res.json({ message: 'Région supprimée' })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route delete region:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/regions/:name/parcelles
router.get('/regions/:name/parcelles', async (req, res) => {
    try {
        const { name } = req.params
        const result = await SpatialService.getParcellesInRegion(name)
        
        if (result.success) {
            res.json({ parcelles: result.parcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route parcelles in region:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/regions/:id/area
router.get('/regions/:id/area', async (req, res) => {
    try {
        const { id } = req.params
        const result = await SpatialService.calculateRegionArea(id)
        
        if (result.success) {
            res.json({ area: result })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route region area:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES MISES À JOUR POUR DÉPARTEMENTS
// ================================

// GET /api/spatial/departements
router.get('/departements', async (req, res) => {
    try {
        const { region_id } = req.query
        const result = await SpatialService.getDepartements(region_id)
        
        if (result.success) {
            res.json({ departements: result.departements })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route departements:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES MISES À JOUR POUR ARRONDISSEMENTS
// ================================

// GET /api/spatial/arrondissements
router.get('/arrondissements', async (req, res) => {
    try {
        const { region_id, departement_id } = req.query
        const result = await SpatialService.getArrondissements(region_id, departement_id)
        
        if (result.success) {
            res.json({ arrondissements: result.arrondissements })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route arrondissements:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR LES DIVISIONS ADMINISTRATIVES
// ================================

// GET /api/spatial/divisions
router.get('/divisions', async (req, res) => {
    try {
        const result = await SpatialService.getDivisionsAdministratives()
        
        if (result.success) {
            res.json({ divisions: result.divisions })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route divisions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/stats/regions
router.get('/stats/regions', async (req, res) => {
    try {
        const result = await SpatialService.getStatsByRegion()
        
        if (result.success) {
            res.json({ stats: result.stats })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route stats regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES DE RECHERCHE SPATIALE
// ================================

// POST /api/spatial/search/location
router.post('/search/location', async (req, res) => {
    try {
        const { longitude, latitude } = req.body
        
        if (!longitude || !latitude) {
            return res.status(400).json({
                error: 'Coordonnées longitude et latitude requises'
            })
        }

        const result = await SpatialService.searchByLocation(longitude, latitude)
        
        if (result.success) {
            res.json({ location: result.location })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route search location:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/search/nearest-region
router.post('/search/nearest-region', async (req, res) => {
    try {
        const { longitude, latitude, maxDistance } = req.body
        
        if (!longitude || !latitude) {
            return res.status(400).json({
                error: 'Coordonnées longitude et latitude requises'
            })
        }

        const result = await SpatialService.findNearestRegion(longitude, latitude, maxDistance)
        
        if (result.success) {
            res.json({ nearestRegion: result.nearestRegion })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route nearest region:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/search/bounds
router.post('/search/bounds', async (req, res) => {
    try {
        const { bounds } = req.body
        
        if (!bounds || !bounds.north || !bounds.south || !bounds.east || !bounds.west) {
            return res.status(400).json({
                error: 'Bounds complets requis (north, south, east, west)'
            })
        }

        const result = await SpatialService.getParcellesInBounds(bounds)
        
        if (result.success) {
            res.json({ parcelles: result.parcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route search bounds:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/search/regions-near-point
router.post('/search/regions-near-point', async (req, res) => {
    try {
        const { longitude, latitude, radiusKm = 50 } = req.body
        
        if (!longitude || !latitude) {
            return res.status(400).json({
                error: 'Coordonnées longitude et latitude requises'
            })
        }

        const result = await SpatialService.searchRegionsNearPoint(longitude, latitude, radiusKm)
        
        if (result.success) {
            res.json({ regions: result.regions })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route regions near point:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES D'EXPORT ET IMPORT
// ================================

// GET /api/spatial/export/regions/geojson
router.get('/export/regions/geojson', async (req, res) => {
    try {
        const result = await SpatialService.exportRegionsGeoJSON()
        
        if (result.success) {
            res.setHeader('Content-Type', 'application/geo+json')
            res.setHeader('Content-Disposition', 'attachment; filename="regions-cameroun.geojson"')
            res.json(result.geojson)
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route export regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/import/regions/geojson (Admin seulement)
router.post('/import/regions/geojson', async (req, res) => {
    try {
        const { geojsonFeature } = req.body
        
        if (!geojsonFeature) {
            return res.status(400).json({
                error: 'Feature GeoJSON requis'
            })
        }

        const result = await SpatialService.importRegionFromGeoJSON(geojsonFeature)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Région importée avec succès',
                region: result.region 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route import regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES POUR LES ANALYSES AVANCÉES
// ================================

// GET /api/spatial/border-parcelles
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
        console.error('Erreur route border parcelles:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/multi-region-parcelles
router.get('/multi-region-parcelles', async (req, res) => {
    try {
        const result = await SpatialService.getMultiRegionParcelles()
        
        if (result.success) {
            res.json({ multiRegionParcelles: result.multiRegionParcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route multi region parcelles:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/geographic-centers
router.get('/geographic-centers', async (req, res) => {
    try {
        const result = await SpatialService.getGeographicCenters()
        
        if (result.success) {
            res.json({ centers: result.centers })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route geographic centers:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/distances-between-regions
router.get('/distances-between-regions', async (req, res) => {
    try {
        const result = await SpatialService.getDistancesBetweenRegions()
        
        if (result.success) {
            res.json({ distances: result.distances })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route distances regions:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES DE VALIDATION ET RAPPORTS
// ================================

// GET /api/spatial/validate-data
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
        console.error('Erreur route validate data:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/geographic-report
router.get('/geographic-report', async (req, res) => {
    try {
        const result = await SpatialService.generateGeographicReport()
        
        if (result.success) {
            res.json({ report: result.report })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route geographic report:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES DE MAINTENANCE
// ================================

// POST /api/spatial/refresh-cache (Admin seulement)
router.post('/refresh-cache', async (req, res) => {
    try {
        const result = await SpatialService.refreshMaterializedViews()
        
        if (result.success) {
            res.json({ message: result.message })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route refresh cache:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/spatial/optimize-geometries (Admin seulement)
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
        console.error('Erreur route optimize geometries:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/spatial/cleanup-report
router.get('/cleanup-report', async (req, res) => {
    try {
        const result = await SpatialService.cleanupOrphanedData()
        
        if (result.success) {
            res.json({ report: result.report })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route cleanup report:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// ================================
// ROUTES EXISTANTES (INCHANGÉES)
// ================================

// POST /api/spatial/transform
router.post('/transform', async (req, res) => {
    try {
        const { coordinates, fromSRID, toSRID } = req.body
        
        if (!coordinates || !fromSRID) {
            return res.status(400).json({
                error: 'Coordonnées et SRID source requis'
            })
        }

        const result = await SpatialService.transformCoordinates(coordinates, fromSRID, toSRID)
        
        if (result.success) {
            res.json({ transformedCoordinates: result.transformedCoordinates })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route transform:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router