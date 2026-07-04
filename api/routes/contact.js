const express = require('express')
const router = express.Router()
const { ContactService } = require('../services/ContactService')
const { authenticateUser, requireAdmin } = require('../middleware/auth')

// POST /api/contact/initiate - Client demande contact
router.post('/initiate', authenticateUser, async (req, res) => {
    try {
        const { parcelle_id } = req.body

        if (!parcelle_id) {
            return res.status(400).json({ error: 'parcelle_id requis' })
        }

        const result = await ContactService.initiateContact({
            client_id: req.user.id,
            parcelle_id
        })

        if (result.success) {
            res.status(201).json({ message: result.message })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        console.error('Erreur route contact initiate:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/contact/approve - Admin approuve
router.post('/approve', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { contact_id } = req.body

        if (!contact_id) {
            return res.status(400).json({ error: 'contact_id requis' })
        }

        const result = await ContactService.approveContact(contact_id)

        if (result.success) {
            res.json({ message: 'Contact approuvé', contact: result.contact })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/contact/reject - Admin rejette
router.post('/reject', authenticateUser, requireAdmin, async (req, res) => {
    try {
        const { contact_id, admin_notes } = req.body

        if (!contact_id) {
            return res.status(400).json({ error: 'contact_id requis' })
        }

        const result = await ContactService.rejectContact(contact_id, admin_notes || '')

        if (result.success) {
            res.json({ message: 'Contact rejeté', contact: result.contact })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/contact/history/:userId - Historique (filtré selon rôle)
router.get('/history/:userId', authenticateUser, async (req, res) => {
    try {
        const { userId } = req.params
        const isAdmin = req.user.id !== userId

        // Vérifier que le user demande ses propres contacts ou est admin
        const { supabase } = require('../supabase-config')
        let isAdminUser = false
        if (req.user.id !== userId) {
            const { data: userData } = await supabase
                .from('users')
                .select('type_utilisateur')
                .eq('id', req.user.id)
                .single()
            isAdminUser = userData?.type_utilisateur === 'admin'
            if (!isAdminUser) {
                return res.status(403).json({ error: 'Accès non autorisé' })
            }
        }

        const result = await ContactService.getContactHistory(userId, isAdminUser)

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
