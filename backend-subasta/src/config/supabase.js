const { createClient } = require('@supabase/supabase-js');

// Los valores se toman de las variables de entorno definidas en el .env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseEnabled = process.env.SUPABASE_ENABLED === 'true';

// Inicialización del cliente de Supabase
const isConfigured = Boolean(supabaseUrl && supabaseKey) && supabaseEnabled;
const supabase = isConfigured ? createClient(supabaseUrl, supabaseKey) : null;

module.exports = {
	supabase,
	isConfigured
};