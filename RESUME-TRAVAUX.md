# GéoFoncier — Résumé des travaux & État de l'application

> Document destiné à être partagé avec un assistant IA (Claude) pour reprendre le développement sans perte de contexte.
> Dernière mise à jour : 2026-07-09

---

## 1. Vue d'ensemble du projet

**GéoFoncier** est une application web de gestion de parcelles foncières au Cameroun. Elle permet aux propriétaires d'enregistrer leurs terrains (titrés ou non titrés) avec géolocalisation précise, et aux clients de consulter/rechercher des parcelles disponibles.

### Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | HTML/CSS/JS vanilla (SPA mono-fichier `index.html`) + Leaflet.js (carte) |
| Backend | Node.js / Express (fichier d'entrée : `api/server.js`) |
| Base de données | PostgreSQL + PostGIS via **Supabase** |
| Stockage fichiers | Supabase Storage (buckets `parcelle-documents`, `parcelle-images`) |
| Auth | Supabase Auth + JWT custom (7 jours) |
| Paiement | **Flutterwave** inline checkout (clé publique live) |
| Déploiement | **Vercel** (serverless Node) |
| Coordonnées | **proj4** pour transformations UTM32/33/Douala → WGS84 |

### URLs

| Ressource | URL |
|-----------|-----|
| Production | https://geofoncier.shop |
| GitHub | https://github.com/thibaudet7/geofoncier3 |
| Supabase | https://boyyptqybnsiwnkdpfbl.supabase.co |

### Contacts du site

| Canal | Coordonnée |
|-------|-----------|
| Email | monvillage.cm@gmail.com |
| Téléphone | +237 621 703 945 |

---

## 2. Architecture des fichiers

```
geofoncier/
├── index.html                 # Frontend complet (SPA ~7000 lignes)
├── package.json               # Dépendances Node.js
├── vercel.json                # Config Vercel (toutes routes → api/server.js)
├── .env                       # Variables d'environnement (local)
├── api/
│   ├── server.js              # Point d'entrée Express (CORS, rate-limit, static)
│   ├── supabase-config.js     # Client Supabase (anon + service_role)
│   ├── middleware/
│   │   └── auth.js            # authenticateUser, requireAdmin, requireRole
│   ├── routes/
│   │   ├── auth.js            # POST /login, /register, /logout, /forgot-password
│   │   ├── parcelles.js       # CRUD parcelles (GET, POST, PUT, DELETE)
│   │   ├── payment.js         # Initiate, verify, webhook, pricing, callback
│   │   ├── admin.js           # Stats, contacts, parcelles CRUD, visits
│   │   ├── favorites.js       # GET/POST/DELETE favoris utilisateur
│   │   ├── contact.js         # Demandes de contact client→propriétaire
│   │   ├── notifications.js   # Notifications utilisateur
│   │   ├── spatial.js         # Arrondissements GeoJSON, overlaps
│   │   └── csv.js             # Import CSV de parcelles
│   └── services/
│       ├── ParcelleService.js         # Création, upload docs, conversion coords
│       ├── FlutterwaveService.js      # Pricing, initiate, verify, webhook
│       ├── AuthService.js             # Register, login, password reset
│       ├── SpatialService.js          # PostGIS queries, arrondissements
│       ├── ContactService.js          # Gestion contacts
│       ├── NotificationService.js     # CRUD notifications
│       ├── CoordinateTransformService.js # Transformations (legacy, remplacé par proj4 dans ParcelleService)
│       └── CSVImportService.js        # Import bulk via CSV
└── public/                    # Assets statiques (images, etc.)
```

---

## 3. Base de données (Supabase / PostgreSQL + PostGIS)

### Tables principales

| Table | Description |
|-------|-------------|
| `users` | Utilisateurs (id uuid FK vers auth.users, nom_complet, email, telephone, type_utilisateur, type_piece_identite, numero_piece_identite, localisation) |
| `parcelles` | Parcelles foncières (id uuid, matricule, proprietaire_id, geom geometry(Polygon,4326), is_terrain_titre, superficie_calculee, activite enum, quartier_village, prix_m2, nom_proprietaire, telephone_proprietaire, is_active, ...) |
| `parcelle_documents` | Documents liés (parcelle_id, document_type enum, document_url, is_verified, verified_by, ...) |
| `parcelle_images` | Photos terrain (parcelle_id, image_url, image_ordre) |
| `subscriptions` | Abonnements/paiements (user_id, type_abonnement, montant, statut, flutterwave_transaction_id, date_debut, date_fin) |
| `contacts` | Demandes de contact (client_id, proprietaire_id, parcelle_id, statut, date_contact) |
| `transactions` | Transactions financières (contact_id, montant, statut) |
| `favorites` | Parcelles favorites (user_id, parcelle_id) |
| `notifications` | Notifications in-app (user_id, type, title, message, is_read) |
| `site_visits` | Tracking des visites (created_at, user_agent, ip) |
| `arrondissements` | Limites administratives GeoJSON (nom, geom) |

### Enums

- `activite` : `propriete_privee`, `vente_terrain`, `location_construction`, `location_agriculture`, `autres`
- `document_type` : `acte_foncier`, `titre_propriete`, `certificat_occupation`, `plan_cadastral`, `autre`

### Buckets Storage

- `parcelle-documents` : CNI, actes fonciers, justificatifs (public)
- `parcelle-images` : Photos terrain (public)

---

## 4. Authentification & Rôles

### 3 rôles utilisateur

| Rôle | Droits |
|------|--------|
| `admin` | Tout : CRUD parcelles, voir docs/infos propriétaires, supprimer, stats |
| `proprietaire` | Enregistrer ses parcelles (après paiement), voir ses parcelles. **Ne peut PAS contacter un autre propriétaire** (doit s'inscrire comme client) |
| `client` | Consulter parcelles, rechercher, contacter propriétaires (abonnement requis) |

### Comptes existants

| Email | Rôle | Mot de passe |
|-------|------|-------------|
| `geospatial.estate@gmail.com` | admin | `Admin2025!` |
| `ekanimeb@yahoo.fr` | proprietaire | (défini à l'inscription) |
| `villagemarte@gmail.com` | client | (défini à l'inscription) |

### Flux auth

1. Frontend → `POST /api/auth/login` (identifier = email ou téléphone)
2. Backend résout téléphone→email si besoin, appelle `supabase.auth.signInWithPassword()`
3. Retourne JWT custom (7j) stocké dans `localStorage.authToken`
4. Middleware `authenticateUser` vérifie via `supabase.auth.getUser(token)`

---

## 5. Flux d'enregistrement d'une parcelle (propriétaire)

```
1. Propriétaire connecté clique "+" sur la carte
2. Remplit formulaire : statut, matricule, coordonnées, activité, documents
3. Clique "Enregistrer la parcelle"
4. Frontend envoie FormData à POST /api/parcelles
5. Backend calcule superficie → vérifie abonnement actif
6. Si pas d'abonnement actif → retourne 403 + montant requis
7. Frontend affiche montant, ouvre FlutterwaveCheckout (inline SDK)
8. Après paiement réussi (callback SDK status=successful) :
   a. Frontend appelle GET /api/payment/verify/:transactionId?tx_ref=...
   b. Backend active l'abonnement (statut→active)
   c. Frontend ré-envoie le FormData à POST /api/parcelles
   d. Backend trouve maintenant un abonnement actif → crée la parcelle
   e. Backend upload les documents dans Supabase Storage
   f. Backend consomme l'abonnement (statut→expired)
9. Parcelle apparaît sur la carte
```

### Tarification propriétaire (par parcelle)

| Superficie | Montant annuel |
|-----------|---------------|
| ≤ 500 m² | 5 000 XAF |
| 501 – 5 000 m² | 7 000 XAF / tranche de 1 000 m² entamée |
| 5 001 – 10 000 m² | 45 000 XAF |
| 1,01 – 10 ha | 60 000 XAF |
| > 10 ha | 60 000 + 65 000 XAF / tranche de 10 ha au-delà |

---

## 6. Paiement (Flutterwave)

### Configuration actuelle

- **Clé publique LIVE** : `FLWPUBK-de06efbef44902ddb3aa4a1680436c38-X`
- **Secret key** : non utilisée (commentée dans .env)
- Le checkout est 100% inline (SDK JavaScript) — pas besoin de secret key
- Options de paiement : Mobile Money (MTN/Orange Cameroun) + Carte bancaire
- La vérification server-side (via API Flutterwave) est optionnelle et ne s'exécute que si `FLUTTERWAVE_SECRET_KEY` est définie

### Variables d'environnement Vercel requises

```
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-de06efbef44902ddb3aa4a1680436c38-X
APP_URL=https://geofoncier.vercel.app
SUPABASE_URL=https://boyyptqybnsiwnkdpfbl.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>
JWT_SECRET=<secret>
```

---

## 7. Systèmes de coordonnées

L'application supporte 4 systèmes d'entrée :

| Système | Description | Convention d'entrée |
|---------|-------------|-------------------|
| `wgs84` | GPS standard | [latitude, longitude] (degrés décimaux) |
| `utm32` | UTM Zone 32N | [Easting (X), Northing (Y)] en mètres — Ouest Cameroun |
| `utm33` | UTM Zone 33N | [Easting (X), Northing (Y)] en mètres — Est Cameroun |
| `douala` | Douala 1948 | [Easting (X), Northing (Y)] en mètres — ancien système local |

### Flux de conversion

1. Entrée utilisateur selon le système choisi
2. `ParcelleService.convertToWGS84()` via **proj4** → sortie `[lat, lng]`
3. Conversion en GeoJSON : `[lng, lat]` (norme GeoJSON)
4. Stockage PostGIS en `geometry(Polygon, 4326)`
5. Garde-fou : lat ∈ [1, 13], lng ∈ [8, 17] (bornes Cameroun)

---

## 8. Fonctionnalités implémentées

### Frontend (index.html)

- [x] Carte Leaflet avec couches : arrondissements, parcelles, chevauchements
- [x] Légende dynamique (terrain titré privé, à vendre, non titré, chevauchement)
- [x] Recherche par matricule
- [x] Filtres : arrondissement, quartier, activité, prix, statut
- [x] Formulaire inscription (propriétaire/client)
- [x] Formulaire connexion (email ou téléphone)
- [x] Formulaire ajout parcelle (tableau ou texte libre pour coordonnées)
- [x] Sélecteur système de coordonnées (WGS84, UTM32, UTM33, Douala)
- [x] Upload documents : CNI + actes fonciers (multiples) + photos terrain
- [x] Paiement inline Flutterwave (Mobile Money + Carte)
- [x] Panel admin : stats, parcelles, contacts, suppression
- [x] Vue détail parcelle admin (avec documents téléchargeables)
- [x] Notifications in-app
- [x] Favoris
- [x] Opacité parcelles configurable
- [x] Import CSV
- [x] Footer avec contacts du site (email + téléphone)
- [x] Responsive complet : 768px, 480px, 360px, 280px (ultra-petit)
- [x] Scroll tactile modales : body bloqué à l'ouverture, scroll sur `.modal` au lieu de `.modal-content`
- [x] Sidebar mobile : scroll interne correctement isolé (`overflow: hidden` sur parent, `flex: 1` + `overflow-y: auto` sur contenu)
- [x] Contrôles carte (mesure/basemap) repositionnés dynamiquement sous les boutons d'outils via `getBoundingClientRect`
- [x] Restriction : propriétaire ne peut pas contacter un autre propriétaire

### Backend (API)

- [x] CRUD complet parcelles avec upload fichiers (multer + Supabase Storage)
- [x] Conversion coordonnées proj4 (UTM32/33/Douala → WGS84)
- [x] Calcul superficie automatique (géodésique ou shoelace)
- [x] Paiement par parcelle (pas d'abonnement global)
- [x] Administration : stats, CRUD parcelles, contacts, visites
- [x] Rate limiting (global + auth + register)
- [x] Détection chevauchements (PostGIS RPC)
- [x] Import CSV bulk
- [x] Visit tracking automatique

---

## 9. Problèmes résolus (historique)

| Problème | Cause | Solution |
|----------|-------|----------|
| "Les coordonnées sont obligatoires" | `syncTableToText()` cherchait les mauvais IDs d'inputs | Vérifier `coord1_`/`coord2_` ET `coordX_`/`coordY_` |
| 500 sur `/api/payment/initiate` | Variables env Flutterwave manquantes sur Vercel | Check explicite + message d'erreur clair |
| Parcelle non sauvée après paiement | `/verify` retournait `verified: false` en test mode | Activation systématique quand SDK confirme |
| Pas d'option Mobile Money | `country: 'CM'` manquant dans config Flutterwave | Ajouté |
| 500 sur `/api/favorites` | Supabase client null | Guard `if (!supabase) return` |
| "Type d'activité invalide" | `description_activite` NOT NULL | Défaut `''` (chaîne vide) |
| Parcelles "enregistrées" mais invisibles | `loadParcelles()` utilisait des données démo hardcodées | Réécrit pour fetch API |
| Géométrie non stockée | WKT non accepté par PostgREST | Passage au format GeoJSON |
| Labels coordonnées inversés | UI disait "Longitude, Latitude" mais backend attendait l'inverse | Labels corrigés |
| "Could not find 'superficie' column" | Colonne manquante + cache PostgREST | ALTER TABLE + NOTIFY pgrst + renommé en `superficie_calculee` |
| `onclose` Flutterwave après succès | `onclose` se déclenche aussi après paiement réussi | Flag `paymentSucceeded` |
| Vue bloque ALTER TABLE | `parcelles_avec_proprietaires` view | DROP VIEW → ALTER → recreate |
| Propriétaire peut contacter un autre proprio | Pas de vérification de rôle | Guard frontend + backend (403 si type_utilisateur=proprietaire) |
| UI déborde sur écrans < 320px | Pas de breakpoint ultra-petit | Ajout media query 280px + masquage légende + labels icônes-only |
| Scroll bloqué sur formulaires mobile | `modal-content` avec `max-height: 90vh` + `overflow-y: auto` empêche le scroll natif | Scroll sur `.modal`, body verrouillé, modal-content en `overflow: visible` |
| Boutons mesure/basemap cachés par le header | Position fixe `top` ne s'adapte pas | `adjustControlPositions()` calcule dynamiquement la position du layer control |

---

## 10. Points d'attention / dette technique

1. **Frontend monolithique** : `index.html` fait ~7000 lignes. Pas de framework, pas de build. Fonctionne mais difficile à maintenir.

2. **Pas de tests automatisés** : Jest configuré mais aucun test écrit.

3. **Schema cache PostgREST** : Après tout changement de schéma (ALTER TABLE, CREATE VIEW), exécuter `NOTIFY pgrst, 'reload schema'` dans Supabase SQL Editor.

4. **Webhook Flutterwave non fonctionnel** : Nécessite la secret key (commentée). Le flux fonctionne sans car l'activation se fait via le callback inline SDK. Pour une sécurité supplémentaire (production), configurer la secret key live et activer le webhook sur le dashboard Flutterwave.

5. **Colonne `superficie_calculee`** : Le code utilise `superficie_calculee` (pas `superficie`). Vérifier que la BD a bien ce nom de colonne.

6. **Variables Vercel** : Après chaque changement de clé Flutterwave ou ajout de variable, mettre à jour dans le dashboard Vercel → Settings → Environment Variables.

7. **Buckets Storage** : Créés automatiquement par le code si inexistants (`ensureBucketExists`). Configurés en `public: true`.

---

## 11. Pour reprendre le développement

### Lancer en local

```bash
npm install
npm run dev        # ou: node api/server.js
# Ouvrir http://localhost:3000
```

### Variables d'environnement requises (.env)

```
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000
SUPABASE_URL=https://boyyptqybnsiwnkdpfbl.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_KEY=<service role key>
JWT_SECRET=<secret>
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-de06efbef44902ddb3aa4a1680436c38-X
```

### Déployer sur Vercel

```bash
git add . && git commit -m "..." && git push
# Vercel déploie automatiquement depuis GitHub
```

### Ajouter une colonne en base

1. Exécuter le ALTER TABLE dans Supabase SQL Editor
2. Exécuter `NOTIFY pgrst, 'reload schema';`
3. Si une VIEW dépend de la table : DROP VIEW → ALTER → recreate VIEW

---

## 12. Prochaines évolutions possibles

- [ ] Tableau de bord propriétaire (mes parcelles, statut docs, historique paiements)
- [ ] Validation admin des documents (marquer comme vérifié)
- [ ] Notification email (via Supabase Edge Functions ou SendGrid)
- [ ] Export PDF certificat parcelle
- [ ] Mode hors-ligne (PWA)
- [ ] Tests E2E (Playwright)
- [ ] Refactoring frontend vers un framework (Vue.js ou React)
