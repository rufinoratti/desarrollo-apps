const test = require('node:test');
const assert = require('node:assert/strict');

process.env.SUPABASE_ENABLED = 'false';

const catalogoService = require('../src/services/catalogo.service');
const homeService = require('../src/services/home.service');

test('homeService.obtenerSubastas en local trae EN_VIVO por defecto', async () => {
    const result = await homeService.obtenerSubastas({});
    assert.ok(Array.isArray(result.subastas));
    assert.ok(result.subastas.length > 0);
    assert.equal(result.subastas[0].estado, 'EN_VIVO');
});

test('catalogoService.obtenerCatalogoPorSubasta en local devuelve catálogo', async () => {
    const result = await catalogoService.obtenerCatalogoPorSubasta({ subastaId: 's1' });

    assert.ok(result.subasta_info);
    assert.equal(result.subasta_info.id, 's1');
    assert.ok(Array.isArray(result.articulos));
    assert.ok(result.articulos.length > 0);
    assert.equal(result.total_articulos, result.articulos.length);
});

test('catalogoService.obtenerDetalleItem en local devuelve detalle de item', async () => {
    const result = await catalogoService.obtenerDetalleItem({ itemId: 'i101' });

    assert.equal(result.id, 'i101');
    assert.ok(Array.isArray(result.imagenes));
    assert.ok(result.descripcion);
});
