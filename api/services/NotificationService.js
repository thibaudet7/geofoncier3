const { supabase } = require('../supabase-config')

class NotificationService {

    static async createNotification(userId, type, title, message, data = {}) {
        try {
            const { data: notif, error } = await supabase
                .from('notifications')
                .insert([{ user_id: userId, type, title, message, data }])
                .select()

            if (error) throw error
            return { success: true, notification: notif[0] }
        } catch (error) {
            console.error('Erreur creation notification:', error)
            return { success: false, error: error.message }
        }
    }

    static async getNotifications(userId, limit = 20, offset = 0) {
        try {
            const { data, error, count } = await supabase
                .from('notifications')
                .select('*', { count: 'exact' })
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1)

            if (error) throw error
            return { success: true, notifications: data, total: count }
        } catch (error) {
            console.error('Erreur get notifications:', error)
            return { success: false, error: error.message }
        }
    }

    static async getUnreadCount(userId) {
        try {
            const { count, error } = await supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_read', false)

            if (error) throw error
            return { success: true, count: count || 0 }
        } catch (error) {
            console.error('Erreur unread count:', error)
            return { success: false, count: 0 }
        }
    }

    static async markAsRead(notificationId, userId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('user_id', userId)

            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async markAllAsRead(userId) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', userId)
                .eq('is_read', false)

            if (error) throw error
            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async notifyAdmin(type, title, message, data = {}) {
        try {
            const { data: admins, error: adminError } = await supabase
                .from('users')
                .select('id, email')
                .eq('type_utilisateur', 'admin')

            if (adminError) throw adminError

            for (const admin of (admins || [])) {
                await this.createNotification(admin.id, type, title, message, data)
            }

            // Tenter l'envoi email (fail silently)
            try {
                const adminEmail = process.env.ADMIN_EMAIL || 'geospatial.estate@gmail.com'
                await supabase.functions.invoke('send-email', {
                    body: {
                        to: adminEmail,
                        subject: `[GéoFoncier] ${title}`,
                        html: `<h3>${title}</h3><p>${message}</p>`
                    }
                })
            } catch (emailErr) {
                console.log('Email notification non disponible:', emailErr.message)
            }

            return { success: true }
        } catch (error) {
            console.error('Erreur notifyAdmin:', error)
            return { success: false, error: error.message }
        }
    }
}

module.exports = { NotificationService }
