# Résumé des travaux - GéoFoncier

## Projet
- **Application** : GéoFoncier - Gestion des Parcelles Foncières
- **Stack** : Node.js/Express + Leaflet.js + Supabase (PostgreSQL/PostGIS)
- **Déploiement** : Vercel (www.geofoncier.shop)
- **Repo GitHub** : https://github.com/thibaudet7/geofoncier3
- **Supabase Project ID** : `boyyptqybnsiwnkdpfbl`

---

## 1. Amélioration GPS mobile (index.html)

### Problème
Le bouton de positionnement GPS était trop petit et pouvait être masqué par la barre d'état sur les téléphones.

### Corrections apportées
- **Viewport** : ajout de `viewport-fit=cover` pour supporter les encoches iOS
- **Safe areas** : utilisation de `env(safe-area-inset-top/left)` sur toutes les tailles d'écran
- **Taille du bouton** : portée à 44x44px (recommandation Apple/Google pour cibles tactiles)
- **Précision GPS** : timeout augmenté de 15s à 30s, `maximumAge: 2000` pour éviter les requêtes inutiles
- **Zoom adaptatif** : zoom 18 si précision ≤10m, 17 si ≤50m, 16 sinon
- **Altitude** : affichage dans le popup quand disponible
- **Mode paysage** : support du bouton GPS ajouté
- **Marqueur** : taille et ombre augmentées pour meilleure visibilité

---

## 2. Fix connexion admin (401 - Unauthorized)

### Problème
Impossible de se connecter avec `geospatial.estate@gmail.com` - erreur 401.

### Causes identifiées (2 problèmes)

#### A) Compte admin inexistant
Le compte `geospatial.estate@gmail.com` n'existait ni dans `auth.users` ni dans `public.users` de Supabase.

**Solution** : Création du compte via l'API admin Supabase.

#### B) normalizeEmail() supprimait les points Gmail
`express-validator`'s `normalizeEmail()` transformait `geospatial.estate@gmail.com` en `geospatialestate@gmail.com` avant envoi à Supabase Auth.

**Solution** : `normalizeEmail({ gmail_remove_dots: false })` dans `api/routes/auth.js` (lignes 31 et 112).

---

## 3. Correction utilisateur manquant

### Problème
`villagemarte@gmail.com` existait dans Supabase Auth mais pas dans la table `public.users`.

### Solution
Insertion manuelle dans `public.users` avec le rôle `client`.

---

## Comptes utilisateurs

| Email | Rôle | Mot de passe |
|-------|------|-------------|
| `geospatial.estate@gmail.com` | admin | `Admin2025!` |
| `ekanimeb@yahoo.fr` | proprietaire | (défini à l'inscription) |
| `villagemarte@gmail.com` | client | (défini à l'inscription) |

---

## Fichiers modifiés

| Fichier | Modifications |
|---------|--------------|
| `index.html` | GPS mobile : safe-area, taille bouton, précision, altitude |
| `api/routes/auth.js` | Fix `normalizeEmail({ gmail_remove_dots: false })` |

---

## Commits poussés

1. `6e27304` - améliore GPS mobile: bouton visible au-dessus de la barre d'état, précision accrue
2. `dddafc3` - fix: empêcher normalizeEmail de supprimer les points des adresses Gmail

---

## 4. Connexion email/téléphone + mot de passe oublié

### Ajouts
- Le champ de connexion accepte un email OU un numéro de téléphone
- Si téléphone détecté, résolution vers l'email via table `public.users`
- Bouton "Mot de passe oublié" avec envoi de lien via Supabase Auth
- Page/route `reset-password` pour réinitialiser le mot de passe

---

## 5. Tableau de coordonnées pour l'ajout de parcelle

### Modification
- Remplacement de l'input texte par un tableau avec colonnes X et Y
- Interface avec boutons "Tableau / Texte libre / Coller"
- Mode tableau est le mode par défaut

---

## 6. Actes fonciers multiples avec fichier intégré

### Ajout
- Pour les terrains titrés, possibilité d'ajouter plusieurs actes fonciers
- Chaque acte est une carte avec : type d'acte (sélection), date, référence, fichier joint
- Upload via FormData avec fichiers multiples

---

## 7. Système de rôles, notifications et tableau de bord admin (2026-07-04)

### Architecture des rôles
- **Visiteur** : peut voir la carte et les parcelles (sans détails de contact)
- **Client** : peut s'inscrire, demander un contact (via l'admin), gérer ses favoris
- **Propriétaire** : peut enregistrer des parcelles, reçoit des notifications
- **Admin** : gère les demandes, voit toutes les infos, édite les parcelles, transfère la propriété

### Sécurité du flux de contact (CHANGEMENT CRITIQUE)
- **Avant** : `contactOwner()` affichait directement le téléphone du propriétaire
- **Après** : le client envoie une demande → l'admin reçoit une notification → l'admin facilite la mise en relation
- Les coordonnées du propriétaire ne sont JAMAIS envoyées au client
- Commission : 3% client, 2% propriétaire

### Système de notifications in-app
- Table `notifications` (type, title, message, is_read)
- Icône cloche dans le header avec badge compteur (rouge)
- Panel déroulant avec liste des notifications
- Polling toutes les 30 secondes
- Types : contact_request, contact_approved, contact_rejected, parcelle_edited, ownership_transfer

### Favoris client
- Table `favorites` (user_id + parcelle_id, UNIQUE)
- Bouton coeur dans les détails parcelle
- Section "Mes Favoris" dans le dashboard client

### Tableau de bord client ("Mon Espace")
- Onglet Favoris : liste des parcelles favorites
- Onglet Demandes : historique des demandes de contact avec statut

### Tableau de bord administrateur
- Statistiques : visites/semaine, parcelles, demandes, utilisateurs
- Onglet Demandes : liste complète avec infos client + propriétaire + actions (approuver/rejeter)
- Onglet Parcelles : liste éditable (prix au m²)
- Onglet Transactions : historique + formulaire de transfert de propriété

### Tracking des visites
- Table `site_visits` (ip, user_agent, path, date)
- Middleware fire-and-forget sur requêtes GET /
- Frontend : `fetch('/api/visits/track')` au chargement
- Stats agrégées par semaine pour l'admin

### Middleware d'autorisation
- `authenticateUser` : vérifie le token Supabase (inchangé mais simplifié)
- `requireAdmin` : vérifie `type_utilisateur === 'admin'` dans `public.users`
- `requireRole(...roles)` : générique pour futurs besoins
- Toutes les routes admin protégées (auparavant ouvertes)

### Fichiers créés
| Fichier | Description |
|---------|-------------|
| `api/services/NotificationService.js` | Service CRUD notifications + notifyAdmin |
| `api/routes/notifications.js` | GET/PUT notifications avec auth |
| `api/routes/favorites.js` | GET/POST/DELETE favoris avec auth |
| `api/migrations/001_roles_notifications.sql` | SQL pour nouvelles tables |

### Fichiers modifiés
| Fichier | Modification |
|---------|-------------|
| `api/middleware/auth.js` | Ajout `requireAdmin`, `requireRole` |
| `api/services/ContactService.js` | Sécurisation flux (plus d'infos propriétaire au client), doublon check, notifications |
| `api/routes/contact.js` | Auth middleware, route reject, filtrage infos |
| `api/routes/admin.js` | Auth obligatoire, edit parcelle, transfer ownership, visits weekly |
| `api/server.js` | Mount notifications + favorites, visit tracking middleware |
| `index.html` | CSS notifications/dashboard + modales + fonctions JS (~300 lignes) |

### SQL à exécuter dans Supabase
```sql
-- Exécuter le fichier api/migrations/001_roles_notifications.sql dans le SQL Editor Supabase
```

---

## 8. Limite fichiers, opacité parcelles, recherche par liste (2026-07-04)

### Limite de taille des fichiers (2 Mo)
- Validation côté frontend avant upload : CNI, actes fonciers, photos
- Message d'erreur explicite indiquant le fichier fautif et sa taille
- Indication "max 2 Mo" dans les labels des champs fichier

### Slider d'opacité des parcelles
- Curseur dans la section "Couches cartographiques" (desktop + mobile)
- Valeur de 0% (contours seuls, transparent) à 100% (remplissage opaque)
- Synchronisation entre les sliders desktop et mobile
- Modifie le `fillOpacity` de chaque polygone en temps réel

### Recherche par liste de matricules (autocomplete)
- Remplacement de la simple barre de recherche par un champ avec dropdown
- Au focus : affiche la liste complète des parcelles enregistrées
- En saisie : filtre en temps réel par matricule
- Clic sur un item : zoom sur la parcelle et affiche ses détails
- Fonctionne sur desktop et mobile

### Amélioration scroll sidebar mobile
- Suppression du `min-height: calc(100vh - 120px)` rigide sur `.sidebar-content-wrapper`
- Remplacé par `min-height: min-content` + `padding-bottom: 80px`
- Meilleur comportement de scroll sur petits écrans sans espace vide inutile

---

## Notes techniques

- Le `.env` local contient les clés Supabase (non committé, normal)
- Les variables d'environnement sont aussi configurées sur Vercel (dashboard)
- Le déploiement Vercel prend ~30 secondes après un push
- La connexion passe par : Frontend → `/api/auth/login` → `supabaseAnon.auth.signInWithPassword()` → récupération dans `public.users` → génération JWT
- Le `JWT_SECRET` en production est défini dans les env vars Vercel
