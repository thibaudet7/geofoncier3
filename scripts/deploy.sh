#!/bin/bash

echo "🚀 Déploiement GéoFoncier sur Vercel"

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    echo "❌ Erreur: package.json non trouvé. Exécutez ce script depuis la racine du projet."
    exit 1
fi

# Vérifier que vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "📦 Installation de Vercel CLI..."
    npm install -g vercel
fi

# Vérifier que le fichier .env existe
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env non trouvé. Copiez .env.example vers .env et configurez vos variables."
    cp .env.example .env
    echo "✅ Fichier .env créé. Veuillez le configurer avant de continuer."
    exit 1
fi

# Installer les dépendances si nécessaire
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Déployer sur Vercel
echo "🚀 Déploiement en cours..."
vercel --prod

echo "✅ Déploiement terminé!"
echo "🌐 Votre application sera disponible à l'URL fournie par Vercel"
echo "🔧 N'oubliez pas de configurer les variables d'environnement dans le dashboard Vercel"