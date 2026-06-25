// api/supabase-config.js - VERSION COMPATIBLE VERCEL
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

let supabase = null
let supabaseAnon = null

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' }
    })
}

if (supabaseUrl && supabaseAnonKey) {
    supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: false },
        db: { schema: 'public' }
    })
}

module.exports = {
    supabase,
    supabaseAnon,
    config: {
        url: supabaseUrl || null,
        hasServiceKey: !!supabaseServiceKey,
        hasAnonKey: !!supabaseAnonKey
    }
}
