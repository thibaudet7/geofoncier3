-- Migration 005: Corriger les vulnérabilités RLS signalées par Supabase
-- + Compatibilité app mobile Flutter (admin, insertion documents/images)
--
-- Contexte:
--   - Alerte Supabase "Table publicly accessible" sur property_management
--   - Tables géographiques (regions, departements, divisions_administratives) sans RLS
--   - parcelle_documents/images: pas de policy INSERT pour authenticated (Flutter)
--   - contacts/subscriptions: admin mobile ne peut pas voir/modifier
--
-- IMPORTANT: Exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)
-- Idempotent: peut être ré-exécuté sans erreur

-- ===========================
-- 1. TABLES GÉOGRAPHIQUES — Activer RLS + lecture publique
-- (Le backend utilise service_role, pas affecté)
-- ===========================

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE departements ENABLE ROW LEVEL SECURITY;

-- divisions_administratives est une VIEW, pas une table → RLS non applicable

-- regions: lecture publique, écriture service_role uniquement
DROP POLICY IF EXISTS "Public can read regions" ON regions;
CREATE POLICY "Public can read regions"
    ON regions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role full access regions" ON regions;
CREATE POLICY "Service role full access regions"
    ON regions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- departements: lecture publique, écriture service_role uniquement
DROP POLICY IF EXISTS "Public can read departements" ON departements;
CREATE POLICY "Public can read departements"
    ON departements FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role full access departements" ON departements;
CREATE POLICY "Service role full access departements"
    ON departements FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- divisions_administratives est une VIEW → sécurisée par les policies
-- des tables sous-jacentes (regions, departements, arrondissements)

-- ===========================
-- 2. property_management — Ré-appliquer RLS (alerte critique Supabase)
-- La migration 003 a échoué silencieusement sur cette table
-- ===========================

DO $$ BEGIN
    EXECUTE 'ALTER TABLE property_management ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access property_management" ON property_management';
    EXECUTE 'CREATE POLICY "Service role full access property_management" ON property_management FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Owner can view own properties" ON property_management';
    EXECUTE 'CREATE POLICY "Owner can view own properties" ON property_management FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = user_id)';
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'Table property_management inexistante, skip';
END $$;

-- ===========================
-- 3. parcelle_documents — INSERT pour authenticated
-- L'app Flutter insère des documents après création de parcelle
-- Restreint au propriétaire de la parcelle liée
-- ===========================

DROP POLICY IF EXISTS "Authenticated can insert documents" ON parcelle_documents;
CREATE POLICY "Authenticated can insert documents"
    ON parcelle_documents FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM parcelles
            WHERE parcelles.id = parcelle_id
            AND parcelles.proprietaire_id = auth.uid()
        )
    );

-- ===========================
-- 4. parcelle_images — INSERT pour authenticated
-- Même logique: seul le propriétaire de la parcelle peut ajouter des images
-- ===========================

DROP POLICY IF EXISTS "Authenticated can insert images" ON parcelle_images;
CREATE POLICY "Authenticated can insert images"
    ON parcelle_images FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM parcelles
            WHERE parcelles.id = parcelle_id
            AND parcelles.proprietaire_id = auth.uid()
        )
    );

-- ===========================
-- 5. contacts — Accès admin (écran admin mobile)
-- L'admin doit voir TOUS les contacts + modifier le statut (approve/reject)
-- Les users normaux ne voient que leurs propres contacts (inchangé)
-- ===========================

DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
CREATE POLICY "Users can view own contacts"
    ON contacts FOR SELECT
    USING (
        auth.uid() = client_id
        OR auth.uid() = proprietaire_id
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type_utilisateur = 'admin')
    );

DROP POLICY IF EXISTS "Admin can update contacts" ON contacts;
CREATE POLICY "Admin can update contacts"
    ON contacts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type_utilisateur = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type_utilisateur = 'admin')
    );

-- ===========================
-- 6. subscriptions — Accès admin (écran admin mobile)
-- L'admin doit voir TOUS les abonnements
-- Les users normaux ne voient que les leurs (inchangé)
-- ===========================

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND type_utilisateur = 'admin')
    );
