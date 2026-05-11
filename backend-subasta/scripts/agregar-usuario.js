const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('ERROR: SUPABASE_URL o SUPABASE_ANON_KEY no definidos en .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
    const email = 'rufinoratti@gmail.com';
    const password = 'Test1234!';
    const nombre_completo = 'Rufino Ratti';
    const documento = '20123456789';
    const direccion = 'Av. Siempre Viva 742';
    const paisId = 32; // Argentina

    try {
        // 1. Insertar en personas
        console.log('[1/4] Insertando en personas...');
        const { data: persona, error: personaErr } = await supabase
            .from('personas')
            .insert({
                documento,
                nombre: nombre_completo,
                direccion,
                email,
                estado: 'activo'
            })
            .select()
            .single();

        if (personaErr) {
            console.error('Error en personas:', personaErr.message);
            return;
        }
        console.log('  persona creada, identificador:', persona.identificador);

        // 2. Crear usuario en Supabase Auth
        console.log('[2/4] Creando usuario en Supabase Auth...');
        const { data: authData, error: authErr } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    persona_id: persona.identificador,
                    nombre_completo
                }
            }
        });

        if (authErr) {
            console.error('Error en Auth:', authErr.message);
        } else {
            console.log('  auth user creado, id:', authData.user?.id);
        }

        // 3. Insertar en clientes
        console.log('[3/4] Insertando en clientes...');
        const { data: cliente, error: clienteErr } = await supabase
            .from('clientes')
            .insert({
                identificador: persona.identificador,
                numeropais: paisId,
                admitido: 'si',
                categoria: 'comun'
            })
            .select()
            .single();

        if (clienteErr) {
            console.error('Error en clientes:', clienteErr.message);
            return;
        }
        console.log('  cliente creado');

        // 4. Verificar datos
        console.log('[4/4] Verificando...');
        const { data: personaCheck } = await supabase
            .from('personas')
            .select('*')
            .eq('email', email)
            .single();

        const { data: clienteCheck } = await supabase
            .from('clientes')
            .select('*')
            .eq('identificador', persona.identificador)
            .single();

        console.log('\n--- RESUMEN ---');
        console.log('Email:', email);
        console.log('Contraseña:', password);
        console.log('Persona:', personaCheck);
        console.log('Cliente:', clienteCheck);
        console.log('\nListo.');

    } catch (err) {
        console.error('Error inesperado:', err);
    }
})();
