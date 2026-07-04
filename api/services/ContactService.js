const { supabase } = require('../supabase-config')
const { NotificationService } = require('./NotificationService')

class ContactService {

    static async initiateContact(contactData) {
        try {
            const { data: parcelle, error: parcelleError } = await supabase
                .from('parcelles')
                .select('proprietaire_id, matricule, quartier_village')
                .eq('id', contactData.parcelle_id)
                .single()

            if (parcelleError) throw parcelleError

            // Vérifier doublon (même client, même parcelle, statut pending)
            const { data: existing } = await supabase
                .from('contacts')
                .select('id')
                .eq('client_id', contactData.client_id)
                .eq('parcelle_id', contactData.parcelle_id)
                .eq('statut', 'pending')
                .maybeSingle()

            if (existing) {
                return { success: false, error: 'Vous avez déjà une demande en cours pour cette parcelle' }
            }

            const { data, error } = await supabase
                .from('contacts')
                .insert([{
                    client_id: contactData.client_id,
                    proprietaire_id: parcelle.proprietaire_id,
                    parcelle_id: contactData.parcelle_id
                }])
                .select(`
                    id, statut, date_contact,
                    client:client_id(nom_complet, email, telephone),
                    parcelle:parcelle_id(matricule, quartier_village)
                `)

            if (error) throw error

            // Notifier l'admin (in-app + email)
            const contact = data[0]
            await NotificationService.notifyAdmin(
                'contact_request',
                'Nouvelle demande de contact',
                `${contact.client.nom_complet} souhaite contacter le propriétaire de la parcelle ${contact.parcelle.matricule} (${contact.parcelle.quartier_village})`,
                { contact_id: contact.id, parcelle_id: contactData.parcelle_id }
            )

            // Réponse au client - PAS d'infos propriétaire
            return {
                success: true,
                message: 'Votre demande a été transmise à l\'administrateur.'
            }
        } catch (error) {
            console.error('Erreur initiation contact:', error)
            return { success: false, error: error.message }
        }
    }

    static async approveContact(contactId) {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .update({ statut: 'accepted', updated_at: new Date().toISOString() })
                .eq('id', contactId)
                .select(`
                    *,
                    client:client_id(id, nom_complet, email),
                    proprietaire:proprietaire_id(id, nom_complet),
                    parcelle:parcelle_id(matricule, quartier_village)
                `)

            if (error) throw error
            if (!data || data.length === 0) {
                return { success: false, error: 'Contact non trouvé' }
            }

            const contact = data[0]

            // Notifier le client
            await NotificationService.createNotification(
                contact.client.id,
                'contact_approved',
                'Demande de contact approuvée',
                `Votre demande pour la parcelle ${contact.parcelle.matricule} a été approuvée. L'administrateur va faciliter la mise en relation.`,
                { contact_id: contactId, parcelle_id: contact.parcelle_id }
            )

            // Notifier le propriétaire
            await NotificationService.createNotification(
                contact.proprietaire.id,
                'contact_approved',
                'Un client est intéressé par votre parcelle',
                `Un client est intéressé par votre parcelle ${contact.parcelle.matricule}. L'administrateur va faciliter la mise en relation.`,
                { contact_id: contactId, parcelle_id: contact.parcelle_id }
            )

            return { success: true, contact }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async rejectContact(contactId, adminNotes) {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .update({
                    statut: 'rejected',
                    admin_notes: adminNotes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', contactId)
                .select(`
                    *,
                    client:client_id(id, nom_complet),
                    parcelle:parcelle_id(matricule)
                `)

            if (error) throw error
            if (!data || data.length === 0) {
                return { success: false, error: 'Contact non trouvé' }
            }

            const contact = data[0]

            await NotificationService.createNotification(
                contact.client.id,
                'contact_rejected',
                'Demande de contact refusée',
                `Votre demande pour la parcelle ${contact.parcelle.matricule} n'a pas pu être approuvée.${adminNotes ? ' Motif: ' + adminNotes : ''}`,
                { contact_id: contactId }
            )

            return { success: true, contact }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async getContactHistory(userId, isAdmin = false) {
        try {
            let selectFields = `
                id, statut, date_contact, updated_at,
                parcelle:parcelle_id(matricule, quartier_village, prix_m2),
                client:client_id(nom_complet)
            `

            // Seul l'admin voit les infos complètes du propriétaire
            if (isAdmin) {
                selectFields = `
                    id, statut, date_contact, updated_at, admin_notes,
                    parcelle:parcelle_id(matricule, quartier_village, prix_m2),
                    client:client_id(nom_complet, email, telephone),
                    proprietaire:proprietaire_id(nom_complet, email, telephone)
                `
            } else {
                selectFields += `,
                    proprietaire:proprietaire_id(nom_complet)
                `
            }

            const { data, error } = await supabase
                .from('contacts')
                .select(selectFields)
                .or(`client_id.eq.${userId},proprietaire_id.eq.${userId}`)
                .order('date_contact', { ascending: false })

            if (error) throw error

            return { success: true, contacts: data }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }
}

module.exports = { ContactService }
