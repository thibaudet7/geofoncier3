-- Migration 003: Activer RLS sur TOUTES les tables et créer des policies sécurisées
-- CORRIGE: "Table publicly accessible" (rls_disabled_in_public)
-- Exécuter dans Supabase SQL Editor

-- ===========================
-- 1. ACTIVER RLS SUR TOUTES LES TABLES
-- ===========================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelle_images ENABLE ROW LEVEL SECURITY;

-- Si la table property_management existe (signalée par Supabase)
DO $$ BEGIN
    EXECUTE 'ALTER TABLE property_management ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Arrondissements (données publiques en lecture)
DO $$ BEGIN
    EXECUTE 'ALTER TABLE arrondissements ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===========================
-- 2. POLICIES POUR TABLE users
-- ===========================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access users" ON users;
CREATE POLICY "Service role full access users"
    ON users FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 3. POLICIES POUR TABLE parcelles
-- ===========================

-- Lecture publique des parcelles actives (pour la carte)
DROP POLICY IF EXISTS "Public can view active parcelles" ON parcelles;
CREATE POLICY "Public can view active parcelles"
    ON parcelles FOR SELECT
    USING (is_active = true);

-- Propriétaire peut modifier ses propres parcelles
DROP POLICY IF EXISTS "Owner can update own parcelles" ON parcelles;
CREATE POLICY "Owner can update own parcelles"
    ON parcelles FOR UPDATE
    USING (auth.uid() = proprietaire_id)
    WITH CHECK (auth.uid() = proprietaire_id);

-- Propriétaire peut supprimer ses propres parcelles
DROP POLICY IF EXISTS "Owner can delete own parcelles" ON parcelles;
CREATE POLICY "Owner can delete own parcelles"
    ON parcelles FOR DELETE
    USING (auth.uid() = proprietaire_id);

-- Insertion : utilisateur authentifié
DROP POLICY IF EXISTS "Authenticated can insert parcelles" ON parcelles;
CREATE POLICY "Authenticated can insert parcelles"
    ON parcelles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = proprietaire_id);

DROP POLICY IF EXISTS "Service role full access parcelles" ON parcelles;
CREATE POLICY "Service role full access parcelles"
    ON parcelles FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 4. POLICIES POUR TABLE contacts
-- ===========================

DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
CREATE POLICY "Users can view own contacts"
    ON contacts FOR SELECT
    USING (auth.uid() = client_id OR auth.uid() = proprietaire_id);

DROP POLICY IF EXISTS "Authenticated can create contacts" ON contacts;
CREATE POLICY "Authenticated can create contacts"
    ON contacts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Service role full access contacts" ON contacts;
CREATE POLICY "Service role full access contacts"
    ON contacts FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 5. POLICIES POUR TABLE transactions
-- (gérée exclusivement via service_role par les routes admin)
-- ===========================

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role full access transactions" ON transactions;
CREATE POLICY "Service role full access transactions"
    ON transactions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Lecture pour les utilisateurs liés via contact_id
DROP POLICY IF EXISTS "Users can view related transactions" ON transactions;
CREATE POLICY "Users can view related transactions"
    ON transactions FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM contacts c
            WHERE c.id = contact_id
            AND (c.client_id = auth.uid() OR c.proprietaire_id = auth.uid())
        )
    );

-- ===========================
-- 6. POLICIES POUR TABLE notifications
-- ===========================

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
CREATE POLICY "Service role full access notifications"
    ON notifications FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 7. POLICIES POUR TABLE favorites
-- ===========================

DROP POLICY IF EXISTS "Users can manage own favorites" ON favorites;
CREATE POLICY "Users can manage own favorites"
    ON favorites FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access favorites" ON favorites;
CREATE POLICY "Service role full access favorites"
    ON favorites FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 8. POLICIES POUR TABLE site_visits
-- ===========================

-- Seul le service_role peut insérer/lire (le backend insère via service_role)
DROP POLICY IF EXISTS "Service role full access site_visits" ON site_visits;
CREATE POLICY "Service role full access site_visits"
    ON site_visits FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 9. POLICIES POUR TABLE parcelle_documents
-- ===========================

DROP POLICY IF EXISTS "Public can view documents" ON parcelle_documents;
CREATE POLICY "Public can view documents"
    ON parcelle_documents FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role full access documents" ON parcelle_documents;
CREATE POLICY "Service role full access documents"
    ON parcelle_documents FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 10. POLICIES POUR TABLE parcelle_images
-- ===========================

DROP POLICY IF EXISTS "Public can view images" ON parcelle_images;
CREATE POLICY "Public can view images"
    ON parcelle_images FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Service role full access images" ON parcelle_images;
CREATE POLICY "Service role full access images"
    ON parcelle_images FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ===========================
-- 11. POLICIES POUR TABLE property_management (si elle existe)
-- ===========================

DO $$ BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access property_management" ON property_management';
    EXECUTE 'CREATE POLICY "Service role full access property_management" ON property_management FOR ALL TO service_role USING (true) WITH CHECK (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Owner can view own properties" ON property_management';
    EXECUTE 'CREATE POLICY "Owner can view own properties" ON property_management FOR SELECT USING (auth.uid() = owner_id OR auth.uid() = user_id)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===========================
-- 12. POLICIES POUR TABLE arrondissements (données publiques)
-- ===========================

DO $$ BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Public can read arrondissements" ON arrondissements';
    EXECUTE 'CREATE POLICY "Public can read arrondissements" ON arrondissements FOR SELECT USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS "Service role full access arrondissements" ON arrondissements';
    EXECUTE 'CREATE POLICY "Service role full access arrondissements" ON arrondissements FOR ALL TO service_role USING (true) WITH CHECK (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===========================
-- 13. POLICIES POUR TABLE subscriptions (compléter migration 002)
-- ===========================

-- La migration 002 avait une policy trop permissive, on la remplace
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role full access subscriptions"
    ON subscriptions FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Garder la policy user read
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);
