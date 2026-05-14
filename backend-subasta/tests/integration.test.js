/**
 * ============================================================
 * INTEGRATION TESTS — Endpoints Protegidos y Públicos Completos
 * ============================================================
 *
 * Tests de integración que verifican TODOS los endpoints REST
 * mediante supertest, incluyendo autenticación JWT.
 *
 * Ejecutar con: npm test
 */

// Forzamos modo local antes de cargar la app (dotenv no sobreescribe env existente).
process.env.SUPABASE_ENABLED = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const app = require('../src/app');

const tmpDniPath = path.join(os.tmpdir(), 'test_dni.jpg');
if (!fs.existsSync(tmpDniPath)) {
    // JPEG mínimo (SOI + EOI) para que multer lo trate como imagen
    fs.writeFileSync(tmpDniPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
}

// ============================================================
// HELPERS
// ============================================================

async function loginAda() {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ada@rematix.com', password: 'Test1234!' });
    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
    return res.body.token;
}

// ============================================================
// MÓDULO 1 — AUTENTICACIÓN (Endpoints adicionales)
// ============================================================

test('GET /api/auth/usuarios — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/auth/usuarios');
    assert.equal(res.statusCode, 401);
});

test('GET /api/auth/usuarios — con token válido devuelve lista', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/auth/usuarios')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].usuario_id);
    assert.ok(res.body[0].nombre);
});

// ============================================================
// MÓDULO 2 — HOME Y EXPLORACIÓN
// ============================================================

test('GET /api/categorias — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/categorias');
    assert.equal(res.statusCode, 401);
});

test('GET /api/categorias — con token devuelve categorías', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/categorias')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
    assert.ok(res.body[0].id);
    assert.ok(res.body[0].nombre);
});

test('GET /api/subastas — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/subastas');
    assert.equal(res.statusCode, 401);
});

test('GET /api/subastas — con token devuelve subastas paginadas', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/subastas')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body.subastas));
    assert.ok(typeof res.body.total === 'number');
    assert.ok(typeof res.body.pagina_actual === 'number');
    assert.ok(typeof res.body.total_paginas === 'number');
});

test('GET /api/subastas?estado=EN_VIVO — filtra subastas en vivo', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/subastas?estado=EN_VIVO')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.subastas.every((s) => s.estado === 'EN_VIVO'));
});

test('GET /api/subastas?tematica=1 — filtra por categoría', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/subastas?tematica=1')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    // En local, subasta s1 tiene categoria_id 1 (Arte y Pintura)
    assert.ok(res.body.subastas.length >= 1);
});

// ============================================================
// MÓDULO 3 — CATÁLOGO
// ============================================================

test('GET /api/subastas/:id/catalogo — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/subastas/s1/catalogo');
    assert.equal(res.statusCode, 401);
});

test('GET /api/subastas/:id/catalogo — con token devuelve catálogo', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/subastas/s1/catalogo')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.subasta_info);
    assert.equal(res.body.subasta_info.id, 's1');
    assert.ok(Array.isArray(res.body.articulos));
});

test('GET /api/items/:id — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/items/i101');
    assert.equal(res.statusCode, 401);
});

test('GET /api/items/:id — con token devuelve detalle del item', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/items/i101')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.id, 'i101');
    assert.ok(res.body.descripcion);
    assert.ok(Array.isArray(res.body.imagenes));
});

// ============================================================
// MÓDULO 4 — PUJAS
// ============================================================

test('GET /api/items/:id/pujas — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/items/i101/pujas');
    assert.equal(res.statusCode, 401);
});

test('GET /api/items/:id/pujas — con token devuelve estado de pujas', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/items/i101/pujas')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.item_id, 'i101');
    assert.ok(typeof res.body.oferta_actual === 'number');
    assert.ok(Array.isArray(res.body.historial_pujas));
});

test('POST /api/pujas — sin token devuelve 401', async () => {
    const res = await request(app)
        .post('/api/pujas')
        .send({ item_id: 'i101', monto_ofertado: 16000 });
    assert.equal(res.statusCode, 401);
});

test('POST /api/pujas — con token registra puja válida', async () => {
    const token = await loginAda();
    const res = await request(app)
        .post('/api/pujas')
        .set('Authorization', `Bearer ${token}`)
        .send({ item_id: 'i101', monto_ofertado: 16000 });

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.mensaje, 'Puja registrada correctamente');
    assert.ok(res.body.posicion);
    assert.ok(typeof res.body.oferta_actual === 'number');
});

test('POST /api/pujas — con token rechaza monto insuficiente', async () => {
    const token = await loginAda();
    const res = await request(app)
        .post('/api/pujas')
        .set('Authorization', `Bearer ${token}`)
        .send({ item_id: 'i101', monto_ofertado: 15050 });

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.codigo, 'MONTO_INSUFICIENTE');
});

// ============================================================
// MÓDULO 5 — BILLETERA
// ============================================================

test('GET /api/billetera/medios-pago — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/billetera/medios-pago');
    assert.equal(res.statusCode, 401);
});

test('GET /api/billetera/medios-pago — con token lista medios', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
});

test('POST /api/billetera/medios-pago — con token agrega medio', async () => {
    const token = await loginAda();
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
            tipo_pago: 'CUENTA_BANCARIA',
            moneda: 'ARS',
            detalles: {
                cbu_alias: '0170001234567890123456',
                banco: 'Banco Galicia',
                titular: 'Ada Lovelace'
            }
        });

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.estado, 'VERIFICADA');
});

test('POST /api/billetera/medios-pago — rechaza datos incompletos', async () => {
    const token = await loginAda();
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
            tipo_pago: 'CUENTA_BANCARIA',
            moneda: 'ARS',
            detalles: {
                // falta cbu_alias y banco
                titular: 'Ada Lovelace'
            }
        });

    assert.equal(res.statusCode, 400);
});

// ============================================================
// MÓDULO 6 — PERFIL
// ============================================================

test('GET /api/perfil — sin token devuelve 401', async () => {
    const res = await request(app).get('/api/perfil');
    assert.equal(res.statusCode, 401);
});

test('GET /api/perfil — con token devuelve perfil', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/perfil')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.usuario_id, 'u1');
    assert.ok(res.body.nombre_completo);
    assert.ok(res.body.datos_personales);
});

test('PUT /api/perfil — con token actualiza perfil', async () => {
    const token = await loginAda();
    const res = await request(app)
        .put('/api/perfil')
        .set('Authorization', `Bearer ${token}`)
        .send({
            nombre_completo: 'Ada Test Integración',
            direccion: 'Dirección Test 456'
        });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.mensaje, 'Perfil actualizado correctamente');
});

test('GET /api/perfil/estadisticas — con token devuelve métricas', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/perfil/estadisticas')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(typeof res.body.subastas_participadas === 'number');
    assert.ok(typeof res.body.lotes_ganados === 'number');
    assert.ok(typeof res.body.total_pujas === 'number');
    assert.ok(typeof res.body.inversion_total === 'number');
});

test('GET /api/perfil/restricciones — con token devuelve restricciones', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/perfil/restricciones')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(typeof res.body.restriccion_activa === 'boolean');
    assert.ok(typeof res.body.monto_regularizar === 'number');
});

// ============================================================
// MÓDULO 5 — BILLETERA (DELETE)
// ============================================================

test('DELETE /api/billetera/medios-pago/:id — no permite eliminar único medio', async () => {
    const token = await loginAda();
    // Primero obtener medios
    const listRes = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    const medios = listRes.body;
    // Si solo hay un medio, debería rechazar la eliminación
    if (medios.length === 1) {
        const res = await request(app)
            .delete(`/api/billetera/medios-pago/${medios[0].id}`)
            .set('Authorization', `Bearer ${token}`);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.codigo, 'UNICO_MEDIO_PAGO');
    }
});

test('DELETE /api/billetera/medios-pago/:id — elimina medio cuando hay más de uno', async () => {
    const token = await loginAda();

    // Agregar un segundo medio
    const addRes = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
            tipo_pago: 'CUENTA_BANCARIA',
            moneda: 'ARS',
            detalles: {
                cbu_alias: '0170001234567890123457',
                banco: 'Banco Nación',
                titular: 'Ada Lovelace'
            }
        });
    assert.equal(addRes.statusCode, 201);
    const nuevoMedioId = addRes.body.id;

    // Eliminar el medio recién agregado
    const delRes = await request(app)
        .delete(`/api/billetera/medios-pago/${nuevoMedioId}`)
        .set('Authorization', `Bearer ${token}`);

    assert.equal(delRes.statusCode, 200);
    assert.ok(delRes.body.mensaje);
});

// ============================================================
// MÓDULO 1 — AUTENTICACIÓN (Flujo completo de registro paso 1-4)
// ============================================================

test('POST /api/auth/registro/paso3 — sube DNI y avanza registro', async () => {
    const email = `test.paso3.${Date.now()}@rematix.com`;

    // Paso 1
    const paso1 = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Test Paso3',
            documento: '99888776',
            direccion: 'Av. Test 123',
            pais_residencia: 1,
            email
        });
    assert.equal(paso1.statusCode, 201);
    const registroId = paso1.body.registro_id;

    // Paso 2
    const paso2 = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: registroId,
            password: 'MiClave123!'
        });
    assert.equal(paso2.statusCode, 200);

    // Paso 3 — subir imágenes
    const paso3 = await request(app)
        .post('/api/auth/registro/paso3')
        .field('registro_id', registroId)
        .attach('dni_frente', tmpDniPath)
        .attach('dni_dorso', tmpDniPath);

    assert.equal(paso3.statusCode, 200);
    assert.equal(paso3.body.estado_validacion, 'EN_REVISION');
});

test('POST /api/auth/registro/paso4-pago — completa registro y crea usuario', async () => {
    const email = `test.paso4.${Date.now()}@rematix.com`;

    // Paso 1
    const paso1 = await request(app)
        .post('/api/auth/registro/paso1')
        .send({
            nombre_completo: 'Test Paso4',
            documento: '99888775',
            direccion: 'Av. Test 456',
            pais_residencia: 1,
            email
        });
    assert.equal(paso1.statusCode, 201);
    const registroId = paso1.body.registro_id;

    // Paso 2
    const paso2 = await request(app)
        .post('/api/auth/registro/paso2')
        .send({
            registro_id: registroId,
            password: 'MiClave123!'
        });
    assert.equal(paso2.statusCode, 200);

    // Paso 3
    const paso3 = await request(app)
        .post('/api/auth/registro/paso3')
        .field('registro_id', registroId)
        .attach('dni_frente', tmpDniPath)
        .attach('dni_dorso', tmpDniPath);
    assert.equal(paso3.statusCode, 200);

    // Paso 4
    const paso4 = await request(app)
        .post('/api/auth/registro/paso4-pago')
        .send({
            registro_id: registroId,
            tipo_pago: 'CUENTA_BANCARIA',
            detalles: {
                cbu_alias: '0170001234567890123458',
                banco: 'Banco Galicia',
                titular: 'Test Paso4'
            }
        });

    assert.equal(paso4.statusCode, 201);
    assert.ok(paso4.body.usuario_id);
    assert.ok(paso4.body.token);
    assert.ok(paso4.body.mensaje);
});

// ============================================================
// 404 GLOBAL
// ============================================================

test('GET /api/ruta-inexistente devuelve 404', async () => {
    const token = await loginAda();
    const res = await request(app)
        .get('/api/ruta-inexistente')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error, 'Ruta no encontrada');
});
