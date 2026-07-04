const express = require('express')
const router = express.Router()
const { authenticateUser } = require('../middleware/auth')
const { NotificationService } = require('../services/NotificationService')

// GET /api/notifications - liste paginée
router.get('/', authenticateUser, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20
        const offset = parseInt(req.query.offset) || 0
        const result = await NotificationService.getNotifications(req.user.id, limit, offset)

        if (result.success) {
            res.json({ notifications: result.notifications, total: result.total })
        } else {
            res.status(500).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/notifications/unread-count
router.get('/unread-count', authenticateUser, async (req, res) => {
    try {
        const result = await NotificationService.getUnreadCount(req.user.id)
        res.json({ count: result.count })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateUser, async (req, res) => {
    try {
        const result = await NotificationService.markAsRead(req.params.id, req.user.id)
        if (result.success) {
            res.json({ message: 'Notification marquée comme lue' })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// PUT /api/notifications/read-all
router.put('/read-all', authenticateUser, async (req, res) => {
    try {
        const result = await NotificationService.markAllAsRead(req.user.id)
        if (result.success) {
            res.json({ message: 'Toutes les notifications marquées comme lues' })
        } else {
            res.status(400).json({ error: result.error })
        }
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router
