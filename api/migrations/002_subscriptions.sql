-- Migration 002: Table subscriptions pour le système de paiement
-- Exécuter dans Supabase SQL Editor

-- Enum pour le type d'abonnement
DO $$ BEGIN
    CREATE TYPE subscription_type AS ENUM ('client', 'proprietaire', 'premium');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Enum pour le statut de l'abonnement
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Table subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type_abonnement subscription_type NOT NULL,
    montant NUMERIC(12, 2) NOT NULL DEFAULT 0,
    devise TEXT NOT NULL DEFAULT 'XAF',
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE NOT NULL,
    statut subscription_status NOT NULL DEFAULT 'pending',
    flutterwave_transaction_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_statut ON subscriptions(statut);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON subscriptions(user_id, statut) WHERE statut = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_tx_ref ON subscriptions(flutterwave_transaction_id);

-- Fonction pour expirer automatiquement les abonnements
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS void AS $$
BEGIN
    UPDATE subscriptions
    SET statut = 'expired', updated_at = NOW()
    WHERE statut = 'active' AND date_fin < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- Désactiver RLS pour cette table (gérée côté serveur via service_role)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy : les utilisateurs peuvent voir leurs propres abonnements
CREATE POLICY IF NOT EXISTS "Users can view own subscriptions"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Policy : insertion via service_role uniquement (le backend insère)
CREATE POLICY IF NOT EXISTS "Service role can manage subscriptions"
    ON subscriptions FOR ALL
    USING (true)
    WITH CHECK (true);
