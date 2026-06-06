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

test('obtenerEstadoCuenta retorna estructura completa con 9 items y resumen', async () => {
    const result = await perfilService.obtenerEstadoCuenta(authUser);

    assert.ok(result.estado_general);
    assert.ok(['CORRECTO', 'CON_OBSERVACIONES', 'CON_DEUDA', 'BLOQUEADO', 'EN_REVISION'].includes(result.estado_general));
    assert.ok(result.mensaje_principal);
    assert.ok(result.timestamp_verificacion);
    assert.equal(result.usuario.id, 'u1');
    assert.ok(typeof result.usuario.nombre_completo === 'string' && result.usuario.nombre_completo.length > 0);
    assert.equal(result.verificacion.admitido, 'si');
    assert.equal(result.verificacion.categoria, 'PLATINO');
    assert.equal(result.es_duenio, false);
    assert.equal(result.cuenta_cobro, null);
    assert.equal(Array.isArray(result.items), true);
    assert.equal(result.items.length, 9);
    assert.ok(result.resumen);
    assert.equal(result.resumen.total_puntos, 9);
    assert.equal(
        result.resumen.puntos_ok + result.resumen.puntos_pendientes + result.resumen.puntos_advertencia,
        9
    );

    const ids = result.items.map((i) => i.id);
    assert.ok(ids.includes('identidad'));
    assert.ok(ids.includes('email'));
    assert.ok(ids.includes('telefono'));
    assert.ok(ids.includes('direccion'));
    assert.ok(ids.includes('categoria'));
    assert.ok(ids.includes('banco'));
    assert.ok(ids.includes('duenio'));
    assert.ok(ids.includes('deuda'));
    assert.ok(ids.includes('estado'));
});

test('obtenerEstadoCuenta refleja deuda impaga como CON_DEUDA', async () => {
    if (!Array.isArray(store.registroDeSubasta)) store.registroDeSubasta = [];
    store.registroDeSubasta = [
        { cliente_id: 'u1', importe: 80000, estado_cobro: 'impago' }
    ];

    const result = await perfilService.obtenerEstadoCuenta(authUser);

    assert.equal(result.estado_general, 'CON_DEUDA');
    const itemDeuda = result.items.find((i) => i.id === 'deuda');
    assert.equal(itemDeuda.status, 'ADVERTENCIA');
    assert.ok(itemDeuda.detalle.length > 0);
    assert.ok(/Adeuda/.test(itemDeuda.detalle));
    assert.ok(/\$/.test(itemDeuda.detalle));
});

test('obtenerEstadoCuenta sin deuda vuelve a CORRECTO/CON_OBSERVACIONES', async () => {
    if (!Array.isArray(store.registroDeSubasta)) store.registroDeSubasta = [];
    store.registroDeSubasta = store.registroDeSubasta.filter(
        (r) => !(String(r.cliente_id) === 'u1' && String(r.estado_cobro || '').toLowerCase() === 'impago')
    );

    const result = await perfilService.obtenerEstadoCuenta(authUser);

    assert.notEqual(result.estado_general, 'CON_DEUDA');
    assert.notEqual(result.estado_general, 'BLOQUEADO');
});

test('obtenerEstadoCuenta maneja telefono/direccion/cuenta_bancaria cuando se completan', async () => {
    const user = store.users.find((u) => u.id === 'u1');
    user.telefono = '+541112345678';
    user.domicilio_legal = 'Av Corrientes 1234';
    user.medios_pago = [
        { id: 'mp-cuenta', tipo: 'cuenta_bancaria', entidad: 'Banco Galicia', verificado: 'si', detalles_enmascarados: 'CBU **** 1234', es_principal: 'si' }
    ];
    store.duenios = [{ identificador: 'u1' }];

    const result = await perfilService.obtenerEstadoCuenta(authUser);

    assert.ok(result.cuenta_cobro);
    assert.equal(result.cuenta_cobro.entidad_bancaria, 'Banco Galicia');
    assert.equal(result.cuenta_cobro.estado_verificacion, 'VERIFICADA');
    assert.equal(result.es_duenio, true);

    const itemBanco = result.items.find((i) => i.id === 'banco');
    assert.equal(itemBanco.status, 'OK');
    const itemDuenio = result.items.find((i) => i.id === 'duenio');
    assert.equal(itemDuenio.status, 'OK');
    const itemTel = result.items.find((i) => i.id === 'telefono');
    assert.equal(itemTel.status, 'OK');
    const itemDir = result.items.find((i) => i.id === 'direccion');
    assert.equal(itemDir.status, 'OK');
});
