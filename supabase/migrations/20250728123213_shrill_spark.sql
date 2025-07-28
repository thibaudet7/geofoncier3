/*
  # Création du bucket de stockage pour les documents

  1. Bucket Storage
    - Création du bucket 'documents'
    - Configuration des politiques d'accès
  
  2. Sécurité
    - RLS sur le bucket
    - Politiques d'upload et de lecture
*/

-- Créer le bucket pour les documents s'il n'existe pas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- Politique pour permettre aux utilisateurs authentifiés d'uploader leurs documents
CREATE POLICY "Utilisateurs peuvent uploader leurs documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (
    -- Documents de parcelles : vérifier que l'utilisateur est propriétaire
    (
      (storage.foldername(name))[1] = 'parcelles' AND
      EXISTS (
        SELECT 1 FROM parcelles 
        WHERE id::text = (storage.foldername(name))[2] 
        AND proprietaire_id = auth.uid()
      )
    ) OR
    -- Documents d'abonnements : vérifier que l'utilisateur est le souscripteur
    (
      (storage.foldername(name))[1] = 'subscriptions' AND
      EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE id::text = (storage.foldername(name))[2] 
        AND user_id = auth.uid()
      )
    )
  )
);

-- Politique pour permettre aux utilisateurs de voir leurs documents
CREATE POLICY "Utilisateurs peuvent voir leurs documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Documents de parcelles
    (
      (storage.foldername(name))[1] = 'parcelles' AND
      (
        -- Propriétaire de la parcelle
        EXISTS (
          SELECT 1 FROM parcelles 
          WHERE id::text = (storage.foldername(name))[2] 
          AND proprietaire_id = auth.uid()
        ) OR
        -- Admin
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND type_utilisateur = 'admin'
        ) OR
        -- Client peut voir les documents des parcelles actives
        EXISTS (
          SELECT 1 FROM parcelles 
          WHERE id::text = (storage.foldername(name))[2] 
          AND is_active = true
        )
      )
    ) OR
    -- Documents d'abonnements
    (
      (storage.foldername(name))[1] = 'subscriptions' AND
      (
        -- Propriétaire de l'abonnement
        EXISTS (
          SELECT 1 FROM subscriptions 
          WHERE id::text = (storage.foldername(name))[2] 
          AND user_id = auth.uid()
        ) OR
        -- Admin
        EXISTS (
          SELECT 1 FROM users 
          WHERE id = auth.uid() 
          AND type_utilisateur = 'admin'
        )
      )
    )
  )
);

-- Politique pour permettre aux admins de gérer tous les documents
CREATE POLICY "Admins peuvent gérer tous les documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND type_utilisateur = 'admin'
  )
);

-- Politique pour permettre aux utilisateurs de supprimer leurs documents
CREATE POLICY "Utilisateurs peuvent supprimer leurs documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (
    -- Documents de parcelles
    (
      (storage.foldername(name))[1] = 'parcelles' AND
      EXISTS (
        SELECT 1 FROM parcelles 
        WHERE id::text = (storage.foldername(name))[2] 
        AND proprietaire_id = auth.uid()
      )
    ) OR
    -- Documents d'abonnements
    (
      (storage.foldername(name))[1] = 'subscriptions' AND
      EXISTS (
        SELECT 1 FROM subscriptions 
        WHERE id::text = (storage.foldername(name))[2] 
        AND user_id = auth.uid()
      )
    ) OR
    -- Admin peut tout supprimer
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND type_utilisateur = 'admin'
    )
  )
);

-- Fonction utilitaire pour obtenir les dossiers du chemin
CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[] AS $$
BEGIN
  RETURN string_to_array(name, '/');
END;
$$ LANGUAGE plpgsql;

-- Log de la création
INSERT INTO system_logs (action, details) VALUES 
('STORAGE_BUCKET', 'Création du bucket documents avec politiques de sécurité');