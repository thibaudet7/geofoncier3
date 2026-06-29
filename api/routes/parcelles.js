const express = require('express')
const multer = require('multer')
const path = require('path')
const router = express.Router()
const { ParcelleService } = require('../services/ParcelleService')
const { authenticateUser } = require('../middleware/auth')

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|pdf/
        const ext = allowed.test(path.extname(file.originalname).toLowerCase())
        const mime = allowed.test(file.mimetype)
        cb(null, ext && mime)
    }
})

const parcelleUpload = upload.fields([
    { name: 'document_identite', maxCount: 1 },
    { name: 'justificatif_acte', maxCount: 1 },
    { name: 'photos_terrain', maxCount: 3 }
])

// GET /api/parcelles - Liste des parcelles avec filtres
router.get('/', async (req, res) => {
    try {
        const filters = {
            arrondissement: req.query.arrondissement,
            quartier: req.query.quartier,
            activite: req.query.activite,
            statut_terrain: req.query.statut_terrain,
            prix_min: req.query.prix_min,
            prix_max: req.query.prix_max
        }
        const result = await ParcelleService.getParcelles(filters)
        if (result.success) {
            res.json({ success: true, parcelles: result.parcelles })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur GET parcelles:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/search - Recherche par matricule
router.get('/search', async (req, res) => {
    try {
        const { matricule } = req.query
        if (!matricule) {
            return res.status(400).json({ success: false, error: 'Matricule requis' })
        }
        const result = await ParcelleService.searchParcelles(matricule)
        if (result.success) {
            res.json({ success: true, parcelles: result.parcelles })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur recherche parcelle:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/:id - Détails d'une parcelle
router.get('/:id', async (req, res) => {
    try {
        const result = await ParcelleService.getParcelleById(req.params.id)
        if (result.success) {
            res.json({ success: true, parcelle: result.parcelle })
        } else {
            res.status(404).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur GET parcelle:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// POST /api/parcelles - Créer une parcelle (authentifié)
router.post('/', authenticateUser, parcelleUpload, async (req, res) => {
    try {
        const parcelleData = req.body
        if (parcelleData.coordinates && typeof parcelleData.coordinates === 'string') {
            parcelleData.coordinates = JSON.parse(parcelleData.coordinates)
        }
        const files = req.files || {}
        const result = await ParcelleService.createParcelle(parcelleData, files, req.user.id)
        if (result.success) {
            res.status(201).json({ success: true, parcelle: result.parcelle })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur création parcelle:', error)
        res.status(500).json({ success: false, error: error.message || 'Erreur serveur' })
    }
})

// PUT /api/parcelles/:id - Modifier une parcelle (authentifié)
router.put('/:id', authenticateUser, async (req, res) => {
    try {
        const result = await ParcelleService.updateParcelle(req.params.id, req.body)
        if (result.success) {
            res.json({ success: true, parcelle: result.parcelle })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur modification parcelle:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// DELETE /api/parcelles/:id - Supprimer une parcelle (authentifié)
router.delete('/:id', authenticateUser, async (req, res) => {
    try {
        const result = await ParcelleService.deleteParcelle(req.params.id)
        if (result.success) {
            res.json({ success: true, message: 'Parcelle supprimée' })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur suppression parcelle:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/:id/overlaps - Vérifier chevauchements
router.get('/:id/overlaps', async (req, res) => {
    try {
        const result = await ParcelleService.checkOverlaps(req.params.id)
        if (result.success) {
            res.json({ success: true, overlaps: result.overlaps })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur vérification chevauchements:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/:id/documents - Documents d'une parcelle
router.get('/:id/documents', async (req, res) => {
    try {
        const result = await ParcelleService.getParcelleDocuments(req.params.id)
        if (result.success) {
            res.json({ success: true, documents: result.documents })
        } else {
            res.status(400).json({ success: false, error: result.error })
        }
    } catch (error) {
        console.error('Erreur documents parcelle:', error)
        res.status(500).json({ success: false, error: 'Erreur serveur' })
    }
})

module.exports = router
