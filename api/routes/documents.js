// api/routes/documents.js - Routes pour la gestion des documents
const express = require('express')
const router = express.Router()
const { DocumentService } = require('../services/DocumentService')

// Configuration multer
const upload = DocumentService.getUploadConfig()

// GET /api/documents/types - Obtenir les types de documents
router.get('/types', (req, res) => {
    try {
        const types = DocumentService.getDocumentTypes()
        res.json({ types })
    } catch (error) {
        console.error('Erreur route document types:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/documents/parcelle/:id/upload - Upload document pour parcelle
router.post('/parcelle/:id/upload', upload.single('document'), async (req, res) => {
    try {
        const { id: parcelleId } = req.params
        const { documentType, userId } = req.body
        const file = req.file
        
        if (!file) {
            return res.status(400).json({
                error: 'Aucun fichier fourni'
            })
        }

        if (!documentType || !userId) {
            return res.status(400).json({
                error: 'Type de document et ID utilisateur requis'
            })
        }

        // Validation du type de fichier
        const fileValidation = DocumentService.validateFileType(file)
        if (!fileValidation.valid) {
            return res.status(400).json({
                error: 'Type de fichier non autorisé',
                allowedTypes: fileValidation.allowedTypes
            })
        }

        // Validation de la taille
        const sizeValidation = DocumentService.validateFileSize(file)
        if (!sizeValidation.valid) {
            return res.status(400).json({
                error: `Fichier trop volumineux. Taille maximum: ${sizeValidation.maxSize}MB`
            })
        }

        const result = await DocumentService.uploadParcelleDocument(parcelleId, file, documentType, userId)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Document uploadé avec succès',
                document: result.document 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route upload parcelle document:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/documents/subscription/:id/upload - Upload document pour abonnement
router.post('/subscription/:id/upload', upload.single('document'), async (req, res) => {
    try {
        const { id: subscriptionId } = req.params
        const { documentType, userId } = req.body
        const file = req.file
        
        if (!file) {
            return res.status(400).json({
                error: 'Aucun fichier fourni'
            })
        }

        if (!documentType || !userId) {
            return res.status(400).json({
                error: 'Type de document et ID utilisateur requis'
            })
        }

        // Validations
        const fileValidation = DocumentService.validateFileType(file)
        if (!fileValidation.valid) {
            return res.status(400).json({
                error: 'Type de fichier non autorisé',
                allowedTypes: fileValidation.allowedTypes
            })
        }

        const sizeValidation = DocumentService.validateFileSize(file)
        if (!sizeValidation.valid) {
            return res.status(400).json({
                error: `Fichier trop volumineux. Taille maximum: ${sizeValidation.maxSize}MB`
            })
        }

        const result = await DocumentService.uploadSubscriptionDocument(subscriptionId, file, documentType, userId)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Document uploadé avec succès',
                document: result.document 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route upload subscription document:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/documents/parcelle/:id - Récupérer documents d'une parcelle
router.get('/parcelle/:id', async (req, res) => {
    try {
        const { id: parcelleId } = req.params
        const { userId } = req.query
        
        const result = await DocumentService.getParcelleDocuments(parcelleId, userId)
        
        if (result.success) {
            res.json({ documents: result.documents })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route get parcelle documents:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/documents/subscription/:id - Récupérer documents d'un abonnement
router.get('/subscription/:id', async (req, res) => {
    try {
        const { id: subscriptionId } = req.params
        const { userId } = req.query
        
        if (!userId) {
            return res.status(400).json({
                error: 'ID utilisateur requis'
            })
        }

        const result = await DocumentService.getSubscriptionDocuments(subscriptionId, userId)
        
        if (result.success) {
            res.json({ documents: result.documents })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route get subscription documents:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/documents/verify/:id - Vérifier un document (admin)
router.put('/verify/:id', async (req, res) => {
    try {
        const { id: documentId } = req.params
        const { documentTable, adminId, isVerified = true } = req.body
        
        if (!documentTable || !adminId) {
            return res.status(400).json({
                error: 'Table de document et ID admin requis'
            })
        }

        if (!['parcelle', 'subscription'].includes(documentTable)) {
            return res.status(400).json({
                error: 'Table de document invalide'
            })
        }

        const result = await DocumentService.verifyDocument(documentId, documentTable, adminId, isVerified)
        
        if (result.success) {
            res.json({ 
                message: isVerified ? 'Document vérifié' : 'Vérification annulée',
                document: result.document 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route verify document:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// DELETE /api/documents/:id - Supprimer un document
router.delete('/:id', async (req, res) => {
    try {
        const { id: documentId } = req.params
        const { documentTable, userId } = req.body
        
        if (!documentTable || !userId) {
            return res.status(400).json({
                error: 'Table de document et ID utilisateur requis'
            })
        }

        if (!['parcelle', 'subscription'].includes(documentTable)) {
            return res.status(400).json({
                error: 'Table de document invalide'
            })
        }

        const result = await DocumentService.deleteDocument(documentId, documentTable, userId)
        
        if (result.success) {
            res.json({ message: 'Document supprimé avec succès' })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route delete document:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/documents/check-completeness/:entityType/:entityId - Vérifier complétude
router.get('/check-completeness/:entityType/:entityId', async (req, res) => {
    try {
        const { entityType, entityId } = req.params
        
        if (!['parcelle', 'subscription'].includes(entityType)) {
            return res.status(400).json({
                error: 'Type d\'entité invalide'
            })
        }

        const result = await DocumentService.checkDocumentCompleteness(entityType, entityId)
        
        if (result.success) {
            res.json({ 
                isComplete: result.isComplete,
                entityType,
                entityId
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route check completeness:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/documents/statistics - Statistiques des documents
router.get('/statistics', async (req, res) => {
    try {
        const result = await DocumentService.getDocumentStatistics()
        
        if (result.success) {
            res.json({ statistics: result.statistics })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route document statistics:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/documents/pending - Documents en attente de vérification (admin)
router.get('/pending', async (req, res) => {
    try {
        const result = await DocumentService.getPendingDocuments()
        
        if (result.success) {
            res.json({ pendingDocuments: result.pendingDocuments })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route pending documents:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/documents/bulk-upload - Upload multiple documents
router.post('/bulk-upload', upload.array('documents', 5), async (req, res) => {
    try {
        const { entityType, entityId, userId } = req.body
        const files = req.files
        
        if (!files || files.length === 0) {
            return res.status(400).json({
                error: 'Aucun fichier fourni'
            })
        }

        if (!entityType || !entityId || !userId) {
            return res.status(400).json({
                error: 'Type d\'entité, ID entité et ID utilisateur requis'
            })
        }

        const results = []
        const errors = []

        for (const file of files) {
            try {
                // Extraire le type de document du nom de fichier ou utiliser 'autre'
                const documentType = file.originalname.toLowerCase().includes('acte') ? 'acte_foncier' : 'autre'
                
                let result
                if (entityType === 'parcelle') {
                    result = await DocumentService.uploadParcelleDocument(entityId, file, documentType, userId)
                } else if (entityType === 'subscription') {
                    result = await DocumentService.uploadSubscriptionDocument(entityId, file, documentType, userId)
                } else {
                    throw new Error('Type d\'entité invalide')
                }

                if (result.success) {
                    results.push(result.document)
                } else {
                    errors.push({ file: file.originalname, error: result.error })
                }
            } catch (error) {
                errors.push({ file: file.originalname, error: error.message })
            }
        }

        res.json({
            message: `${results.length} document(s) uploadé(s) avec succès`,
            uploaded: results,
            errors: errors,
            total: files.length,
            success: results.length,
            failed: errors.length
        })
    } catch (error) {
        console.error('Erreur route bulk upload:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router