const express = require('express')
const router = express.Router()
const { authenticateUser } = require('../middleware/auth')
const { supabase } = require('../supabase-config')

// GET /api/favorites - liste des favoris avec détails parcelle
router.get('/', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select(`
                id,
                created_at,
                parcelle:parcelle_id(
                    id, matricule, quartier_village, superficie, prix_m2, activite, statut
                )
            `)
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false })

        if (error) throw error
        res.json({ favorites: data })
    } catch (error) {
        console.error('Erreur get favorites:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// POST /api/favorites - ajouter un favori
router.post('/', authenticateUser, async (req, res) => {
    try {
        const { parcelle_id } = req.body
        if (!parcelle_id) {
            return res.status(400).json({ error: 'parcelle_id requis' })
        }

        const { data, error } = await supabase
            .from('favorites')
            .insert([{ user_id: req.user.id, parcelle_id }])
            .select()

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ error: 'Déjà dans les favoris' })
            }
            throw error
        }

        res.status(201).json({ message: 'Ajouté aux favoris', favorite: data[0] })
    } catch (error) {
        console.error('Erreur add favorite:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// DELETE /api/favorites/:parcelle_id - retirer un favori
router.delete('/:parcelle_id', authenticateUser, async (req, res) => {
    try {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('user_id', req.user.id)
            .eq('parcelle_id', req.params.parcelle_id)

        if (error) throw error
        res.json({ message: 'Retiré des favoris' })
    } catch (error) {
        console.error('Erreur delete favorite:', error)
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

// GET /api/favorites/check/:parcelle_id - vérifier si en favori
router.get('/check/:parcelle_id', authenticateUser, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('favorites')
            .select('id')
            .eq('user_id', req.user.id)
            .eq('parcelle_id', req.params.parcelle_id)
            .maybeSingle()

        if (error) throw error
        res.json({ isFavorite: !!data })
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' })
    }
})

module.exports = router
