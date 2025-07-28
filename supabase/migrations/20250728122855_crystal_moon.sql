/*
  # Mise à jour du système de tarification et ajout des pièces justificatives

  1. Nouvelles Tables
    - `pricing_tiers` - Tarifs par paliers de superficie
    - `parcelle_documents` - Documents justificatifs des parcelles
    - `subscription_documents` - Documents d'abonnement
  
  2. Modifications Tables Existantes
    - `subscriptions` - Ajout champs pour nouveaux tarifs
    - `parcelles` - Ajout référence aux documents
  
  3. Sécurité
    - RLS activé sur toutes les nouvelles tables
    - Politiques d'accès appropriées
  
  4. Fonctions
    - Calcul automatique des tarifs par superficie
    - Validation des documents
*/

-- Mise à jour de la table pricing_tiers avec les nouveaux tarifs
UPDATE pricing_tiers SET 
  base_price = 1000,
  price_per_unit = 2,
  unit_size = 1,
  description = 'Tarif de base : 1000 XAF + 2 XAF par m²',
  example_calculation = 'Exemple : 500m² = 1000 + (500 × 2) = 2000 XAF'
WHERE tier_name = 'proprietaire_base' AND user_type = 'proprietaire';

-- Insérer les nouveaux paliers de tarification
INSERT INTO pricing_tiers (tier_name, user_type, min_superficie, max_superficie, base_price, price_per_unit, unit_size, region, period, description, example_calculation) VALUES
-- Palier 1 : 0-1000 m²
('proprietaire_palier_1', 'proprietaire', 0, 1000, 1000, 2, 1, 'Toutes', 'mensuel', 
 'Palier 1 : Tarif de base 1000 XAF + 2 XAF/m²', 
 'Exemple 500m² : 1000 + (500 × 2) = 2000 XAF'),

-- Palier 2 : 1001-5000 m²
('proprietaire_palier_2', 'proprietaire', 1001, 5000, 1000, 1.5, 1, 'Toutes', 'mensuel',
 'Palier 2 : Tarif de base 1000 XAF + 1.5 XAF/m²',
 'Exemple 3000m² : 1000 + (3000 × 1.5) = 5500 XAF'),

-- Palier 3 : 5001-10000 m²
('proprietaire_palier_3', 'proprietaire', 5001, 10000, 1000, 1, 1, 'Toutes', 'mensuel',
 'Palier 3 : Tarif de base 1000 XAF + 1 XAF/m²',
 'Exemple 8000m² : 1000 + (8000 × 1) = 9000 XAF'),

-- Palier 4 : Plus de 10000 m²
('proprietaire_palier_4', 'proprietaire', 10001, NULL, 1000, 0.5, 1, 'Toutes', 'mensuel',
 'Palier 4 : Tarif de base 1000 XAF + 0.5 XAF/m²',
 'Exemple 15000m² : 1000 + (15000 × 0.5) = 8500 XAF'),

-- Tarifs clients (inchangés mais clarifiés)
('client_mensuel_afrique', 'client', NULL, NULL, 5000, NULL, NULL, 'Afrique', 'mensuel',
 'Abonnement mensuel pour clients en Afrique', '5000 XAF par mois'),

('client_annuel_afrique', 'client', NULL, NULL, 50000, NULL, NULL, 'Afrique', 'annuel',
 'Abonnement annuel pour clients en Afrique (2 mois gratuits)', '50000 XAF par an'),

('client_mensuel_hors_afrique', 'client', NULL, NULL, 50000, NULL, NULL, 'Hors Afrique', 'mensuel',
 'Abonnement mensuel pour clients hors Afrique', '50000 XAF par mois'),

('client_annuel_hors_afrique', 'client', NULL, NULL, 500000, NULL, NULL, 'Hors Afrique', 'annuel',
 'Abonnement annuel pour clients hors Afrique (2 mois gratuits)', '500000 XAF par an')

ON CONFLICT (tier_name) DO UPDATE SET
  base_price = EXCLUDED.base_price,
  price_per_unit = EXCLUDED.price_per_unit,
  description = EXCLUDED.description,
  example_calculation = EXCLUDED.example_calculation,
  updated_at = now();

-- Créer la table des documents de parcelles
CREATE TABLE IF NOT EXISTS parcelle_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelle_id uuid REFERENCES parcelles(id) ON DELETE CASCADE,
  document_type varchar(50) NOT NULL CHECK (document_type IN ('acte_foncier', 'titre_propriete', 'certificat_occupation', 'plan_cadastral', 'autre')),
  document_name varchar(255) NOT NULL,
  document_url text NOT NULL,
  file_size bigint,
  mime_type varchar(100),
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index pour les documents de parcelles
CREATE INDEX IF NOT EXISTS idx_parcelle_documents_parcelle_id ON parcelle_documents(parcelle_id);
CREATE INDEX IF NOT EXISTS idx_parcelle_documents_type ON parcelle_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_parcelle_documents_verified ON parcelle_documents(is_verified);

-- RLS pour parcelle_documents
ALTER TABLE parcelle_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Propriétaires peuvent gérer leurs documents de parcelles"
  ON parcelle_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parcelles p 
      WHERE p.id = parcelle_documents.parcelle_id 
      AND p.proprietaire_id = auth.uid()
    )
  );

CREATE POLICY "Admins peuvent gérer tous les documents de parcelles"
  ON parcelle_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.type_utilisateur = 'admin'
    )
  );

CREATE POLICY "Clients peuvent voir les documents des parcelles publiques"
  ON parcelle_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parcelles p 
      WHERE p.id = parcelle_documents.parcelle_id 
      AND p.is_active = true
    )
  );

-- Créer la table des documents d'abonnement
CREATE TABLE IF NOT EXISTS subscription_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE CASCADE,
  document_type varchar(50) NOT NULL CHECK (document_type IN ('justificatif_propriete', 'piece_identite', 'justificatif_domicile', 'autre')),
  document_name varchar(255) NOT NULL,
  document_url text NOT NULL,
  file_size bigint,
  mime_type varchar(100),
  is_verified boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Index pour les documents d'abonnement
CREATE INDEX IF NOT EXISTS idx_subscription_documents_subscription_id ON subscription_documents(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_documents_type ON subscription_documents(document_type);

-- RLS pour subscription_documents
ALTER TABLE subscription_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilisateurs peuvent gérer leurs documents d'abonnement"
  ON subscription_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM subscriptions s 
      WHERE s.id = subscription_documents.subscription_id 
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins peuvent gérer tous les documents d'abonnement"
  ON subscription_documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.type_utilisateur = 'admin'
    )
  );

-- Ajouter des colonnes à la table subscriptions pour les nouveaux champs
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS superficie_declaree numeric(12,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tarif_calcule numeric(10,2);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS palier_tarifaire varchar(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS documents_required boolean DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS documents_complete boolean DEFAULT false;

-- Ajouter des colonnes à la table parcelles pour les documents
ALTER TABLE parcelles ADD COLUMN IF NOT EXISTS has_acte_foncier boolean DEFAULT false;
ALTER TABLE parcelles ADD COLUMN IF NOT EXISTS acte_foncier_verified boolean DEFAULT false;
ALTER TABLE parcelles ADD COLUMN IF NOT EXISTS documents_complete boolean DEFAULT false;

-- Fonction pour calculer le tarif selon les nouveaux paliers
CREATE OR REPLACE FUNCTION calculate_proprietaire_pricing(superficie numeric)
RETURNS TABLE(
  palier varchar(50),
  tarif_mensuel numeric(10,2),
  tarif_annuel numeric(10,2),
  details text
) AS $$
DECLARE
  base_price numeric := 1000;
  price_per_m2 numeric;
  calculated_price numeric;
  tier_name varchar(50);
  calculation_details text;
BEGIN
  -- Déterminer le palier et le prix par m²
  IF superficie <= 1000 THEN
    price_per_m2 := 2;
    tier_name := 'proprietaire_palier_1';
    calculation_details := format('Palier 1: %s XAF + (%s m² × %s XAF/m²)', base_price, superficie, price_per_m2);
  ELSIF superficie <= 5000 THEN
    price_per_m2 := 1.5;
    tier_name := 'proprietaire_palier_2';
    calculation_details := format('Palier 2: %s XAF + (%s m² × %s XAF/m²)', base_price, superficie, price_per_m2);
  ELSIF superficie <= 10000 THEN
    price_per_m2 := 1;
    tier_name := 'proprietaire_palier_3';
    calculation_details := format('Palier 3: %s XAF + (%s m² × %s XAF/m²)', base_price, superficie, price_per_m2);
  ELSE
    price_per_m2 := 0.5;
    tier_name := 'proprietaire_palier_4';
    calculation_details := format('Palier 4: %s XAF + (%s m² × %s XAF/m²)', base_price, superficie, price_per_m2);
  END IF;

  -- Calculer le prix
  calculated_price := base_price + (superficie * price_per_m2);

  -- Retourner les résultats
  palier := tier_name;
  tarif_mensuel := calculated_price;
  tarif_annuel := calculated_price * 12 * 0.9; -- 10% de réduction pour l'annuel
  details := calculation_details || format(' = %s XAF/mois', calculated_price);

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour vérifier la complétude des documents
CREATE OR REPLACE FUNCTION check_documents_completeness(entity_type text, entity_id uuid)
RETURNS boolean AS $$
DECLARE
  required_docs text[];
  uploaded_docs text[];
  doc_count integer;
BEGIN
  IF entity_type = 'parcelle' THEN
    -- Documents requis pour une parcelle
    required_docs := ARRAY['acte_foncier'];
    
    SELECT array_agg(document_type) INTO uploaded_docs
    FROM parcelle_documents 
    WHERE parcelle_id = entity_id AND is_verified = true;
    
  ELSIF entity_type = 'subscription' THEN
    -- Documents requis pour un abonnement propriétaire
    required_docs := ARRAY['justificatif_propriete', 'piece_identite'];
    
    SELECT array_agg(document_type) INTO uploaded_docs
    FROM subscription_documents 
    WHERE subscription_id = entity_id AND is_verified = true;
  END IF;

  -- Vérifier si tous les documents requis sont présents
  SELECT count(*) INTO doc_count
  FROM unnest(required_docs) AS required_doc
  WHERE required_doc = ANY(uploaded_docs);

  RETURN doc_count = array_length(required_docs, 1);
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour automatiquement le statut des documents
CREATE OR REPLACE FUNCTION update_documents_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'parcelle_documents' THEN
    UPDATE parcelles 
    SET 
      has_acte_foncier = EXISTS(
        SELECT 1 FROM parcelle_documents 
        WHERE parcelle_id = NEW.parcelle_id 
        AND document_type = 'acte_foncier'
      ),
      acte_foncier_verified = EXISTS(
        SELECT 1 FROM parcelle_documents 
        WHERE parcelle_id = NEW.parcelle_id 
        AND document_type = 'acte_foncier' 
        AND is_verified = true
      ),
      documents_complete = check_documents_completeness('parcelle', NEW.parcelle_id)
    WHERE id = NEW.parcelle_id;
    
  ELSIF TG_TABLE_NAME = 'subscription_documents' THEN
    UPDATE subscriptions 
    SET documents_complete = check_documents_completeness('subscription', NEW.subscription_id)
    WHERE id = NEW.subscription_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS trigger_update_parcelle_documents_status ON parcelle_documents;
CREATE TRIGGER trigger_update_parcelle_documents_status
  AFTER INSERT OR UPDATE OR DELETE ON parcelle_documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_status();

DROP TRIGGER IF EXISTS trigger_update_subscription_documents_status ON subscription_documents;
CREATE TRIGGER trigger_update_subscription_documents_status
  AFTER INSERT OR UPDATE OR DELETE ON subscription_documents
  FOR EACH ROW EXECUTE FUNCTION update_documents_status();

-- Vue pour les statistiques des documents
CREATE OR REPLACE VIEW document_statistics AS
SELECT 
  'parcelle' as entity_type,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE is_verified = true) as verified_documents,
  COUNT(*) FILTER (WHERE is_verified = false) as pending_documents,
  COUNT(DISTINCT parcelle_id) as entities_with_documents
FROM parcelle_documents
UNION ALL
SELECT 
  'subscription' as entity_type,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE is_verified = true) as verified_documents,
  COUNT(*) FILTER (WHERE is_verified = false) as pending_documents,
  COUNT(DISTINCT subscription_id) as entities_with_documents
FROM subscription_documents;

-- Insérer des données de test pour les nouveaux paliers
INSERT INTO system_logs (action, details) VALUES 
('PRICING_UPDATE', 'Mise à jour du système de tarification avec paliers par superficie'),
('DOCUMENTS_SYSTEM', 'Ajout du système de gestion des documents justificatifs');