/**
 * ============================================================
 * TESTS DE REGRESIÓN — mis-bienes.crearProducto con Supabase mockeado
 * ============================================================
 *
 * Estos tests cubren la rama Supabase de `crearProducto` mockeando
 * el cliente de Supabase, para validar:
 *   1. Camino feliz: seguro creado → producto linkeado → fotos guardadas.
 *   2. RLS bloquea INSERT de seguro en silencio → tira error claro, NO crea producto.
 *   3. FK violation en producto → tira error Y borra seguro (rollback).
 *   4. nropoliza duplicado → 400 sin tocar tablas.
 *   5. Validación de campos del seguro faltantes → 400 sin tocar Supabase.
 */

process.env.SUPABASE_ENABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const authUser = { id: 1, email: 'duenio-test@rematix.com' };

const fileMock = [{ filename: 'foto-1.jpg' }, { filename: 'foto-2.jpg' }];
const validPayload = {
    descripcioncatalogo: 'Reloj Suizo de Colección',
    descripcioncompleta: 'Reloj de pulso en oro 18k, año 1965, en perfecto estado',
    preciosugerido: 150000,
    revisor: 7,
    seguro_nropoliza: 'POL-TEST-001',
    seguro_compania: 'Mapfre',
    seguro_importe: 500000,
    seguro_polizacombinada: 'no'
};

/**
 * Construye un mock programable del cliente Supabase.
 * Devuelve el mock + un set de spies para que cada test configure
 * las respuestas que necesite.
 */
function buildSupabaseMock() {
    const calls = {
        segurosInsert: [],
        segurosSelectExistente: [],
        productosInsert: [],
        fotosInsert: [],
        segurosDelete: [],
        productosDelete: []
    };

    const queue = []; // { type, response }

    const makeBuilder = (table) => {
        const builder = {
            _table: table,
            insert(payload) {
                if (table === 'seguros') calls.segurosInsert.push(payload);
                if (table === 'productos') calls.productosInsert.push(payload);
                if (table === 'fotos') calls.fotosInsert.push(payload);
                return builder;
            },
            select() { return builder; },
            eq() { return builder; },
            maybeSingle: async () => {
                if (table === 'seguros') {
                    calls.segurosSelectExistente.push('lookup');
                    return { data: null, error: null };
                }
                return { data: null, error: null };
            },
            single: async () => {
                if (table === 'seguros') {
                    const next = queue.shift();
                    if (next?.type === 'seguros.single') return next.response;
                    return { data: { nropoliza: validPayload.seguro_nropoliza }, error: null };
                }
                if (table === 'productos') {
                    const next = queue.shift();
                    if (next?.type === 'productos.single') return next.response;
                    return { data: { identificador: 999, seguro: validPayload.seguro_nropoliza }, error: null };
                }
                return { data: null, error: null };
            },
            delete() {
                if (table === 'seguros') calls.segurosDelete.push(true);
                if (table === 'productos') calls.productosDelete.push(true);
                return builder;
            }
        };
        return builder;
    };

    const supabase = {
        from(table) { return makeBuilder(table); },
        __queue: queue,
        __calls: calls
    };

    return supabase;
}

/**
 * Helper para interceptar `require('../src/config/supabase')` y devolver nuestro mock.
 */
function installSupabaseMock(mock) {
    const original = Module.prototype.require;
    Module.prototype.require = function patched(id) {
        if (id === '../config/supabase' || id.endsWith('/config/supabase')) {
            return { supabase: mock, isConfigured: true };
        }
        return original.apply(this, arguments);
    };
    return () => {
        Module.prototype.require = original;
    };
}

// ============================================================
// TESTS
// ============================================================

test('crearProducto (Supabase) — camino feliz: crea seguro, producto linkeado y fotos', async () => {
    const mock = buildSupabaseMock();
    const restore = installSupabaseMock(mock);

    try {
        // Requerir el servicio DESPUÉS de instalar el mock
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        // Stubeamos ensureDuenioSupabase reemplazando el cliente (ya está mockeado arriba)
        // La función usa supabase.from('duenios')... necesitamos devolver un duenio existente
        // Lo agregamos a la cola de single()
        mock.__queue.push({ type: 'productos.single', response: { data: { identificador: 999, seguro: 'POL-TEST-001' }, error: null } });

        // Mock duenios
        const originalFrom = mock.from;
        mock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(mock, table);
        };

        const result = await service.crearProducto({
            authUser,
            payload: validPayload,
            files: fileMock,
            baseUrl: 'http://localhost:3000'
        });

        assert.equal(result.mensaje, 'Producto enviado a revisión');
        assert.equal(result.producto_id, '999');

        // Seguro insertado con los datos correctos
        assert.equal(mock.__calls.segurosInsert.length, 1);
        assert.equal(mock.__calls.segurosInsert[0].nropoliza, 'POL-TEST-001');
        assert.equal(mock.__calls.segurosInsert[0].compania, 'Mapfre');
        assert.equal(mock.__calls.segurosInsert[0].importe, 500000);
        assert.equal(mock.__calls.segurosInsert[0].polizacombinada, 'no');

        // Producto insertado con link al seguro
        assert.equal(mock.__calls.productosInsert.length, 1);
        assert.equal(mock.__calls.productosInsert[0].seguro, 'POL-TEST-001');

        // 2 fotos insertadas
        assert.equal(mock.__calls.fotosInsert.length, 1);
        assert.equal(mock.__calls.fotosInsert[0].length, 2);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — RLS rechaza INSERT de seguro en silencio: tira error y NO crea producto', async () => {
    const mock = buildSupabaseMock();
    const restore = installSupabaseMock(mock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        // Forzamos que el .single() del seguro devuelva data null (RLS silencioso)
        mock.__queue.push({ type: 'seguros.single', response: { data: null, error: null } });

        // Mock duenios
        const originalFrom = mock.from;
        mock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(mock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock,
                baseUrl: 'http://localhost:3000'
            }),
            (err) => {
                assert.equal(err.statusCode, 500);
                assert.match(err.message, /policies RLS|seguro/);
                return true;
            }
        );

        // El producto NO se debe haber intentado insertar
        assert.equal(mock.__calls.productosInsert.length, 0);
        // Las fotos tampoco
        assert.equal(mock.__calls.fotosInsert.length, 0);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — error al insertar producto: rollback del seguro', async () => {
    const mock = buildSupabaseMock();
    const restore = installSupabaseMock(mock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        // Seguro se inserta OK
        mock.__queue.push({ type: 'seguros.single', response: { data: { nropoliza: 'POL-TEST-001' }, error: null } });
        // Producto falla con FK violation
        mock.__queue.push({ type: 'productos.single', response: { data: null, error: { message: 'foreign key violation' } } });

        const originalFrom = mock.from;
        mock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(mock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock,
                baseUrl: 'http://localhost:3000'
            }),
            (err) => {
                assert.equal(err.statusCode, 500);
                assert.match(err.message, /foreign key violation/);
                return true;
            }
        );

        // El seguro debe haberse borrado en el rollback
        assert.equal(mock.__calls.segurosDelete.length, 1);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — nropoliza duplicado: 400 sin tocar tablas', async () => {
    const mock = buildSupabaseMock();
    const restore = installSupabaseMock(mock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        // Override del maybeSingle para devolver que el seguro YA EXISTE
        const originalFrom = mock.from;
        mock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            if (table === 'seguros') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { nropoliza: 'POL-TEST-001' }, error: null }) }) })
                };
            }
            return originalFrom.call(mock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock,
                baseUrl: 'http://localhost:3000'
            }),
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /póliza ya existe/);
                return true;
            }
        );

        // No se debe haber llamado a insert en ningún lado
        assert.equal(mock.__calls.segurosInsert.length, 0);
        assert.equal(mock.__calls.productosInsert.length, 0);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — campos del seguro faltantes: 400 sin tocar Supabase', async () => {
    const mock = buildSupabaseMock();
    const restore = installSupabaseMock(mock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        const payloadIncompleto = {
            descripcioncatalogo: 'Reloj',
            descripcioncompleta: 'Detalle',
            preciosugerido: 150000,
            revisor: 7,
            seguro_nropoliza: 'POL-001'
            // falta compania, importe, polizacombinada
        };

        const originalFrom = mock.from;
        mock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(mock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: payloadIncompleto,
                files: fileMock,
                baseUrl: 'http://localhost:3000'
            }),
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /seguro/);
                return true;
            }
        );

        assert.equal(mock.__calls.segurosInsert.length, 0);
        assert.equal(mock.__calls.productosInsert.length, 0);
    } finally {
        restore();
    }
});
