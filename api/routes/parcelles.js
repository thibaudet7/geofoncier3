// api/routes/parcelles.js
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { ParcelleService } = require('../services/ParcelleService')

// Configuration multer pour les images
const upload = multer({ 
    dest: 'uploads/images/',
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true)
        } else {
            cb(new Error('Seules les images sont autorisées'))
        }
    }
})

// GET /api/parcelles
router.get('/', async (req, res) => {
    try {
        const filters = req.query
        const result = await ParcelleService.getParcelles(filters)
        
        if (result.success) {
            res.json({ parcelles: result.parcelles })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route parcelles GET:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/parcelles
router.post('/', async (req, res) => {
    try {
        const parcelleData = req.body
        
        // Validation des coordonnées
        if (!parcelleData.coordinates || parcelleData.coordinates.length < 3) {
            return res.status(400).json({
                error: 'Coordonnées invalides - au moins 3 points requis'
            })
        }

        const result = await ParcelleService.createParcelle(parcelleData)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Parcelle créée avec succès',
                parcelle: result.parcelle 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route parcelles POST:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/search
router.get('/search', async (req, res) => {
    try {
        const { matricule } = req.query
        
        if (!matricule) {
            return res.status(400).json({
                error: 'Matricule requis'
            })
        }

        const result = await ParcelleService.searchParcelles(matricule)
        
        res.json({ parcelles: result.parcelles })
    } catch (error) {
        console.error('Erreur route search:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/:id
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const result = await ParcelleService.getParcelleById(id)
        
        if (result.success) {
            res.json({ parcelle: result.parcelle })
        } else {
            res.status(404).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/parcelles/:id
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const updateData = req.body
        
        const result = await ParcelleService.updateParcelle(id, updateData)
        
        if (result.success) {
            res.json({ 
                message: 'Parcelle mise à jour',
                parcelle: result.parcelle 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// DELETE /api/parcelles/:id
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const result = await ParcelleService.deleteParcelle(id)
        
        if (result.success) {
            res.json({ message: 'Parcelle supprimée' })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/parcelles/:id/images
router.post('/:id/images', upload.array('images', 3), async (req, res) => {
    try {
        const { id } = req.params
        const files = req.files
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'Aucune image fournie'
            })
        }

        const result = await ParcelleService.uploadParcelleImages(id, files)
        
        if (result.success) {
            res.json({ 
                message: 'Images uploadées avec succès',
                images: result.images 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur upload images:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/parcelles/:id/overlaps
router.get('/:id/overlaps', async (req, res) => {
    try {
        const { id } = req.params
        
        const result = await ParcelleService.checkOverlaps(id)
        
        if (result.success) {
            res.json({ overlaps: result.overlaps })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router