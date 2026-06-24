# Cahier des Charges - Application GeoFoncier

**Version :** 4.0  
**Date de mise a jour :** 23 juin 2026  
**Statut :** En cours de developpement  
**Type d'application :** Application web de gestion fonciere geospatiale

---

## 1. Presentation Generale

### 1.1 Contexte

GeoFoncier est une application web de gestion des parcelles foncieres destinee au marche camerounais. Elle permet la visualisation cartographique, l'enregistrement, la recherche et la mise en relation entre acheteurs et vendeurs de terrains, avec un systeme de paiement integre.

### 1.2 Objectifs

- Offrir une plateforme centralisee de gestion et visualisation des parcelles foncieres
- Permettre l'enregistrement de terrains titres et non titres avec leurs documents justificatifs
- Faciliter la mise en relation entre clients (acheteurs/locataires) et proprietaires
- Detecter automatiquement les chevauchements de parcelles
- Supporter plusieurs systemes de coordonnees (WGS84, UTM32, UTM33, Douala 1948)
- Fournir des outils de mesure et d'analyse spatiale
- Offrir une interface responsive optimisee mobile

### 1.3 Public Cible

| Type d'utilisateur | Role |
|---|---|
| Client | Recherche de terrains, demande de contact avec proprietaires |
| Proprietaire | Enregistrement de parcelles, gestion de ses terrains |
| Administrateur | Validation des documents, approbation des contacts, gestion du systeme |

---

## 2. Architecture Technique

### 2.1 Stack Technologique

| Composant | Technologie |
|---|---|
| Frontend | HTML5, CSS3, JavaScript vanilla (SPA monofichier) |
| Cartographie | Leaflet.js 1.9.4 |
| Backend | Node.js + Express.js 4.18 |
| Base de donnees | Supabase (PostgreSQL + PostGIS) |
| Authentification | Supabase Auth + JWT (7 jours d'expiration) |
| Paiement | Flutterwave |
| Upload fichiers | Multer (max 10 MB) |
| Import CSV | csv-parser |
| Icones | Font Awesome 6.4 |

### 2.2 Structure du Projet

```
geofoncier/
|-- index.html              # Application frontend SPA
|-- package.json            # Configuration Node.js
|-- api/
|   |-- server.js           # Serveur Express principal
|   |-- supabase-config.js  # Configuration Supabase
|   |-- middleware/
|   |   |-- auth.js         # Middleware d'authentification
|   |-- routes/
|   |   |-- auth.js         # Routes authentification
|   |   |-- parcelles.js    # Routes parcelles
|   |   |-- spatial.js      # Routes spatiales/geographiques
|   |   |-- payment.js      # Routes paiement
|   |   |-- contact.js      # Routes contact acheteur-vendeur
|   |   |-- csv.js          # Routes import CSV
|   |   |-- admin.js        # Routes administration
|   |-- services/
|       |-- AuthService.js
|       |-- ParcelleService.js
|       |-- SpatialService.js
|       |-- FlutterwaveService.js
|       |-- ContactService.js
|       |-- CSVImportService.js
|       |-- CoordinateTransformService.js
|-- uploads/                # Fichiers uploades
|-- public/
    |-- images/
    |-- samples/
```

### 2.3 Variables d'Environnement Requises

| Variable | Description |
|---|---|
| `SUPABASE_URL` | URL du projet Supabase |
| `SUPABASE_ANON_KEY` | Cle publique anonyme |
| `SUPABASE_SERVICE_ROLE_KEY` | Cle de service (operations admin) |
| `JWT_SECRET` | Secret pour signature JWT |
| `FLUTTERWAVE_PUBLIC_KEY` | Cle publique Flutterwave |
| `FLUTTERWAVE_SECRET_KEY` | Cle secrete Flutterwave |
| `APP_URL` | URL de l'application (callbacks) |
| `ADMIN_EMAIL` | Email administrateur (notifications) |
| `NODE_ENV` | Environnement (development/production) |
| `PORT` | Port du serveur (defaut: 3000) |

---

## 3. Modules Fonctionnels

### 3.1 Module Authentification

#### Inscription (POST /api/auth/register)

**Champs requis :**
- Type d'utilisateur (client / proprietaire)
- Nom complet
- Email
- Telephone (format +237 6XX XXX XXX)
- Type de piece d'identite (CNI, Passeport, Titre de sejour)
- Numero de piece d'identite
- Localisation (Cameroun, Afrique, Hors Afrique)
- Mot de passe (minimum 6 caracteres)
- Confirmation du mot de passe
- Acceptation des conditions d'utilisation

**Comportement :**
- Validation du format email
- Verification de la longueur du mot de passe
- Creation d'un compte Supabase Auth avec confirmation automatique
- Creation d'un profil dans la table `public.users`
- Mecanisme de rollback en cas d'echec

#### Connexion (POST /api/auth/login)

- Authentification par email/mot de passe
- Generation d'un token JWT (expiration 7 jours)
- Retour de la session Supabase + donnees utilisateur
- Gestion des erreurs : identifiants invalides, email non confirme, rate limiting

#### Verification de token (GET /api/auth/verify)

- Header `Authorization: Bearer <token>`
- Verification JWT ou fallback Supabase
- Retour des donnees utilisateur actualisees

#### Deconnexion (POST /api/auth/logout)

- Invalidation de la session Supabase

---

### 3.2 Module Parcelles

#### Creation de parcelle (POST /api/parcelles)

**Champs du formulaire :**

| Champ | Type | Requis | Description |
|---|---|---|---|
| statut_terrain | select | Oui | titre / non_titre |
| matricule | text | Oui | Auto-genere pour non-titres |
| type_acte | select | Conditionnel | Pour terrains titres uniquement |
| date_delivrance | date | Conditionnel | Pour terrains titres uniquement |
| date_mise_en_valeur | date | Oui | Date de mise en valeur |
| quartier_village | text | Oui | Localisation (ex: Bonanjo, Akwa) |
| systeme_coordonnees | select | Oui | WGS84, UTM32, UTM33, Douala 1948 |
| coordonnees | textarea/table | Oui | Minimum 3 points (polygone) |
| activite | select | Oui | Voir enum ci-dessous |
| description_activite | textarea | Oui | Description detaillee |
| nom_proprietaire | text | Oui | Nom du proprietaire |
| telephone_proprietaire | tel | Oui | Format +237 |
| prix_m2 | number | Non | Prix en XAF (si a vendre/louer) |
| document_identite | file | Oui | CNI/Passeport (PDF, PNG, JPG) |
| justificatif_acte | file | Conditionnel | Obligatoire pour terrains titres |
| photos_terrain | file[] | Non | Maximum 3 photos |

**Types d'activite (enum activite_type dans Supabase) :**
- `propriete_privee` - Propriete privee
- `vente_terrain` - Vente de terrain
- `location_construction` - Location pour construction
- `location_agriculture` - Location pour agriculture
- `autres` - Autres activites

**Types d'acte foncier :**
- `titre_foncier` - Titre foncier
- `attestation_propriete` - Attestation de propriete
- `certificat_propriete` - Certificat de propriete
- `acte_vente` - Acte de vente
- `autre` - Autre

**Modes de saisie des coordonnees :**
1. Mode Texte : une paire par ligne (ex: `4.0511,9.7679`)
2. Mode Tableau : saisie point par point dans un formulaire tabulaire
3. Coller depuis le presse-papier

**Transformation automatique des coordonnees :**
- Detection automatique du systeme de coordonnees
- Conversion vers WGS84 (EPSG:4326) pour stockage
- Validation des bornes Cameroun (1-13 latitude, 8-17 longitude)
- Stockage en format PostGIS POLYGON

#### Consultation des parcelles (GET /api/parcelles)

**Filtres disponibles :**
- Arrondissement
- Quartier/Village (recherche textuelle)
- Type d'activite
- Statut du terrain (titre / non titre)
- Prix minimum / maximum

#### Recherche (GET /api/parcelles/search)

- Recherche par matricule (insensible a la casse)

#### Modification (PUT /api/parcelles/:id)

- Mise a jour des donnees de la parcelle

#### Suppression (DELETE /api/parcelles/:id)

- Suppression logique (soft delete : `is_active = false`)

#### Detection des chevauchements

- Algorithme Sutherland-Hodgman pour l'intersection de polygones
- Verification entre parcelles de proprietaires differents
- Affichage visuel des zones de chevauchement (animation pulsation)
- Marqueurs d'avertissement sur la carte
- Detection via RPC PostGIS cote serveur

---

### 3.3 Module Cartographique (Frontend)

#### Carte Interactive

- **Bibliotheque :** Leaflet.js 1.9.4
- **Centre par defaut :** Douala, Cameroun [4.0515, 9.7682]
- **Zoom par defaut :** 15 (desktop), 14 (mobile)
- **Fonds de carte :**
  - OpenStreetMap (defaut)
  - Satellite (Google Maps)
  - Topographique (OpenTopoMap)

#### Couches Cartographiques (toggle on/off)

| Couche | Z-Index | Description |
|---|---|---|
| Arrondissements | 200 | Contours administratifs |
| Parcelles | 400 | Polygones des terrains |
| Chevauchements | 500 | Zones de conflit |
| Mesures & GPS | 700 | Outils de mesure et position GPS (toujours au-dessus) |

#### Code Couleur

| Element | Couleur | Signification |
|---|---|---|
| #663399 | Violet fonce | Terrain titre (propriete privee) |
| #9b59b6 | Violet clair | Terrain titre (a vendre/louer) |
| #e67e22 | Orange | Terrain non titre |
| #dc3545 | Rouge | Chevauchement detecte |
| #2c3e50 | Gris fonce | Contours arrondissements |

#### Outils de Mesure

- Mesure de distance (regle)
- Mesure de superficie (polygone)
- Effacement des mesures
- **Priorite d'affichage :** les mesures s'affichent au-dessus de TOUTES les couches (z-index 700, pane dedie `measurementPane`) pour rester visibles quel que soit l'etat des couches

#### Geolocalisation GPS

- Bouton de localisation dans les controles de la carte
- Activation/desactivation par toggle
- Affichage de la position en temps reel (watchPosition)
- Marqueur personnalise avec cercle de precision
- Centrage automatique de la carte au premier fix
- Popup affichant les coordonnees et la precision
- Gestion des erreurs (permission refusee, GPS inactif, timeout)

#### Fonctionnalites de la Sidebar

**Desktop :** Panneau lateral 350px, retractable  
**Mobile :** Panneau glissant (85% largeur, max 320px), overlay sombre

**Contenu :**
- Barre de recherche par matricule
- Controle des couches cartographiques
- Filtres (arrondissement, quartier, activite, statut)
- Resultats de recherche

#### Legende

- Retractable
- Positionnement adaptatif (responsive)
- Affichage de tous les types de parcelles et chevauchements

---

### 3.4 Module Spatial / Geographique

#### Hierarchie Administrative

```
Region -> Departement -> Arrondissement
```

#### Endpoints Principaux

**Gestion des regions :**
- GET /api/spatial/regions - Liste des regions
- GET /api/spatial/regions/:id - Details d'une region
- POST /api/spatial/regions - Creer une region (Admin)
- PUT /api/spatial/regions/:id - Modifier une region (Admin)
- DELETE /api/spatial/regions/:id - Supprimer une region (Admin)

**Navigation geographique :**
- GET /api/spatial/departements - Departements (filtre optionnel par region)
- GET /api/spatial/arrondissements - Arrondissements (filtres region/departement)
- GET /api/spatial/divisions - Toutes les divisions administratives

**Recherche spatiale :**
- POST /api/spatial/search/location - Recherche par coordonnees (retourne la hierarchie)
- POST /api/spatial/search/nearest-region - Region la plus proche d'un point
- POST /api/spatial/search/bounds - Parcelles dans un rectangle geographique
- POST /api/spatial/search/regions-near-point - Regions dans un rayon

**Analyse avancee :**
- GET /api/spatial/border-parcelles - Parcelles pres des frontieres (parametre distance)
- GET /api/spatial/multi-region-parcelles - Parcelles multi-regions
- GET /api/spatial/geographic-centers - Centres geographiques
- GET /api/spatial/distances-between-regions - Distances inter-regions
- GET /api/spatial/stats/regions - Statistiques regionales

**Export/Import :**
- GET /api/spatial/export/regions/geojson - Export GeoJSON
- POST /api/spatial/import/regions/geojson - Import GeoJSON (Admin)

**Transformation de coordonnees :**
- POST /api/spatial/transform - Transformation entre systemes
  - Systemes supportes : WGS84 (4326), UTM32 (32632), UTM33 (32633), Douala 1948
  - Utilisation d'un script Python pour les transformations precises
  - Fallback JavaScript en cas d'echec

**Maintenance :**
- POST /api/spatial/refresh-cache - Rafraichir les vues materialisees (Admin)
- POST /api/spatial/optimize-geometries - Optimiser les geometries (Admin)
- GET /api/spatial/cleanup-report - Rapport de nettoyage des donnees orphelines
- GET /api/spatial/validate-data - Validation de l'integrite geographique
- GET /api/spatial/geographic-report - Rapport geographique complet

---

### 3.5 Module Paiement (Flutterwave)

#### Initiation de paiement (POST /api/payment/initiate)

**Parametres requis :**
- user_id
- amount (montant en XAF)
- customer : { email, phone, name }

**Methodes de paiement supportees :**
- Carte bancaire
- Mobile Money
- USSD

#### Grille Tarifaire

**Abonnements Client :**

| Localisation | Mensuel | Annuel |
|---|---|---|
| Afrique | 5 000 XAF | 50 000 XAF |
| Hors Afrique | 50 000 XAF | 500 000 XAF |

**Abonnements Proprietaire :**
- Base : 500 XAF par tranche de 500 m2
- Reduction annuelle : 10%

#### Commissions sur Transactions

| Acteur | Commission |
|---|---|
| Client (acheteur) | 3% |
| Proprietaire (vendeur) | 2% |

#### Webhook (POST /api/payment/webhook)

- Verification de la signature HMAC-SHA256
- Mise a jour du statut d'abonnement (pending -> active)
- Stockage dans la table `subscriptions`

#### Verification (GET /api/payment/verify/:transactionId)

- Appel API Flutterwave pour confirmer la transaction

---

### 3.6 Module Contact Acheteur-Vendeur

#### Processus de Mise en Relation

1. **Initiation** (POST /api/contact/initiate)
   - Le client fait une demande de contact pour une parcelle
   - Validation de l'existence de la parcelle
   - Notification envoyee a l'administrateur

2. **Approbation** (POST /api/contact/approve) - Admin uniquement
   - L'admin valide la demande
   - Les coordonnees du vendeur sont envoyees au client
   - Information sur les commissions incluse

3. **Historique** (GET /api/contact/history/:userId)
   - Consultation de l'historique des contacts

#### Notifications

- Email automatique a l'administrateur lors d'une nouvelle demande
- Email au client avec les coordonnees du vendeur apres approbation
- Envoi via Supabase Edge Functions

---

### 3.7 Module Import CSV

#### Import de parcelles (POST /api/csv/import)

**Configuration :**
- Taille maximale : 2 MB
- Delimiteurs detectes automatiquement : virgule, point-virgule, tabulation

**Colonnes du CSV :**

| Colonne | Requis | Variations acceptees |
|---|---|---|
| matricule | Oui | - |
| longitude | Oui | lng, lon, x, east, easting |
| latitude | Oui | lat, y, north, northing |
| quartier_village | Non | quartier, village |
| activite | Non | - |
| description_activite | Non | description |
| prix_m2 | Non | prix, prix_metre_carre |
| is_terrain_titre | Non | - |
| nom_proprietaire | Non | nom, proprietaire |
| telephone_proprietaire | Non | tel |
| coordinate_system | Non | - |

**Comportement :**
- Detection automatique du systeme de coordonnees
- Transformation vers WGS84 si necessaire
- Creation de polygones a partir de points (carre de ~10m)
- Rapport d'import : nombre importe, erreurs, details

#### Telechargement de modele (GET /api/csv/sample)

- Fichier CSV modele avec les colonnes requises

---

### 3.8 Module Administration

#### Tableau de Bord (GET /api/admin/stats)

Statistiques systeme :
- Nombre d'utilisateurs (par type)
- Nombre de parcelles (par statut)
- Nombre de contacts
- Donnees geographiques

#### Gestion des Contacts (GET /api/admin/contacts)

- Liste de tous les contacts avec donnees utilisateur/parcelle

#### Gestion des Transactions (GET /api/admin/transactions)

- Liste de toutes les transactions de paiement

#### Gestion des Utilisateurs (GET /api/admin/users)

- Filtres : type d'utilisateur, region, statut de verification

#### Analyse Regionale

- GET /api/admin/regions - Liste des regions
- GET /api/admin/regions/:id/details - Statistiques detaillees
- POST /api/admin/compare-regions - Comparaison de regions
- GET /api/admin/border-parcelles - Parcelles frontaleres
- GET /api/admin/multi-region-parcelles - Parcelles multi-regions

#### Export de Donnees

- GET /api/admin/export/regions - Export GeoJSON des regions
- GET /api/admin/export/full-report - Rapport complet (geographie, stats, validation)

#### Maintenance

- POST /api/admin/refresh-cache - Rafraichir les vues materialisees
- POST /api/admin/optimize-geometries - Optimiser les geometries
- GET /api/admin/cleanup-report - Nettoyage des donnees orphelines
- GET /api/admin/validate-data - Validation des donnees
- GET /api/admin/geographic-report - Rapport geographique

---

## 4. Interface Utilisateur

### 4.1 Design Responsive

L'application adopte une approche mobile-first avec 4 points de rupture :

| Ecran | Largeur | Adaptations |
|---|---|---|
| Desktop | > 768px | Sidebar permanente, carte plein ecran |
| Tablette | <= 768px | Sidebar mobile glissante, controles adaptes |
| Mobile | <= 480px | Interface compacte, popups reduites |
| Tres petit | <= 360px | Ultra-compact, texte tronque |
| Paysage | hauteur < 500px | Layout horizontal optimise |

### 4.2 Composants UI

- **Header** : fixe, gradient bleu fonce (#2c3e50 -> #34495e), logo + boutons auth
- **Sidebar** : recherche, couches, filtres, resultats
- **Carte** : occupe tout l'espace restant
- **Legende** : positionnee en bas a gauche, retractable
- **Controles carte** : en haut a droite (mesure, ajout parcelle, import CSV)
- **Modales** : connexion, inscription, details parcelle, ajout parcelle
- **Notifications** : toast en haut a droite, 3 types (success, error, info)

### 4.3 Optimisations Mobile

- Scroll tactile ameliore (-webkit-overflow-scrolling: touch)
- Controles de navigation par fleches pour la sidebar mobile
- Indicateur de position de scroll
- Feedback tactile (vibration, animations)
- Zones tactiles agrandies (min 32-40px)
- Popups adaptes a la taille d'ecran
- Zoom control repositionne en bas a droite

---

## 5. Base de Donnees

### 5.1 Schema Principal (Supabase/PostgreSQL)

**Extension requise :** PostGIS

**Tables principales :**

| Table | Description |
|---|---|
| users | Profils utilisateurs |
| parcelles | Donnees des parcelles (geometrie PostGIS) |
| parcelle_documents | Documents associes aux parcelles |
| parcelle_images | Photos des terrains |
| subscriptions | Abonnements et paiements |
| contacts | Demandes de contact acheteur-vendeur |
| regions | Regions administratives |
| departements | Departements |
| arrondissements | Arrondissements (avec geometrie) |

### 5.2 Types Enum

- `activite_type` : propriete_privee, vente_terrain, location_construction, location_agriculture, autres
- `type_utilisateur` : client, proprietaire

### 5.3 Fonctionnalites PostGIS

- Stockage de polygones (SRID 4326)
- Detection de chevauchements (ST_Intersects)
- Calcul de superficie (ST_Area)
- Recherche par emplacement (ST_Contains, ST_Within)
- Vues materialisees pour le cache

---

## 6. Securite

### 6.1 Authentification

- Double couche : Supabase Auth + JWT
- Token Bearer dans les headers HTTP
- Expiration JWT : 7 jours
- Middleware de verification sur les routes protegees

### 6.2 Autorisation

- Routes protegees par le middleware `authenticateUser`
- Distinction des roles (client, proprietaire, admin)
- Routes admin separees

### 6.3 Protection des Donnees

- CORS configure (origines autorisees)
- Validation des entrees utilisateur
- Limitation de la taille des fichiers (10 MB)
- Gestion des erreurs sans exposition des details internes en production
- Soft delete pour eviter la perte de donnees

### 6.4 Paiement

- Verification de signature webhook (HMAC-SHA256)
- Verification des transactions via API Flutterwave
- Reference de transaction unique (tx_ref)

---

## 7. Deploiement

### 7.1 Plateformes Supportees

- **Heroku** : configuration via heroku config:set
- **Railway** : deploiement via CLI railway

### 7.2 Prerequis

- Node.js >= 16.0.0
- Projet Supabase avec PostGIS active
- Compte Flutterwave avec cles API
- Fichier .env configure

### 7.3 Scripts NPM

| Commande | Description |
|---|---|
| `npm start` | Demarrer le serveur (production) |
| `npm run dev` | Demarrer avec nodemon (developpement) |
| `npm run setup-db` | Configurer la base de donnees |
| `npm run import-geo` | Importer les donnees geographiques |
| `npm test` | Executer les tests (Jest) |

---

## 8. API - Resume des Endpoints

### Authentification
| Methode | Endpoint | Description |
|---|---|---|
| GET | /api/auth/health | Health check auth |
| POST | /api/auth/register | Inscription |
| POST | /api/auth/login | Connexion |
| GET | /api/auth/verify | Verification token |
| POST | /api/auth/logout | Deconnexion |

### Parcelles
| Methode | Endpoint | Description |
|---|---|---|
| GET | /api/parcelles | Liste avec filtres |
| POST | /api/parcelles | Creer (authentifie) |
| GET | /api/parcelles/:id | Details parcelle |
| PUT | /api/parcelles/:id | Modifier |
| DELETE | /api/parcelles/:id | Supprimer (soft) |
| GET | /api/parcelles/search | Recherche par matricule |

### Spatial
| Methode | Endpoint | Description |
|---|---|---|
| GET | /api/spatial/regions | Liste regions |
| GET | /api/spatial/departements | Liste departements |
| GET | /api/spatial/arrondissements | Liste arrondissements |
| POST | /api/spatial/search/location | Recherche par coordonnees |
| POST | /api/spatial/search/bounds | Recherche dans un rectangle |
| POST | /api/spatial/transform | Transformation coordonnees |
| GET | /api/spatial/export/regions/geojson | Export GeoJSON |

### Paiement
| Methode | Endpoint | Description |
|---|---|---|
| POST | /api/payment/initiate | Initier paiement |
| POST | /api/payment/webhook | Callback Flutterwave |
| GET | /api/payment/verify/:id | Verifier transaction |
| GET | /api/payment/pricing | Grille tarifaire |
| POST | /api/payment/calculate-proprietaire | Calcul prix proprietaire |

### Contact
| Methode | Endpoint | Description |
|---|---|---|
| POST | /api/contact/initiate | Demande de contact |
| POST | /api/contact/approve | Approbation (Admin) |
| GET | /api/contact/history/:userId | Historique contacts |

### CSV
| Methode | Endpoint | Description |
|---|---|---|
| POST | /api/csv/import | Import CSV |
| GET | /api/csv/sample | Telecharger modele |

### Administration
| Methode | Endpoint | Description |
|---|---|---|
| GET | /api/admin/stats | Statistiques systeme |
| GET | /api/admin/contacts | Liste contacts |
| GET | /api/admin/transactions | Liste transactions |
| GET | /api/admin/users | Liste utilisateurs |
| GET | /api/admin/regions | Regions (cache) |
| POST | /api/admin/compare-regions | Comparaison regions |
| GET | /api/admin/export/full-report | Rapport complet |

### Systeme
| Methode | Endpoint | Description |
|---|---|---|
| GET | /api/health | Health check serveur |

---

## 9. Etat Actuel et Points d'Attention

### 9.1 Fonctionnalites Implementees

- [x] Authentification complete (inscription, connexion, verification)
- [x] Interface cartographique avec Leaflet (multi-couches)
- [x] Affichage des arrondissements depuis l'API
- [x] Formulaire d'ajout de parcelle complet
- [x] Support multi-systemes de coordonnees
- [x] Detection des chevauchements (frontend)
- [x] Interface responsive (mobile/tablette/desktop)
- [x] Outils de mesure (distance, surface) - au-dessus de toutes les couches
- [x] Geolocalisation GPS (position de l'utilisateur en temps reel)
- [x] API spatiale complete (CRUD regions, recherche, analyse)
- [x] Integration Flutterwave (paiement)
- [x] Systeme de contact acheteur-vendeur
- [x] Import CSV avec detection automatique
- [x] Panel d'administration
- [x] Export GeoJSON
- [x] Transformation de coordonnees (UTM, Douala 1948)

### 9.2 Points d'Attention Connus

- L'enum `activite_type` dans Supabase doit contenir exactement : `propriete_privee`, `vente_terrain`, `location_construction`, `location_agriculture`, `autres`
- La transformation de coordonnees utilise un script Python en priorite (necessite pyproj) avec fallback JavaScript
- Les donnees de parcelles du frontend sont actuellement des donnees de demonstration (sampleParcelles)
- Le fichier `parcelles.js` dans routes contient le service et non un router Express standard

### 9.3 Evolutions Futures Envisagees

- Interface admin dediee (admin.html)
- Notifications en temps reel (WebSocket)
- Application mobile native
- Integration avec le cadastre officiel
- Historique des modifications de parcelles
- Systeme de verification documentaire automatise
- API publique pour integrateurs tiers

---

## 10. Annexes

### 10.1 Systemes de Coordonnees Supportes

| Systeme | SRID | Zone | Usage |
|---|---|---|---|
| WGS84 | 4326 | Global | GPS standard, stockage |
| UTM Zone 32N | 32632 | Ouest Cameroun | Geometres locaux |
| UTM Zone 33N | 32633 | Est Cameroun | Geometres locaux |
| Douala 1948 | Custom | Cameroun | Systeme local ancien |

### 10.2 Limites Techniques

| Parametre | Valeur |
|---|---|
| Taille max fichier upload | 10 MB |
| Taille max CSV | 2 MB |
| Photos terrain max | 3 |
| Formats acceptes (docs) | PDF, PNG, JPG, JPEG |
| Points minimum polygone | 3 |
| Expiration JWT | 7 jours |
| Port par defaut | 3000 |
| Node.js minimum | 16.0.0 |


eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJveXlwdHF5Ym5zaXdua2RwZmJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODEyNzQ1MiwiZXhwIjoyMDYzNzAzNDUyfQ.LhUbu9JnZJpN2kN5HOKZth_Y-ZYMmZBuP1kkNm7x3oE