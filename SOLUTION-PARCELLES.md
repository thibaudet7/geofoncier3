# Solution au problème d'insertion de parcelles

## 🔍 Problème identifié

Les parcelles ne sont pas ajoutées dans Supabase malgré le message "parcelle ajoutée avec succès" car **les enums PostgreSQL nécessaires n'existent pas** dans la base de données.

### Erreur spécifique
```
invalid input value for enum activite_type: "agriculture"
```

## 📋 Enums manquants

Les enums suivants doivent être créés dans Supabase :

1. `activite_type` - Types d'activité des parcelles
2. `contact_status` - Statuts des contacts
3. `subscription_type` - Types d'abonnement
4. `subscription_status` - Statuts d'abonnement
5. `transaction_status` - Statuts de transaction
6. `user_type` - Types d'utilisateur
7. `piece_type` - Types de pièce d'identité

## 🔧 Solution

### Étape 1: Créer les enums dans Supabase

1. Ouvrez votre dashboard Supabase
2. Allez dans l'éditeur SQL
3. Exécutez le contenu du fichier `create-enums.sql` :

```sql
-- 1. Enum pour les types d'activité des parcelles
CREATE TYPE public.activite_type AS ENUM (
    'agriculture',
    'habitation', 
    'commerce',
    'industrie',
    'mixte',
    'autre'
);

-- 2. Enum pour les statuts de contact
CREATE TYPE public.contact_status AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'completed'
);

-- 3. Enum pour les types d'abonnement
CREATE TYPE public.subscription_type AS ENUM (
    'proprietaire',
    'client',
    'premium'
);

-- 4. Enum pour les statuts d'abonnement
CREATE TYPE public.subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);

-- 5. Enum pour les statuts de transaction
CREATE TYPE public.transaction_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);

-- 6. Enum pour les types d'utilisateur
CREATE TYPE public.user_type AS ENUM (
    'client',
    'proprietaire',
    'admin'
);

-- 7. Enum pour les types de pièce d'identité
CREATE TYPE public.piece_type AS ENUM (
    'CNI',
    'passeport',
    'permis_conduire',
    'autre'
);
```

### Étape 2: Vérifier la création

Exécutez cette requête pour vérifier que les enums ont été créés :

```sql
SELECT 
    t.typname as enum_name,
    array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
WHERE t.typname IN (
    'activite_type', 
    'contact_status', 
    'subscription_type', 
    'subscription_status', 
    'transaction_status', 
    'user_type', 
    'piece_type'
)
GROUP BY t.typname
ORDER BY t.typname;
```

### Étape 3: Tester la solution

Une fois les enums créés, testez l'insertion :

```bash
cd api
node create-enums.js
```

Si le test réussit, vous verrez :
```
✅ Enum activite_type existe et fonctionne !
```

## 🧪 Scripts de test disponibles

- `api/debug-parcelle.js` - Test d'insertion basique
- `api/test-enum.js` - Test des valeurs d'enum
- `api/create-enums.js` - Vérification et instructions

## 📝 Valeurs d'activité supportées

Une fois les enums créés, ces valeurs seront acceptées pour le champ `activite` :

- `agriculture` - Activités agricoles
- `habitation` - Usage résidentiel
- `commerce` - Activités commerciales
- `industrie` - Activités industrielles
- `mixte` - Usage mixte
- `autre` - Autres usages

## ⚠️ Important

- Les enums doivent être créés **avant** d'insérer des parcelles
- Une fois créés, ils ne peuvent pas être modifiés facilement
- Assurez-vous que toutes les valeurs nécessaires sont incluses

## 🔄 Après la correction

Une fois les enums créés, l'insertion de parcelles fonctionnera normalement et vous verrez les parcelles apparaître dans Supabase.