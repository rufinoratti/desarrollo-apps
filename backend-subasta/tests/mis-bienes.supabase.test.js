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

/**
 * Mock de archivos en formato multer memoryStorage: cada file tiene
 * fieldname, originalname, mimetype y buffer. La service ya no
 * necesita filename (eso era del diskStorage).
 */
const fileMock = [
    { fieldname: 'fotos', originalname: 'foto-1.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
    { fieldname: 'fotos', originalname: 'foto-2.jpg', mimetype: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }
];
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
 * Mock programable de Supabase Storage. Devuelve URLs fake estables
 * para que las aserciones no se rompan por timestamps variables.
 */
function buildStorageMock() {
    const calls = { upload: [], remove: [] };
    let counter = 0;
    return {
        BUCKET: 'rematix-media',
        isStorageConfigured: () => true,
        uploadBuffer: async ({ folder, fieldname, buffer, mimetype, originalname }) => {
            counter++;
            const url = `https://test.supabase.co/storage/v1/object/public/rematix-media/${folder}/mock-${counter}.jpg`;
            calls.upload.push({ folder, fieldname, bufferLength: buffer?.length, mimetype, originalname, url });
            return url;
        },
        getPublicUrl: (path) => `https://test.supabase.co/storage/v1/object/public/rematix-media/${path}`,
        remove: async (urlOrPath) => {
            calls.remove.push({ urlOrPath });
        },
        extractPathFromUrl: (url) => {
            if (!url) return null;
            const marker = '/storage/v1/object/public/rematix-media/';
            const idx = url.indexOf(marker);
            return idx === -1 ? null : url.substring(idx + marker.length);
        },
        getFolderFromPath: (p) => p ? p.split('/')[0] : null,
        __calls: calls
    };
}

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
 * Helper para interceptar `require('../src/config/supabase')` y
 * `require('../src/config/storage')` y devolver nuestros mocks.
 */
function installMocks(supabaseMock, storageMock) {
    const original = Module.prototype.require;
    Module.prototype.require = function patched(id) {
        if (id === '../config/supabase' || id.endsWith('/config/supabase')) {
            return { supabase: supabaseMock, supabaseAdmin: null, isConfigured: true, isAdminConfigured: false };
        }
        if (id === '../config/storage' || id.endsWith('/config/storage')) {
            return storageMock;
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

test('crearProducto (Supabase) — camino feliz: crea seguro, producto linkeado y fotos con URLs de Storage', async () => {
    const supabaseMock = buildSupabaseMock();
    const storageMock = buildStorageMock();
    const restore = installMocks(supabaseMock, storageMock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        supabaseMock.__queue.push({ type: 'productos.single', response: { data: { identificador: 999, seguro: 'POL-TEST-001' }, error: null } });

        // Mock duenios
        const originalFrom = supabaseMock.from;
        supabaseMock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(supabaseMock, table);
        };

        const result = await service.crearProducto({
            authUser,
            payload: validPayload,
            files: fileMock
        });

        assert.equal(result.mensaje, 'Producto enviado a revisión');
        assert.equal(result.producto_id, '999');

        // Seguro insertado con los datos correctos
        assert.equal(supabaseMock.__calls.segurosInsert.length, 1);
        assert.equal(supabaseMock.__calls.segurosInsert[0].nropoliza, 'POL-TEST-001');
        assert.equal(supabaseMock.__calls.segurosInsert[0].compania, 'Mapfre');
        assert.equal(supabaseMock.__calls.segurosInsert[0].importe, 500000);
        assert.equal(supabaseMock.__calls.segurosInsert[0].polizacombinada, 'no');

        // Producto insertado con link al seguro
        assert.equal(supabaseMock.__calls.productosInsert.length, 1);
        assert.equal(supabaseMock.__calls.productosInsert[0].seguro, 'POL-TEST-001');

        // Storage subió 2 fotos a carpeta 'productos'
        assert.equal(storageMock.__calls.upload.length, 2);
        assert.equal(storageMock.__calls.upload[0].folder, 'productos');
        assert.equal(storageMock.__calls.upload[1].folder, 'productos');

        // 2 fotos insertadas con URLs de Storage (no filenames)
        assert.equal(supabaseMock.__calls.fotosInsert.length, 1);
        assert.equal(supabaseMock.__calls.fotosInsert[0].length, 2);
        assert.match(supabaseMock.__calls.fotosInsert[0][0].foto_url, /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/rematix-media\/productos\/mock-\d+\.jpg$/);
        assert.match(supabaseMock.__calls.fotosInsert[0][1].foto_url, /^https:\/\/test\.supabase\.co\/storage\/v1\/object\/public\/rematix-media\/productos\/mock-\d+\.jpg$/);

        // Cada foto referencia el producto creado
        assert.equal(supabaseMock.__calls.fotosInsert[0][0].producto, 999);
        assert.equal(supabaseMock.__calls.fotosInsert[0][1].producto, 999);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — RLS rechaza INSERT de seguro en silencio: tira error y NO crea producto', async () => {
    const supabaseMock = buildSupabaseMock();
    const storageMock = buildStorageMock();
    const restore = installMocks(supabaseMock, storageMock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        supabaseMock.__queue.push({ type: 'seguros.single', response: { data: null, error: null } });

        const originalFrom = supabaseMock.from;
        supabaseMock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(supabaseMock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock
            }),
            (err) => {
                assert.equal(err.statusCode, 500);
                assert.match(err.message, /policies RLS|seguro/);
                return true;
            }
        );

        assert.equal(supabaseMock.__calls.productosInsert.length, 0);
        assert.equal(supabaseMock.__calls.fotosInsert.length, 0);
        // Como el seguro falló ANTES de subir fotos, no hubo uploads a Storage
        assert.equal(storageMock.__calls.upload.length, 0);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — error al insertar producto: rollback del seguro', async () => {
    const supabaseMock = buildSupabaseMock();
    const storageMock = buildStorageMock();
    const restore = installMocks(supabaseMock, storageMock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        supabaseMock.__queue.push({ type: 'seguros.single', response: { data: { nropoliza: 'POL-TEST-001' }, error: null } });
        supabaseMock.__queue.push({ type: 'productos.single', response: { data: null, error: { message: 'foreign key violation' } } });

        const originalFrom = supabaseMock.from;
        supabaseMock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(supabaseMock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock
            }),
            (err) => {
                assert.equal(err.statusCode, 500);
                assert.match(err.message, /foreign key violation/);
                return true;
            }
        );

        // El seguro debe haberse borrado en el rollback
        assert.equal(supabaseMock.__calls.segurosDelete.length, 1);
        // No se subieron fotos a Storage porque el producto falló antes
        assert.equal(storageMock.__calls.upload.length, 0);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — nropoliza duplicado: 400 sin tocar tablas', async () => {
    const supabaseMock = buildSupabaseMock();
    const storageMock = buildStorageMock();
    const restore = installMocks(supabaseMock, storageMock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        const originalFrom = supabaseMock.from;
        supabaseMock.from = (table) => {
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
            return originalFrom.call(supabaseMock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: validPayload,
                files: fileMock
            }),
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /póliza ya existe/);
                return true;
            }
        );

        assert.equal(supabaseMock.__calls.segurosInsert.length, 0);
        assert.equal(supabaseMock.__calls.productosInsert.length, 0);
        // No se subió nada a Storage
        assert.equal(storageMock.__calls.upload.length, 0);
    } finally {
        restore();
    }
});

test('crearProducto (Supabase) — campos del seguro faltantes: 400 sin tocar Supabase', async () => {
    const supabaseMock = buildSupabaseMock();
    const storageMock = buildStorageMock();
    const restore = installMocks(supabaseMock, storageMock);

    try {
        delete require.cache[require.resolve('../src/services/mis-bienes.service')];
        const service = require('../src/services/mis-bienes.service');

        const payloadIncompleto = {
            descripcioncatalogo: 'Reloj',
            descripcioncompleta: 'Detalle',
            preciosugerido: 150000,
            revisor: 7,
            seguro_nropoliza: 'POL-001'
        };

        const originalFrom = supabaseMock.from;
        supabaseMock.from = (table) => {
            if (table === 'duenios') {
                return {
                    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { identificador: 1 }, error: null }) }) })
                };
            }
            return originalFrom.call(supabaseMock, table);
        };

        await assert.rejects(
            () => service.crearProducto({
                authUser,
                payload: payloadIncompleto,
                files: fileMock
            }),
            (err) => {
                assert.equal(err.statusCode, 400);
                assert.match(err.message, /seguro/);
                return true;
            }
        );

        assert.equal(supabaseMock.__calls.segurosInsert.length, 0);
        assert.equal(supabaseMock.__calls.productosInsert.length, 0);
    } finally {
        restore();
    }
});
