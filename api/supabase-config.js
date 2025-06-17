// api/supabase-config.js
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Variables d\'environnement Supabase manquantes')
}

// Client avec service role pour les opérations backend
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

// Client anonyme pour certaines opérations publiques
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

module.exports = { 
    supabase, 
    supabaseAnon,
    supabaseUrl,
    supabaseServiceKey 
}