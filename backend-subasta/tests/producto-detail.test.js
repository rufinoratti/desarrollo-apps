const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const catalogoService = require('../src/services/catalogo.service');
const pujasService = require('../src/services/pujas.service');

test('obtenerDetalleItem devuelve ficha_tecnica del ítem', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.equal(result.id, 'i101');
    assert.ok(result.ficha_tecnica);
    assert.ok(typeof result.ficha_tecnica === 'object');
    assert.ok(Object.keys(result.ficha_tecnica).length > 0);
    assert.ok(result.ficha_tecnica['Técnica']);
    assert.ok(result.ficha_tecnica['Dimensiones']);
});

test('obtenerDetalleItem devuelve duenio_nombre', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.ok(result.duenio_nombre);
    assert.equal(typeof result.duenio_nombre, 'string');
    assert.ok(result.duenio_nombre.length > 0);
});

test('obtenerDetalleItem devuelve subasta con fecha_fin', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.ok(result.subasta);
    assert.equal(result.subasta.id, 's1');
    assert.ok(result.subasta.fecha_fin);
    assert.ok(result.tiempo_restante_segundos !== null);
    assert.ok(typeof result.tiempo_restante_segundos === 'number');
    assert.ok(result.tiempo_restante_segundos > 0);
});

test('obtenerDetalleItem devuelve descripcion_detallada separada', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.ok(result.descripcion_detallada);
    assert.notEqual(result.descripcion_detallada, result.descripcion);
    assert.ok(result.descripcion_detallada.length > result.descripcion.length);
});

test('obtenerDetalleItem devuelve imagenes como array de URLs', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.ok(Array.isArray(result.imagenes));
    assert.ok(result.imagenes.length > 0);
    assert.ok(result.imagenes[0].startsWith('http'));
});

test('obtenerEstadoPujasItem limita historial a 3 elementos', async () => {
    const result = await pujasService.obtenerEstadoPujasItem({ itemId: 'i101' });

    assert.ok(Array.isArray(result.historial_pujas));
    assert.ok(result.historial_pujas.length <= 3);
});

test('obtenerEstadoPujasItem devuelve tiempo_restante_segundos', async () => {
    const result = await pujasService.obtenerEstadoPujasItem({ itemId: 'i101' });

    assert.ok(result.tiempo_restante_segundos !== null);
    assert.ok(typeof result.tiempo_restante_segundos === 'number');
    assert.ok(result.tiempo_restante_segundos > 0);
});

test('obtenerDetalleItem falla para ítem inexistente', async () => {
    await assert.rejects(
        () => catalogoService.obtenerDetalleItem({ itemId: 'inexistente' }),
        (err) => err.statusCode === 404
    );
});
