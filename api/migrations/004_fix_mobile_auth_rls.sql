-- Migration 004: Corriger RLS pour l'authentification mobile
-- Problème: l'app mobile fait des SELECT sur la table users AVANT authentification
-- (résolution téléphone → email) et l'ancienne policy bloquait tout accès anon.
--
-- IMPORTANT: Exécuter dans Supabase SQL Editor (Dashboard > SQL Editor)

-- ===========================
-- 1. POLICY POUR LOGIN PAR TELEPHONE (anon, pré-authentification)
-- L'app mobile cherche l'email associé à un numéro avant de pouvoir s'authentifier.
-- Sans cette policy, la requête échoue silencieusement → "Numéro non trouvé"
-- ===========================

DROP POLICY IF EXISTS "Allow public read for phone login" ON users;
CREATE POLICY "Allow public read for phone login"
    ON users FOR SELECT
    TO anon
    USING (telephone IS NOT NULL AND telephone != '');

-- ===========================
-- 2. POLICY POUR UTILISATEURS AUTHENTIFIÉS (lecture élargie)
-- Nécessaire pour: admin voir tous les users, contacts entre client/propriétaire,
-- et chargement du profil après login.
-- L'ancienne policy (auth.uid() = id) était trop restrictive et cassait l'admin.
-- ===========================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Authenticated can view all users" ON users;
CREATE POLICY "Authenticated can view all users"
    ON users FOR SELECT
    TO authenticated
    USING (true);

-- ===========================
-- 3. GARDER les policies d'écriture restrictives
-- (inchangées - un user ne peut modifier QUE son propre profil)
-- ===========================

-- Policy UPDATE reste: auth.uid() = id (déjà en place via migration 003)
-- Policy service_role reste: full access (déjà en place via migration 003)
