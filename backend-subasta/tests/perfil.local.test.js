const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const perfilService = require('../src/services/perfil.service');
const { store } = require('../src/services/data.store');

const authUser = { id: 'u1', email: 'ada@rematix.com' };

test('obtenerPerfil retorna datos personales y cuenta_cobro nullable', async () => {
    const result = await perfilService.obtenerPerfil(authUser);

    assert.equal(result.usuario_id, 'u1');
    assert.ok(result.nombre_completo);
    assert.ok(result.datos_personales);
    assert.ok(Object.prototype.hasOwnProperty.call(result, 'cuenta_cobro'));
});

test('actualizarPerfil actualiza nombre y direccion ignorando telefono', async () => {
    const result = await perfilService.actualizarPerfil(authUser, {
        nombre_completo: 'Ada Actualizada',
        direccion: 'Nueva Dirección 123',
        telefono: '+5491111111111'
    });

    const user = store.users.find((u) => u.id === 'u1');

    assert.equal(result.mensaje, 'Perfil actualizado correctamente');
    assert.equal(user.nombre_completo, 'Ada Actualizada');
    assert.equal(user.direccion, 'Nueva Dirección 123');
    assert.equal(user.domicilio_legal, 'Nueva Dirección 123');
});

test('obtenerEstadisticas devuelve métricas numéricas', async () => {
    // Seed local mínimo para estadísticas
    if (!Array.isArray(store.asistentes)) store.asistentes = [];
    if (!Array.isArray(store.registroDeSubasta)) store.registroDeSubasta = [];

    store.asistentes.push({ id: 'as-test-1', cliente_id: 'u1', subasta_id: 's1', numero_postor: 1 });
    store.bids.push({ id: 'b-test-1', asistente_id: 'as-test-1', item_id: 'i101', monto: 17000, ganador: 'si', fecha_puja: new Date().toISOString() });
    store.registroDeSubasta.push({ cliente_id: 'u1', importe: 10000, estado_cobro: 'pagado' });

    const stats = await perfilService.obtenerEstadisticas(authUser);

    assert.ok(typeof stats.subastas_participadas === 'number');
    assert.ok(typeof stats.lotes_ganados === 'number');
    assert.ok(typeof stats.total_pujas === 'number');
    assert.ok(typeof stats.inversion_total === 'number');
});

test('obtenerRestricciones detecta deuda impaga y calcula 10%', async () => {
    if (!Array.isArray(store.registroDeSubasta)) store.registroDeSubasta = [];
    store.registroDeSubasta.push({ cliente_id: 'u1', importe: 50000, estado_cobro: 'impago' });

    const restr = await perfilService.obtenerRestricciones(authUser);

    assert.equal(restr.restriccion_activa, true);
    assert.equal(restr.monto_regularizar, 5000);
    assert.ok(restr.motivo);
});
