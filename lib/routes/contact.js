// api/routes/contact.js
const express = require('express')
const router = express.Router()
const { ContactService } = require('../services/ContactService')

// POST /api/contact/initiate
router.post('/initiate', async (req, res) => {
    try {
        const contactData = req.body
        
        if (!contactData.client_id || !contactData.parcelle_id) {
            return res.status(400).json({
                error: 'Client ID et Parcelle ID requis'
            })
        }

        const result = await ContactService.initiateContact(contactData)
        
        if (result.success) {
            res.status(201).json({ 
                message: 'Demande de contact envoyée',
                contact: result.contact 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route contact initiate:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/contact/approve
router.post('/approve', async (req, res) => {
    try {
        const { contact_id } = req.body
        
        if (!contact_id) {
            return res.status(400).json({
                error: 'Contact ID requis'
            })
        }

        const result = await ContactService.approveContact(contact_id)
        
        if (result.success) {
            res.json({ 
                message: 'Contact approuvé',
                contact: result.contact 
            })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/contact/history/:userId
router.get('/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params
        
        const result = await ContactService.getContactHistory(userId)
        
        if (result.success) {
            res.json({ contacts: result.contacts })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router