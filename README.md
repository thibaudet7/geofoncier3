# GéoFoncier Backend

Application de gestion des parcelles foncières avec PostGIS et Flutterwave.

## 🚀 Installation rapide

```bash
# 1. Cloner et installer
git clone <votre-repo>
cd geofoncier
npm install

# 2. Configuration
cp .env.example .env.local
# Éditer .env.local avec vos clés

# 3. Base de données
npm run setup-db

# 4. Démarrer
npm run dev
```

## 📊 Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com)
2. Activer PostGIS dans l'éditeur SQL :
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
3. Exécuter le schéma : `supabase/schema.sql`
4. Configurer les politiques : `supabase/policies.sql`
5. Insérer les données initiales : `supabase/seed.sql`

## 💳 Configuration Flutterwave

1. Créer un compte sur [flutterwave.com](https://flutterwave.com)
2. Récupérer les clés API (test et live)
3. Configurer les webhooks : `votre-domaine.com/api/payment/webhook`

## 📡 API Routes

- `POST /api/auth/register` - Inscription
- `POST /api/auth/login` - Connexion
- `GET /api/parcelles` - Liste des parcelles
- `POST /api/parcelles` - Créer une parcelle (nécessite une authentification)
- `GET /api/spatial/arrondissements` - Arrondissements
- `POST /api/payment/initiate` - Initier un paiement
- `POST /api/contact/initiate` - Demande de contact
- `POST /api/csv/import` - Import CSV

## 🔐 Authentification

Certaines routes de l'API nécessitent une authentification. Pour accéder à ces routes, vous devez inclure un header d'autorisation avec un token JWT valide :

```
Authorization: Bearer <votre_token_jwt>
```

Les routes protégées incluent :
- `POST /api/parcelles` - Création de parcelles (seulement pour l'utilisateur authentifié)

## 🔧 Déploiement

### Heroku
```bash
heroku create geofoncier-api
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=...
git push heroku main
```

### Railway
```bash
railway login
railway init
railway add
railway deploy
```

## 📝 Tests

```bash
npm test
```

## 🛠️ Structure

- `api/server.js` - Serveur principal
- `api/routes/` - Routes API
- `api/services/` - Services métier
- `supabase/` - Configuration base de données
- `scripts/` - Scripts utilitaires
        