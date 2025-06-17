// api/routes/csv.js
const express = require('express')
const router = express.Router()
const multer = require('multer')
const { CSVImportService } = require('../services/CSVImportService')

// Configuration multer pour CSV
const upload = multer({ 
    dest: 'uploads/csv/',
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true)
        } else {
            cb(new Error('Seuls les fichiers CSV sont autorisés'))
        }
    }
})

// POST /api/csv/import
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        const { proprietaire_id } = req.body
        const file = req.file
        
        if (!file || !proprietaire_id) {
            return res.status(400).json({
                error: 'Fichier CSV et ID propriétaire requis'
            })
        }

        const result = await CSVImportService.importParcelles(file.path, proprietaire_id)
        
        res.json(result)
    } catch (error) {
        console.error('Erreur import CSV:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/csv/sample
router.get('/sample', (req, res) => {
    try {
        const sampleCSV = CSVImportService.generateSampleCSV()
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', 'attachment; filename="sample-import.csv"')
        res.send(sampleCSV)
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router