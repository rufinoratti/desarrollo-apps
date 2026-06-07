const { createClient } = require('@supabase/supabase-js');

// ============================================================
// CONFIGURACIÓN DE CLIENTES SUPABASE
// ============================================================
// Se exponen DOS clientes:
//   - supabase        : anon key. Se usa para queries que respetan RLS
//                       (operaciones de usuario final).
//   - supabaseAdmin   : service_role key. Se usa SOLO desde el backend
//                       para operaciones privilegiadas (Storage uploads,
//                       bypass de RLS). NUNCA exponer al frontend.
//
// Ambos clientes se inicializan solo si SUPABASE_ENABLED=true y las
// credenciales correspondientes están presentes en el entorno.
// ============================================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseEnabled = process.env.SUPABASE_ENABLED === 'true';

// Cliente estándar (anon key) — opera bajo RLS del usuario
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey) && supabaseEnabled;
const supabase = isConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Cliente admin (service_role key) — bypass de RLS, solo para uso interno del backend
const isAdminConfigured = Boolean(supabaseUrl && supabaseServiceKey) && supabaseEnabled;
const supabaseAdmin = isAdminConfigured
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;

module.exports = {
    supabase,
    supabaseAdmin,
    isConfigured,
    isAdminConfigured
};
