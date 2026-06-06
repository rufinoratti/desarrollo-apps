const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const pujasService = require('../src/services/pujas.service');
const { store } = require('../src/services/data.store');

const authUser = { id: 'u1', email: 'ada@rematix.com' };

test('obtenerEstadoPujasItem devuelve oferta actual e historial', async () => {
    const result = await pujasService.obtenerEstadoPujasItem({ itemId: 'i101' });

    assert.equal(result.item_id, 'i101');
    assert.ok(typeof result.oferta_actual === 'number');
    assert.ok(Array.isArray(result.historial_pujas));
    assert.ok(['ABIERTA', 'CERRADA', 'FINALIZADA'].includes(result.estado_subasta));
});

test('realizarPuja registra puja válida', async () => {
    const before = store.bids.length;

    const result = await pujasService.realizarPuja({
        authUser,
        payload: {
            item_id: 'i101',
            monto_ofertado: 15200
        }
    });

    const after = store.bids.length;

    assert.equal(after, before + 1);
    assert.equal(result.mensaje, 'Puja registrada correctamente');
    assert.equal(result.posicion, 'GANANDO');
    assert.equal(result.oferta_actual, 15200);
});

test('realizarPuja rechaza monto por debajo del mínimo', async () => {
    await assert.rejects(
        () => pujasService.realizarPuja({
            authUser,
            payload: {
                item_id: 'i101',
                monto_ofertado: 15050
            }
        }),
        (err) => err.statusCode === 400 && err.codigo === 'MONTO_INSUFICIENTE'
    );
});

test('realizarPuja rechaza monto por encima del máximo (regla 20%)', async () => {
    await assert.rejects(
        () => pujasService.realizarPuja({
            authUser,
            payload: {
                item_id: 'i101',
                monto_ofertado: 18000
            }
        }),
        (err) => err.statusCode === 400 && err.codigo === 'MONTO_EXCEDE_LIMITE'
    );
});
