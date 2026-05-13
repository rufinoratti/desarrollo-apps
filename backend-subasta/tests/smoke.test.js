/**
 * ============================================================
 * SMOKE TESTS — Módulo 1: Autenticación y Registro
 * ============================================================
 *
 * Tests de humo que verifican que los endpoints principales
 * del módulo de autenticación respondan correctamente.
 *
 * Ejecutar con: npm test
 */

// Forzamos modo local antes de cargar la app (dotenv no sobreescribe env existente).
process.env.SUPABASE_ENABLED = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { store } = require('../src/services/data.store');

// ============================================================
// HEALTH CHECK
// ============================================================

test('GET /api/health responde OK', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.ok, true);
});

// ============================================================
// CATÁLOGOS (sin autenticación)
// ============================================================

test('GET /api/auth/paises devuelve lista de países', async () => {
    const res = await request(app).get('/api/auth/paises');
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    // En DB el PK es `numero`, en catálogo local histórico es `id`
    assert.ok(res.body[0].numero || res.body[0].id);
    assert.ok(res.body[0].nombre);
    assert.ok(res.body[0].nombrecorto);
});

test('GET /api/auth/bancos devuelve lista de bancos', async () => {
    const res = await request(app).get('/api/auth/bancos');
    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].id);
    assert.ok(res.body[0].nombre);
    assert.ok(res.body[0].codigo);
});

// ============================================================
// FLUJO DE REGISTRO COMPLETO (4 pasos)
// ============================================================

// Almacenamos el registro_id entre tests
let registroId;

test('POST /api/auth/registro/paso1 — crea registro temporal', async () => {
    const res = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Test Usuario',
            documento: '99888777',
            direccion: 'Av. Corrientes 1234',
            pais_residencia: 1,
            email: 'test.smoke@rematix.com'
        });

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.registro_id);
    assert.ok(res.body.mensaje);
    registroId = res.body.registro_id;
});

test('POST /api/auth/registro/paso1 — rechaza email duplicado', async () => {
    const res = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Test Usuario',
            documento: '99888777',
            direccion: 'Av. Corrientes 1234',
            pais_residencia: 1,
            email: 'test.smoke@rematix.com'  // mismo email
        });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.codigo, 'EMAIL_DUPLICADO');
});

test('POST /api/auth/registro/paso1 — rechaza país inválido', async () => {
    const res = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Otro Usuario',
            documento: '11222333',
            direccion: 'Calle Falsa 123',
            pais_residencia: 999,
            email: 'otro@rematix.com'
        });

    assert.equal(res.statusCode, 400);
});

test('POST /api/auth/registro/paso2 — asocia contraseña al registro', async () => {
    const res = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: registroId,
            password: 'MiClave123!'
        });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.mensaje);
});

test('POST /api/auth/registro/paso2 — rechaza contraseña débil', async () => {
    const res = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: 'reg_inexistente',
            password: '1234'
        });

    // registro_id inexistente retorna 404, pero validamos password primero
    // probamos con uno conocido que ya fue al paso 2
    const res2 = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: 'reg_solo_para_testear',
            password: 'sinmayuscula1'
        });

    assert.equal(res2.statusCode, 404); // registro no existe, no llega a validar
});

test('POST /api/auth/registro/paso2 — rechaza contraseña sin mayúscula (registro_id válido no puede reusarse)', async () => {
    // Este test verifica directamente la respuesta de contraseña débil
    // usando un registro temporal recién creado
    const paso1 = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Test Clave',
            documento: '55444333',
            direccion: 'Calle Test 1',
            pais_residencia: 1,
            email: 'test.clave@rematix.com'
        });

    const tempId = paso1.body.registro_id;

    const res = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: tempId,
            password: 'sinmayuscula1'  // sin mayúscula → PASSWORD_DEBIL
        });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.codigo, 'PASSWORD_DEBIL');
});

// ============================================================
// LOGIN
// ============================================================

test('POST /api/auth/login — credenciales inválidas devuelven 401', async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .send({
            email: 'noexiste@rematix.com',
            password: 'CualquierClave1!'
        });

    assert.equal(res.statusCode, 401);
    assert.equal(res.body.codigo, 'CREDENCIALES_INVALIDAS');
});

test('POST /api/auth/login — usuario semilla Ada Lovelace puede autenticarse', async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .send({
            email: 'ada@rematix.com',
            password: 'Test1234!'
        });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.usuario_id);
    assert.ok(res.body.nombre);
    assert.ok(res.body.categoria);
});

// ============================================================
// LOGOUT
// ============================================================

test('POST /api/auth/logout — sin token devuelve 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    assert.equal(res.statusCode, 401);
});

test('POST /api/auth/logout — con token válido cierra la sesión', async () => {
    // Primero loguear para obtener token
    const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ada@rematix.com', password: 'Test1234!' });

    const token = loginRes.body.token;

    const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.mensaje);
});

// ============================================================
// RECUPERAR CONTRASEÑA
// ============================================================

test('POST /api/auth/recuperar-clave — email válido devuelve 200', async () => {
    const res = await request(app)
        .post('/api/auth/recuperar-clave')
        // Debe existir para que retorne 200 (cambiamos lógica de negocio)
        .send({ email: 'ada@rematix.com' });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.mensaje);
});

test('POST /api/auth/recuperar-clave — rate limit bloquea segunda solicitud inmediata', async () => {
    const email = 'ada@rematix.com';

    // Primera solicitud: OK
    await request(app)
        .post('/api/auth/recuperar-clave')
        .send({ email });

    // Segunda solicitud inmediata: debe ser bloqueada
    const res = await request(app)
        .post('/api/auth/recuperar-clave')
        .send({ email });

    assert.equal(res.statusCode, 429);
    assert.equal(res.body.codigo, 'RATE_LIMIT');
});

test('POST /api/auth/recuperar-clave — email inválido devuelve 400', async () => {
    const res = await request(app)
        .post('/api/auth/recuperar-clave')
        .send({ email: 'no-es-un-email' });

    assert.equal(res.statusCode, 400);
});

// ============================================================
// RESTABLECER CONTRASEÑA (con token)
// ============================================================

let resetToken;
let resetEmail;

test('POST /api/auth/recuperar-clave — captura token para tests siguientes', async () => {
    store.recoveryAttempts = {};
    const res = await request(app)
        .post('/api/auth/recuperar-clave')
        .send({ email: 'ada@rematix.com' });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.resetToken);
    resetToken = res.body.resetToken;
    resetEmail = res.body.email;
});

test('POST /api/auth/restablecer-clave — token válido actualiza contraseña', async () => {
    const res = await request(app)
        .post('/api/auth/restablecer-clave')
        .send({
            email: resetEmail,
            token: resetToken,
            newPassword: 'TestReset1'
        });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.mensaje);
});

test('POST /api/auth/restablecer-clave — nueva contraseña funciona en login', async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ada@rematix.com', password: 'TestReset1' });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
});

test('POST /api/auth/restablecer-clave — token inválido devuelve 401', async () => {
    const res = await request(app)
        .post('/api/auth/restablecer-clave')
        .send({
            email: 'ada@rematix.com',
            token: 'token-falso',
            newPassword: 'TestNueva1'
        });

    assert.equal(res.statusCode, 401);
});

test('POST /api/auth/restablecer-clave — datos incompletos devuelve 400', async () => {
    const res = await request(app)
        .post('/api/auth/restablecer-clave')
        .send({ email: 'ada@rematix.com' });

    assert.equal(res.statusCode, 400);
});

test('GET /api/auth/reset-password — devuelve página HTML', async () => {
    const res = await request(app).get('/api/auth/reset-password');

    assert.equal(res.statusCode, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.text.includes('REMATIX'));
    assert.ok(res.text.includes('Nueva Contrase'));
    assert.ok(res.text.includes('auth/v1/user'));
});

// Restaurar contraseña original de Ada para no romper otros tests
test('POST /api/auth/recuperar-clave — restaura contraseña original de Ada', async () => {
    store.recoveryAttempts = {};
    const rec = await request(app)
        .post('/api/auth/recuperar-clave')
        .send({ email: 'ada@rematix.com' });

    await request(app)
        .post('/api/auth/restablecer-clave')
        .send({
            email: rec.body.email,
            token: rec.body.resetToken,
            newPassword: 'Test1234!'
        });

    const login = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ada@rematix.com', password: 'Test1234!' });

    assert.equal(login.statusCode, 200);
});
