process.env.SUPABASE_ENABLED = 'false';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');

let token;

test('POST /api/auth/login — obtener token para Ada', async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ada@rematix.com', password: 'Test1234!' });

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.token);
    token = res.body.token;
});

test('GET /api/billetera/medios-pago — lista medios del usuario autenticado', async () => {
    const res = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
    assert.ok(res.body[0].id);
    assert.ok(res.body[0].tipo_pago);
    assert.ok(res.body[0].descripcion_corta);
});

test('GET /api/billetera/medios-pago — rechaza sin token', async () => {
    const res = await request(app).get('/api/billetera/medios-pago');
    assert.equal(res.statusCode, 401);
});

test('POST /api/billetera/medios-pago — agrega cuenta bancaria', async () => {
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
            tipo_pago: 'CUENTA_BANCARIA',
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

test('POST /api/billetera/medios-pago — agrega tarjeta de crédito', async () => {
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({
            tipo_pago: 'TARJETA',
            detalles: {
                numero_tarjeta: '4111111111111111',
                titular: 'Ada Lovelace',
                cvv: '123',
                fecha_expiracion: '12/28'
            }
        });

    assert.equal(res.statusCode, 201);
    assert.ok(res.body.id);
    assert.equal(res.body.estado, 'VERIFICADA');
});

test('POST /api/billetera/medios-pago — rechaza datos inválidos', async () => {
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`)
        .send({ tipo_pago: 'CUENTA_BANCARIA', detalles: {} });

    assert.equal(res.statusCode, 400);
});

test('POST /api/billetera/medios-pago — rechaza sin token', async () => {
    const res = await request(app)
        .post('/api/billetera/medios-pago')
        .send({ tipo_pago: 'CUENTA_BANCARIA', detalles: { cbu_alias: 'test', banco: 'test', titular: 'test' } });

    assert.equal(res.statusCode, 401);
});

test('DELETE /api/billetera/medios-pago/:id — elimina medio de pago', async () => {
    const listRes = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    const medioId = listRes.body[listRes.body.length - 1]?.id;
    if (!medioId) {
        assert.fail('No hay medios de pago para eliminar');
    }

    const res = await request(app)
        .delete(`/api/billetera/medios-pago/${medioId}`)
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.mensaje);
});

test('DELETE /api/billetera/medios-pago/:id — rechaza sin token', async () => {
    const res = await request(app).delete('/api/billetera/medios-pago/1');
    assert.equal(res.statusCode, 401);
});

test('DELETE /api/billetera/medios-pago/:id — rechaza id inexistente', async () => {
    const res = await request(app)
        .delete('/api/billetera/medios-pago/999999')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 404);
});

test('GET /api/billetera/medios-pago/:id — obtiene detalle de medio de pago', async () => {
    const listRes = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    const medioId = listRes.body[listRes.body.length - 1]?.id;
    if (!medioId) {
        assert.fail('No hay medios de pago para consultar');
    }

    const res = await request(app)
        .get(`/api/billetera/medios-pago/${medioId}`)
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 200);
    assert.ok(res.body.id);
    assert.ok(res.body.tipo_pago);
    assert.ok(res.body.descripcion_corta);
    assert.ok(res.body.estado);
    assert.ok(res.body.entidad !== undefined);
    assert.ok(res.body.moneda);
});

test('GET /api/billetera/medios-pago/:id — rechaza sin token', async () => {
    const res = await request(app).get('/api/billetera/medios-pago/1');
    assert.equal(res.statusCode, 401);
});

test('GET /api/billetera/medios-pago/:id — rechaza id inexistente', async () => {
    const res = await request(app)
        .get('/api/billetera/medios-pago/999999')
        .set('Authorization', `Bearer ${token}`);

    assert.equal(res.statusCode, 404);
});

test('DELETE /api/billetera/medios-pago/:id — no permite eliminar único medio', async () => {
    const listRes = await request(app)
        .get('/api/billetera/medios-pago')
        .set('Authorization', `Bearer ${token}`);

    const ids = listRes.body.map((m) => m.id);

    const res = await request(app)
        .delete(`/api/billetera/medios-pago/${ids[0]}`)
        .set('Authorization', `Bearer ${token}`);

    if (ids.length === 1) {
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.codigo, 'UNICO_MEDIO_PAGO');
    } else {
        assert.equal(res.statusCode, 200);
    }
});
