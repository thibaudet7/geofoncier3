// api/services/DocumentService.js - Service pour la gestion des documents justificatifs
const { supabase } = require('../supabase-config')
const multer = require('multer')
const path = require('path')

class DocumentService {
    
    // Types de documents autorisés
    static getDocumentTypes() {
        return {
            parcelle: [
                { value: 'acte_foncier', label: 'Acte foncier', required: true },
                { value: 'titre_propriete', label: 'Titre de propriété', required: false },
                { value: 'certificat_occupation', label: 'Certificat d\'occupation', required: false },
                { value: 'plan_cadastral', label: 'Plan cadastral', required: false },
                { value: 'autre', label: 'Autre document', required: false }
            ],
            subscription: [
                { value: 'justificatif_propriete', label: 'Justificatif de propriété', required: true },
                { value: 'piece_identite', label: 'Pièce d\'identité', required: true },
                { value: 'justificatif_domicile', label: 'Justificatif de domicile', required: false },
                { value: 'autre', label: 'Autre document', required: false }
            ]
        }
    }

    // Configuration multer pour l'upload
    static getUploadConfig() {
        return multer({
            dest: 'uploads/documents/',
            limits: { 
                fileSize: 10 * 1024 * 1024, // 10MB
                files: 5 // Maximum 5 fichiers
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = [
                    'application/pdf',
                    'image/jpeg',
                    'image/png',
                    'image/jpg',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ]
                
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true)
                } else {
                    cb(new Error('Type de fichier non autorisé. Formats acceptés: PDF, JPG, PNG, DOC, DOCX'))
                }
            }
        })
    }

    // Upload d'un document pour une parcelle
    static async uploadParcelleDocument(parcelleId, file, documentType, userId) {
        try {
            // Vérifier que la parcelle appartient à l'utilisateur
            const { data: parcelle, error: parcelleError } = await supabase
                .from('parcelles')
                .select('proprietaire_id')
                .eq('id', parcelleId)
                .single()

            if (parcelleError) throw parcelleError

            if (parcelle.proprietaire_id !== userId) {
                throw new Error('Accès non autorisé à cette parcelle')
            }

            // Générer un nom de fichier unique
            const fileName = `parcelles/${parcelleId}/${documentType}_${Date.now()}${path.extname(file.originalname)}`
            
            // Upload vers Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                })

            if (uploadError) throw uploadError

            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName)

            // Enregistrer en base
            const { data: documentData, error: documentError } = await supabase
                .from('parcelle_documents')
                .insert([{
                    parcelle_id: parcelleId,
                    document_type: documentType,
                    document_name: file.originalname,
                    document_url: publicUrl,
                    file_size: file.size,
                    mime_type: file.mimetype
                }])
                .select()

            if (documentError) throw documentError

            return { success: true, document: documentData[0] }
        } catch (error) {
            console.error('Erreur upload document parcelle:', error)
            return { success: false, error: error.message }
        }
    }

    // Upload d'un document pour un abonnement
    static async uploadSubscriptionDocument(subscriptionId, file, documentType, userId) {
        try {
            // Vérifier que l'abonnement appartient à l'utilisateur
            const { data: subscription, error: subscriptionError } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('id', subscriptionId)
                .single()

            if (subscriptionError) throw subscriptionError

            if (subscription.user_id !== userId) {
                throw new Error('Accès non autorisé à cet abonnement')
            }

            // Générer un nom de fichier unique
            const fileName = `subscriptions/${subscriptionId}/${documentType}_${Date.now()}${path.extname(file.originalname)}`
            
            // Upload vers Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, file.buffer, {
                    contentType: file.mimetype,
                    upsert: false
                })

            if (uploadError) throw uploadError

            // Obtenir l'URL publique
            const { data: { publicUrl } } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName)

            // Enregistrer en base
            const { data: documentData, error: documentError } = await supabase
                .from('subscription_documents')
                .insert([{
                    subscription_id: subscriptionId,
                    document_type: documentType,
                    document_name: file.originalname,
                    document_url: publicUrl,
                    file_size: file.size,
                    mime_type: file.mimetype
                }])
                .select()

            if (documentError) throw documentError

            return { success: true, document: documentData[0] }
        } catch (error) {
            console.error('Erreur upload document abonnement:', error)
            return { success: false, error: error.message }
        }
    }

    // Récupérer les documents d'une parcelle
    static async getParcelleDocuments(parcelleId, userId = null) {
        try {
            let query = supabase
                .from('parcelle_documents')
                .select(`
                    *,
                    verified_by_user:verified_by(nom_complet)
                `)
                .eq('parcelle_id', parcelleId)
                .order('uploaded_at', { ascending: false })

            const { data, error } = await query

            if (error) throw error

            return { success: true, documents: data }
        } catch (error) {
            console.error('Erreur récupération documents parcelle:', error)
            return { success: false, error: error.message }
        }
    }

    // Récupérer les documents d'un abonnement
    static async getSubscriptionDocuments(subscriptionId, userId) {
        try {
            const { data, error } = await supabase
                .from('subscription_documents')
                .select(`
                    *,
                    verified_by_user:verified_by(nom_complet)
                `)
                .eq('subscription_id', subscriptionId)
                .order('uploaded_at', { ascending: false })

            if (error) throw error

            return { success: true, documents: data }
        } catch (error) {
            console.error('Erreur récupération documents abonnement:', error)
            return { success: false, error: error.message }
        }
    }

    // Vérifier un document (admin seulement)
    static async verifyDocument(documentId, documentTable, adminId, isVerified = true) {
        try {
            const table = documentTable === 'parcelle' ? 'parcelle_documents' : 'subscription_documents'
            
            const { data, error } = await supabase
                .from(table)
                .update({
                    is_verified: isVerified,
                    verified_by: adminId,
                    verified_at: new Date().toISOString()
                })
                .eq('id', documentId)
                .select()

            if (error) throw error

            return { success: true, document: data[0] }
        } catch (error) {
            console.error('Erreur vérification document:', error)
            return { success: false, error: error.message }
        }
    }

    // Supprimer un document
    static async deleteDocument(documentId, documentTable, userId) {
        try {
            const table = documentTable === 'parcelle' ? 'parcelle_documents' : 'subscription_documents'
            
            // Récupérer le document pour vérifier les droits et obtenir l'URL
            const { data: document, error: fetchError } = await supabase
                .from(table)
                .select('*')
                .eq('id', documentId)
                .single()

            if (fetchError) throw fetchError

            // Vérifier les droits
            if (documentTable === 'parcelle') {
                const { data: parcelle } = await supabase
                    .from('parcelles')
                    .select('proprietaire_id')
                    .eq('id', document.parcelle_id)
                    .single()

                if (parcelle.proprietaire_id !== userId) {
                    throw new Error('Accès non autorisé')
                }
            } else {
                const { data: subscription } = await supabase
                    .from('subscriptions')
                    .select('user_id')
                    .eq('id', document.subscription_id)
                    .single()

                if (subscription.user_id !== userId) {
                    throw new Error('Accès non autorisé')
                }
            }

            // Supprimer le fichier du storage
            const fileName = document.document_url.split('/').pop()
            await supabase.storage
                .from('documents')
                .remove([fileName])

            // Supprimer l'enregistrement
            const { error: deleteError } = await supabase
                .from(table)
                .delete()
                .eq('id', documentId)

            if (deleteError) throw deleteError

            return { success: true }
        } catch (error) {
            console.error('Erreur suppression document:', error)
            return { success: false, error: error.message }
        }
    }

    // Vérifier la complétude des documents requis
    static async checkDocumentCompleteness(entityType, entityId) {
        try {
            const { data, error } = await supabase
                .rpc('check_documents_completeness', {
                    entity_type: entityType,
                    entity_id: entityId
                })

            if (error) throw error

            return { success: true, isComplete: data }
        } catch (error) {
            console.error('Erreur vérification complétude:', error)
            return { success: false, error: error.message }
        }
    }

    // Obtenir les statistiques des documents
    static async getDocumentStatistics() {
        try {
            const { data, error } = await supabase
                .from('document_statistics')
                .select('*')

            if (error) throw error

            return { success: true, statistics: data }
        } catch (error) {
            console.error('Erreur statistiques documents:', error)
            return { success: false, error: error.message }
        }
    }

    // Obtenir les documents en attente de vérification (admin)
    static async getPendingDocuments() {
        try {
            const [parcelleDocsResult, subscriptionDocsResult] = await Promise.all([
                supabase
                    .from('parcelle_documents')
                    .select(`
                        *,
                        parcelle:parcelle_id(matricule, nom_proprietaire),
                        proprietaire:parcelle_id(users!parcelles_proprietaire_id_fkey(nom_complet, email))
                    `)
                    .eq('is_verified', false)
                    .order('uploaded_at', { ascending: true }),
                
                supabase
                    .from('subscription_documents')
                    .select(`
                        *,
                        subscription:subscription_id(type_abonnement),
                        user:subscription_id(users!subscriptions_user_id_fkey(nom_complet, email))
                    `)
                    .eq('is_verified', false)
                    .order('uploaded_at', { ascending: true })
            ])

            const pendingDocuments = {
                parcelle_documents: parcelleDocsResult.data || [],
                subscription_documents: subscriptionDocsResult.data || [],
                total: (parcelleDocsResult.data?.length || 0) + (subscriptionDocsResult.data?.length || 0)
            }

            return { success: true, pendingDocuments }
        } catch (error) {
            console.error('Erreur documents en attente:', error)
            return { success: false, error: error.message }
        }
    }

    // Valider les types de fichiers
    static validateFileType(file) {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/jpg',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ]

        return {
            valid: allowedTypes.includes(file.mimetype),
            allowedTypes: allowedTypes
        }
    }

    // Valider la taille du fichier
    static validateFileSize(file, maxSizeMB = 10) {
        const maxSize = maxSizeMB * 1024 * 1024
        return {
            valid: file.size <= maxSize,
            maxSize: maxSizeMB,
            currentSize: Math.round(file.size / 1024 / 1024 * 100) / 100
        }
    }
}

module.exports = { DocumentService }