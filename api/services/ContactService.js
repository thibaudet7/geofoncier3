// api/services/ContactService.js
const { supabase } = require('../supabase-config')

class ContactService {
    
    static async initiateContact(contactData) {
        try {
            // Vérifier que le client et la parcelle existent
            const { data: parcelle, error: parcelleError } = await supabase
                .from('parcelles')
                .select('proprietaire_id, matricule, quartier_village')
                .eq('id', contactData.parcelle_id)
                .single()

            if (parcelleError) throw parcelleError

            // Créer l'enregistrement de contact
            const { data, error } = await supabase
                .from('contacts')
                .insert([{
                    client_id: contactData.client_id,
                    proprietaire_id: parcelle.proprietaire_id,
                    parcelle_id: contactData.parcelle_id
                }])
                .select(`
                    *,
                    client:client_id(nom_complet, email),
                    proprietaire:proprietaire_id(nom_complet, email, telephone),
                    parcelle:parcelle_id(matricule, quartier_village)
                `)

            if (error) throw error

            // Envoyer notification email à l'administrateur
            await this.sendAdminNotification(data[0])

            return { success: true, contact: data[0] }
        } catch (error) {
            console.error('Erreur initiation contact:', error)
            return { success: false, error: error.message }
        }
    }

    static async sendAdminNotification(contactData) {
        try {
            const emailData = {
                to: process.env.ADMIN_EMAIL,
                subject: 'Nouvelle demande de contact - GéoFoncier',
                html: `
                    <h2>Nouvelle demande de contact</h2>
                    <p><strong>Client:</strong> ${contactData.client.nom_complet} (${contactData.client.email})</p>
                    <p><strong>Propriétaire:</strong> ${contactData.proprietaire.nom_complet}</p>
                    <p><strong>Parcelle:</strong> ${contactData.parcelle.matricule} - ${contactData.parcelle.quartier_village}</p>
                    <p><strong>Date:</strong> ${new Date(contactData.date_contact).toLocaleString()}</p>
                    
                    <p>Veuillez traiter cette demande dans les plus brefs délais.</p>
                    <p><a href="${process.env.APP_URL}/admin/contacts">Gérer les contacts</a></p>
                `
            }

            // Utiliser Edge Function pour l'email (à implémenter)
            const { error } = await supabase.functions.invoke('send-email', {
                body: emailData
            })

            if (error) {
                console.log('Edge function email non disponible, utiliser service email externe')
            }

            return { success: true }
        } catch (error) {
            console.error('Erreur notification admin:', error)
            return { success: false, error: error.message }
        }
    }

    static async approveContact(contactId) {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .update({ statut: 'accepted' })
                .eq('id', contactId)
                .select(`
                    *,
                    client:client_id(email, nom_complet),
                    proprietaire:proprietaire_id(nom_complet, telephone)
                `)

            if (error) throw error

            // Envoyer les coordonnées du propriétaire au client
            await this.sendContactDetails(data[0])

            return { success: true, contact: data[0] }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async sendContactDetails(contactData) {
        try {
            const emailData = {
                to: contactData.client.email,
                subject: 'Coordonnées du propriétaire - GéoFoncier',
                html: `
                    <h2>Coordonnées du propriétaire</h2>
                    <p>Bonjour ${contactData.client.nom_complet},</p>
                    <p>Votre demande de contact a été approuvée.</p>
                    <p><strong>Propriétaire:</strong> ${contactData.proprietaire.nom_complet}</p>
                    <p><strong>Téléphone:</strong> ${contactData.proprietaire.telephone}</p>
                    
                    <p><strong>Important:</strong> Des commissions s'appliquent en cas de transaction :</p>
                    <ul>
                        <li>Client : 3% du prix de vente</li>
                        <li>Propriétaire : 2% du prix de vente</li>
                    </ul>
                    
                    <p>Cordialement,<br>L'équipe GéoFoncier</p>
                `
            }

            const { error } = await supabase.functions.invoke('send-email', {
                body: emailData
            })

            if (error) {
                console.log('Edge function email non disponible')
            }

            return { success: true }
        } catch (error) {
            return { success: false, error: error.message }
        }
    }

    static async getContactHistory(userId) {
        try {
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    *,
                    parcelle:parcelle_id(matricule, quartier_village, prix_m2),
                    proprietaire:proprietaire_id(nom_complet),
                    client:client_id(nom_complet)
                `)
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