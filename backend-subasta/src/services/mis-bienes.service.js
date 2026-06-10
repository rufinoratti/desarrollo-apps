const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const storage = require('../config/storage');
const { store, nextId } = require('./data.store');

const normalizeLower = (value) => String(value || '').toLowerCase().trim();

const parseNumber = (value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
};

const formatDateOnly = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const resolveClienteIdSupabase = async (authUser) => {
    const asNumber = Number(authUser?.id);
    if (!Number.isNaN(asNumber)) {
        return asNumber;
    }

    if (!authUser?.email) {
        throw new AppError('No autenticado', 401);
    }

    const queryWithEmail = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', authUser.email)
        .maybeSingle();

    if (!queryWithEmail.error) {
        if (!queryWithEmail.data?.identificador) {
            throw new AppError('No autenticado', 401);
        }
        return queryWithEmail.data.identificador;
    }

    throw new AppError('No autenticado', 401);
};

const ensureDuenioSupabase = async (clienteId) => {
    const { data, error } = await supabase
        .from('duenios')
        .select('identificador')
        .eq('identificador', clienteId)
        .maybeSingle();

    if (error) {
        throw new AppError('Error al validar dueño: ' + error.message, 500);
    }

    if (!data) {
        const err = new AppError('Debe registrarse como dueño para publicar artículos', 403);
        err.codigo = 'NO_DUENIO';
        throw err;
    }
};

const mapEstadoProducto = (disponible, confirmacionDuenio = null) => {
    if (confirmacionDuenio === 'pendiente') return 'PENDIENTE_CONFIRMACION';
    if (disponible === null || disponible === undefined) return 'EN_REVISION';
    const value = normalizeLower(disponible);
    if (value === 'si') return 'APROBADO';
    if (value === 'no') return 'RECHAZADO';
    return 'EN_REVISION';
};

const obtenerOpciones = async () => {
    if (!isConfigured) {
        return {
            revisores: [],
            seguros: [],
            categorias: store.categorias || []
        };
    }

    let revisoresData = [];
    let revisoresError = null;

    ({ data: revisoresData, error: revisoresError } = await supabase
        .from('empleados')
        .select('identificador, cargo, nombre')
        .ilike('cargo', '%revisor%'));

    if (revisoresError && /column .*nombre/i.test(revisoresError.message || '')) {
        ({ data: revisoresData, error: revisoresError } = await supabase
            .from('empleados')
            .select('identificador, cargo')
            .ilike('cargo', '%revisor%'));
    }

    if (revisoresError) {
        throw new AppError('Error al obtener revisores: ' + revisoresError.message, 500);
    }

    const { data: seguros, error: segurosError } = await supabase
        .from('seguros')
        .select('nropoliza');

    if (segurosError) {
        throw new AppError('Error al obtener seguros: ' + segurosError.message, 500);
    }

    const { data: categorias, error: categoriasError } = await supabase
        .from('categorias_tematicas')
        .select('identificador, nombre')
        .order('nombre');

    if (categoriasError) {
        throw new AppError('Error al obtener categorías: ' + categoriasError.message, 500);
    }

    return {
        revisores: (revisoresData || []).map((row) => ({
            id: row.identificador,
            nombre: row.nombre || row.cargo || `Revisor ${row.identificador}`
        })),
        seguros: (seguros || []).map((row) => ({
            id: row.nropoliza,
            nombre: `Póliza ${row.nropoliza}`
        })),
        categorias: (categorias || []).map((row) => ({
            id: row.identificador,
            nombre: row.nombre
        }))
    };
};

const obtenerSubastasPorTematica = async ({ tematica }) => {
    const tematicaId = parseNumber(tematica);
    if (!tematicaId) return [];

    if (!isConfigured) {
        const subastas = (store.subastas || []).filter((s) => Number(s.categoria_id) === tematicaId);
        return subastas.map((s) => {
            const cat = (store.catalogos || []).find((c) => String(c.subasta) === String(s.id));
            return {
                id: s.id,
                nombre: s.titulo,
                fecha: s.fecha_inicio || null,
                hora: null,
                catalogo_id: cat?.id || null
            };
        }).filter((s) => Boolean(s.catalogo_id));
    }

    const { data: subastas, error: subastasError } = await supabase
        .from('subastas')
        .select('identificador, nombre, fecha, hora, estado')
        .eq('tematica', tematicaId)
        .eq('estado', 'abierta')
        .order('fecha', { ascending: true });

    if (subastasError) {
        throw new AppError('Error al obtener subastas: ' + subastasError.message, 500);
    }

    const subastaIds = (subastas || []).map((s) => s.identificador).filter(Boolean);
    if (!subastaIds.length) return [];

    const { data: catalogos, error: catalogosError } = await supabase
        .from('catalogos')
        .select('identificador, subasta')
        .in('subasta', subastaIds);

    if (catalogosError) {
        throw new AppError('Error al obtener catálogos: ' + catalogosError.message, 500);
    }

    const catalogoMap = new Map((catalogos || []).map((c) => [c.subasta, c.identificador]));

    return (subastas || [])
        .map((s) => ({
            id: s.identificador,
            nombre: s.nombre || `Subasta #${s.identificador}`,
            fecha: s.fecha || null,
            hora: s.hora || null,
            catalogo_id: catalogoMap.get(s.identificador) || null
        }))
        .filter((s) => Boolean(s.catalogo_id));
};

const listarCatalogosPorSubasta = async ({ authUser, subastaId }) => {
    const id = parseNumber(subastaId);
    if (!id) return [];

    if (!isConfigured) {
        return (store.catalogos || []).filter((c) => Number(c.subasta) === id).map((c) => ({
            id: c.id,
            descripcion: c.descripcion || `Catálogo #${c.id}`,
            subasta: c.subasta
        }));
    }

    const { data, error } = await supabase
        .from('catalogos')
        .select('identificador, descripcion, subasta')
        .eq('subasta', id)
        .order('identificador', { ascending: true });

    if (error) {
        throw new AppError('Error al obtener catálogos: ' + error.message, 500);
    }

    return (data || []).map((c) => ({
        id: c.identificador,
        descripcion: c.descripcion,
        subasta: c.subasta
    }));
};

const listarMisBienes = async (authUser) => {
    if (!isConfigured) {
        const userId = authUser?.id;
        const productos = (store.productos || []).filter((p) => String(p.duenio) === String(userId));
        return {
            productos: productos.map((p) => ({
                producto_id: p.id,
                descripcioncatalogo: p.descripcioncatalogo || p.descripcion || null,
                descripcioncompleta: p.descripcioncompleta || null,
                status: mapEstadoProducto(p.disponible),
                preciosugerido: p.preciosugerido || null,
                motivorechazo: p.motivorechazo || null,
                fotos: []
            }))
        };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    await ensureDuenioSupabase(clienteId);

    const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('identificador, descripcioncatalogo, descripcioncompleta, disponible, preciosugerido, confirmacion_duenio, preciobase_asignado, comision_asignada, subasta_asignada')
        .eq('duenio', clienteId)
        .order('identificador', { ascending: false });

    if (productosError) {
        throw new AppError('Error al obtener productos: ' + productosError.message, 500);
    }

    const productoIds = (productos || []).map((p) => p.identificador).filter(Boolean);
    let fotosMap = new Map();
    let itemsMap = new Map();
    let subastasMap = new Map();

    if (productoIds.length) {
        const { data: fotos, error: fotosError } = await supabase
            .from('fotos')
            .select('producto, foto_url')
            .in('producto', productoIds);

        if (fotosError) {
            throw new AppError('Error al obtener fotos: ' + fotosError.message, 500);
        }

        for (const foto of fotos || []) {
            if (!fotosMap.has(foto.producto)) {
                fotosMap.set(foto.producto, []);
            }
            fotosMap.get(foto.producto).push(foto.foto_url);
        }

        const { data: items, error: itemsError } = await supabase
            .from('itemscatalogo')
            .select('producto, preciobase, comision')
            .in('producto', productoIds);

        if (!itemsError) {
            for (const item of items || []) {
                itemsMap.set(item.producto, { preciobase: item.preciobase, comision: item.comision });
            }
        }

        const subastaIds = [...new Set(
            (productos || [])
                .filter((p) => p.subasta_asignada)
                .map((p) => p.subasta_asignada)
        )];

        if (subastaIds.length) {
            const { data: subastas } = await supabase
                .from('subastas')
                .select('identificador, nombre')
                .in('identificador', subastaIds);

            for (const s of subastas || []) {
                subastasMap.set(s.identificador, s.nombre || `Subasta #${s.identificador}`);
            }
        }
    }

    const productosFiltrados = (productos || []).filter((p) => {
        const status = mapEstadoProducto(p.disponible, p.confirmacion_duenio);
        if (status !== 'RECHAZADO') return true;
        return itemsMap.has(p.identificador);
    });

    return {
        productos: productosFiltrados.map((p) => {
            const itemData = itemsMap.get(p.identificador);
            const status = mapEstadoProducto(p.disponible, p.confirmacion_duenio);
            return {
                producto_id: p.identificador,
                descripcioncatalogo: p.descripcioncatalogo || null,
                descripcioncompleta: p.descripcioncompleta || null,
                status,
                preciosugerido: p.preciosugerido ?? null,
                preciobase: itemData?.preciobase ?? p.preciobase_asignado ?? null,
                comision: itemData?.comision ?? p.comision_asignada ?? null,
                subasta_asignada: p.subasta_asignada ?? null,
                subasta_nombre: subastasMap.get(p.subasta_asignada) || null,
                confirmacion_duenio: p.confirmacion_duenio || null,
                fotos: fotosMap.get(p.identificador) || []
            };
        })
    };
};


const crearProducto = async ({ authUser, payload, files }) => {
    if (!storage.isStorageConfigured()) {
        throw new AppError('Supabase Storage no está configurado. Revisá SUPABASE_SERVICE_ROLE_KEY y SUPABASE_BUCKET_MEDIA en .env', 503);
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    if (!clienteId) {
        throw new AppError('No autenticado', 401);
    }

    await ensureDuenioSupabase(clienteId);

    const descripcioncatalogo = String(payload?.descripcioncatalogo || '').trim().slice(0, 1000);
    const descripcioncompleta = String(payload?.descripcioncompleta || '').trim().slice(0, 1000);
    const revisorId = parseNumber(payload?.revisor);
    const precioSugerido = parseNumber(payload?.preciosugerido);

    const seguroNroPoliza = String(payload?.seguro_nropoliza || '').trim();
    const seguroCompania = String(payload?.seguro_compania || '').trim();
    const seguroImporte = parseNumber(payload?.seguro_importe);
    const seguroPolizaCombinada = 'no';

    if (!descripcioncatalogo || !descripcioncompleta || !revisorId || !precioSugerido) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (precioSugerido <= 0) {
        const err = new AppError('El precio sugerido debe ser mayor a 0', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (!seguroNroPoliza || !seguroCompania || !seguroImporte || seguroImporte <= 0) {
        const err = new AppError('Datos del seguro inválidos o incompletos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (!Array.isArray(files) || files.length === 0) {
        const err = new AppError('Debe subir al menos una imagen', 400);
        err.codigo = 'SIN_IMAGEN';
        throw err;
    }

    console.log(`[mis-bienes.crearProducto] inicio seguro=${seguroNroPoliza} duenio=${clienteId} revisor=${revisorId}`);

    // 1. Verificar que el nropoliza no esté ya usado
    const { data: polizaExistente, error: polizaExistenteError } = await supabase
        .from('seguros')
        .select('nropoliza')
        .eq('nropoliza', seguroNroPoliza)
        .maybeSingle();

    if (polizaExistenteError) {
        console.error('[mis-bienes.crearProducto] Error consultando seguro existente:', polizaExistenteError);
        throw new AppError('Error al validar póliza existente: ' + polizaExistenteError.message, 500);
    }

    if (polizaExistente) {
        const err = new AppError('El número de póliza ya existe', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    // 2. Crear el seguro primero
    const { data: seguroCreado, error: seguroError } = await supabase
        .from('seguros')
        .insert({
            nropoliza: seguroNroPoliza,
            compania: seguroCompania,
            importe: seguroImporte,
            polizacombinada: seguroPolizaCombinada
        })
        .select('nropoliza')
        .single();

    if (seguroError) {
        console.error('[mis-bienes.crearProducto] Error insertando seguro:', seguroError);
        throw new AppError('Error al registrar seguro: ' + seguroError.message, 500);
    }

    if (!seguroCreado?.nropoliza) {
        console.error('[mis-bienes.crearProducto] RLS rechazó INSERT de seguro sin devolver error explícito');
        throw new AppError('No se pudo registrar el seguro (verificar policies RLS de la tabla seguros)', 500);
    }

    console.log(`[mis-bienes.crearProducto] seguro creado nropoliza=${seguroCreado.nropoliza}`);

    // 3. Crear el producto linkeado al seguro
    const { data: producto, error: productoError } = await supabase
        .from('productos')
        .insert({
            fecha: formatDateOnly(),
            disponible: null,
            descripcioncatalogo,
            descripcioncompleta,
            preciosugerido: precioSugerido,
            revisor: revisorId,
            duenio: clienteId,
            seguro: seguroNroPoliza
        })
        .select('identificador, seguro')
        .single();

    if (productoError) {
        console.error('[mis-bienes.crearProducto] Error insertando producto, haciendo rollback del seguro:', productoError);
        const { error: rollbackError } = await supabase
            .from('seguros')
            .delete()
            .eq('nropoliza', seguroNroPoliza);
        if (rollbackError) {
            console.error('[mis-bienes.crearProducto] Error en rollback del seguro:', rollbackError);
        }
        throw new AppError('Error al crear producto: ' + productoError.message, 500);
    }

    if (!producto?.seguro) {
        console.error(`[mis-bienes.crearProducto] ALERTA: producto ${producto?.identificador} creado pero sin seguro linkeado. Esperado: ${seguroNroPoliza}, recibido: ${producto?.seguro}`);
    }

    const productoId = producto?.identificador;
    console.log(`[mis-bienes.crearProducto] producto creado id=${productoId} seguro=${producto?.seguro}`);

    // 4. Subir las fotos a Supabase Storage (secuencial para tracking correcto
    //    en caso de rollback; hasta 6 fotos, performance aceptable para MVP).
    const urlsSubidas = [];
    try {
        for (const file of files) {
            const url = await storage.uploadBuffer({
                folder: 'productos',
                fieldname: file.fieldname,
                buffer: file.buffer,
                mimetype: file.mimetype,
                originalname: file.originalname
            });
            urlsSubidas.push(url);
        }

        const fotosPayload = urlsSubidas.map((url) => ({
            producto: productoId,
            foto_url: url
        }));

        const { error: fotosError } = await supabase
            .from('fotos')
            .insert(fotosPayload);

        if (fotosError) {
            throw new AppError('Error al guardar fotos: ' + fotosError.message, 500);
        }
    } catch (error) {
        console.error('[mis-bienes.crearProducto] Error guardando fotos, haciendo rollback completo:', error);
        // Rollback de Storage: borrar las URLs que se subieron antes del fallo
        if (urlsSubidas.length > 0) {
            await Promise.all(urlsSubidas.map((u) => storage.remove(u).catch(() => {})));
        }
        // Rollback de BD: borrar registros en orden inverso al insert
        await supabase.from('fotos').delete().eq('producto', productoId);
        await supabase.from('productos').delete().eq('identificador', productoId);
        await supabase.from('seguros').delete().eq('nropoliza', seguroNroPoliza);
        throw error;
    }

    return {
        mensaje: 'Producto enviado a revisión',
        producto_id: String(productoId)
    };
};


const confirmarProducto = async ({ authUser, productoId, accion }) => {
    const clienteId = await resolveClienteIdSupabase(authUser);
    if (!clienteId) {
        throw new AppError('No autenticado', 401);
    }

    await ensureDuenioSupabase(clienteId);

    const normalizedId = parseNumber(productoId) ?? String(productoId || '').trim();
    if (!normalizedId) {
        throw new AppError('Producto no encontrado', 404);
    }

    if (!['aceptar', 'rechazar'].includes(accion)) {
        const err = new AppError('Acción inválida. Use "aceptar" o "rechazar"', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (isConfigured) {
        const { data: producto, error: prodError } = await supabase
            .from('productos')
            .select('identificador, duenio, disponible, confirmacion_duenio, preciobase_asignado, comision_asignada, subasta_asignada')
            .eq('identificador', normalizedId)
            .maybeSingle();

        if (prodError) throw new AppError('Error al obtener producto: ' + prodError.message, 500);
        if (!producto) throw new AppError('Producto no encontrado', 404);
        if (String(producto.duenio) !== String(clienteId)) throw new AppError('No es el propietario del artículo', 403);
        if (producto.confirmacion_duenio !== 'pendiente') throw new AppError('Este producto no está pendiente de confirmación', 400);

        if (accion === 'aceptar') {
            const { data: catalogoRow } = await supabase
                .from('catalogos')
                .select('identificador')
                .eq('subasta', producto.subasta_asignada)
                .maybeSingle();

            if (!catalogoRow) throw new AppError('La subasta asignada ya no tiene un catálogo asociado', 400);

            const { error: insertItemError } = await supabase
                .from('itemscatalogo')
                .insert({
                    catalogo: catalogoRow.identificador,
                    producto: producto.identificador,
                    preciobase: producto.preciobase_asignado,
                    comision: producto.comision_asignada,
                    subastado: 'no'
                });

            if (insertItemError) throw new AppError('Error al crear ítem de catálogo: ' + insertItemError.message, 500);

            const { error: updateError } = await supabase
                .from('productos')
                .update({
                    disponible: 'si',
                    confirmacion_duenio: 'aceptado'
                })
                .eq('identificador', producto.identificador);

            if (updateError) throw new AppError('Error al actualizar producto: ' + updateError.message, 500);

            return {
                mensaje: 'Producto aceptado y publicado en la subasta',
                producto_id: String(producto.identificador),
                status: 'APROBADO'
            };
        } else {
            const { error: updateError } = await supabase
                .from('productos')
                .update({
                    disponible: 'no',
                    confirmacion_duenio: 'rechazado'
                })
                .eq('identificador', producto.identificador);

            if (updateError) throw new AppError('Error al actualizar producto: ' + updateError.message, 500);

            return {
                mensaje: 'Has rechazado la cotización. El producto no se publicará.',
                producto_id: String(producto.identificador),
                status: 'RECHAZADO'
            };
        }
    }

    const productos = store.productos || [];
    const producto = productos.find((p) => String(p.id) === String(normalizedId));
    if (!producto) throw new AppError('Producto no encontrado', 404);
    if (String(producto.duenio) !== String(clienteId)) throw new AppError('No es el propietario del artículo', 403);
    if (producto.confirmacion_duenio !== 'pendiente') throw new AppError('Este producto no está pendiente de confirmación', 400);

    if (accion === 'aceptar') {
        const catalogos = store.catalogos || [];
        const catalogo = catalogos.find((c) => Number(c.subasta) === Number(producto.subasta_asignada));
        if (!catalogo) throw new AppError('La subasta asignada ya no tiene un catálogo asociado', 400);

        const items = store.itemscatalogo || [];
        items.push({
            id: nextId('i', 'item'),
            catalogo: catalogo.id,
            producto: producto.identificador || producto.id,
            preciobase: producto.preciobase_asignado,
            comision: producto.comision_asignada,
            subastado: 'no'
        });
        store.itemscatalogo = items;

        producto.disponible = 'si';
        producto.confirmacion_duenio = 'aceptado';

        return {
            mensaje: 'Producto aceptado y publicado en la subasta',
            producto_id: String(producto.id || producto.identificador),
            status: 'APROBADO'
        };
    } else {
        producto.disponible = 'no';
        producto.confirmacion_duenio = 'rechazado';

        return {
            mensaje: 'Has rechazado la cotización. El producto no se publicará.',
            producto_id: String(producto.id || producto.identificador),
            status: 'RECHAZADO'
        };
    }
};

const retirarProducto = async ({ authUser, productoId }) => {
    const clienteId = isConfigured ? await resolveClienteIdSupabase(authUser) : authUser?.id;
    if (!clienteId) {
        throw new AppError('No autenticado', 401);
    }

    const normalizedProductoId = parseNumber(productoId) ?? String(productoId || '').trim();
    if (!normalizedProductoId) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (!isConfigured) {
        const productos = store.productos || [];
        const idx = productos.findIndex((item) => String(item.id) === String(normalizedProductoId));
        if (idx === -1) throw new AppError('Artículo no encontrado', 404);
        if (String(productos[idx].duenio) !== String(clienteId)) throw new AppError('No es el propietario del artículo', 403);

        const bids = (store.bids || []).filter((bid) => String(bid.item_id) === String(normalizedProductoId));
        if (bids.length) throw new AppError('No se puede retirar (tiene pujas activas)', 400);

        productos.splice(idx, 1);
        store.productos = productos;
        return { mensaje: 'Producto eliminado permanentemente', eliminado: true };
    }

    await ensureDuenioSupabase(clienteId);

    const { data: producto, error: productoError } = await supabase
        .from('productos')
        .select('identificador, duenio, seguro')
        .eq('identificador', normalizedProductoId)
        .maybeSingle();

    if (productoError) throw new AppError('Error al obtener producto: ' + productoError.message, 500);
    if (!producto) throw new AppError('Artículo no encontrado', 404);
    if (String(producto.duenio) !== String(clienteId)) throw new AppError('No es el propietario del artículo', 403);

    const seguroId = producto.seguro;

    const { data: itemsCatalogo, error: itemsError } = await supabase
        .from('itemscatalogo')
        .select('identificador')
        .eq('producto', normalizedProductoId);

    if (itemsError) throw new AppError('Error al obtener itemscatalogo: ' + itemsError.message, 500);

    const itemIds = (itemsCatalogo || []).map((item) => item.identificador).filter(Boolean);

    if (itemIds.length) {
        const { data: bids, error: bidsError } = await supabase
            .from('pujos')
            .select('identificador')
            .in('item', itemIds)
            .limit(1);

        if (bidsError) throw new AppError('Error al validar pujas: ' + bidsError.message, 500);
        if ((bids || []).length) throw new AppError('No se puede retirar (tiene pujas activas)', 400);

        await supabase.from('itemscatalogo').delete().eq('producto', normalizedProductoId);
    }

    // Eliminar fotos de Storage + BD
    const { data: fotosExistentes } = await supabase
        .from('fotos')
        .select('foto_url')
        .eq('producto', normalizedProductoId);

    if (fotosExistentes?.length) {
        await Promise.all(fotosExistentes.map((f) => storage.remove(f.foto_url).catch(() => {})));
    }
    await supabase.from('fotos').delete().eq('producto', normalizedProductoId);

    // Eliminar producto
    await supabase.from('productos').delete().eq('identificador', normalizedProductoId);

    // Eliminar seguro asociado
    if (seguroId) {
        await supabase.from('seguros').delete().eq('nropoliza', seguroId).catch(() => {});
    }

    return { mensaje: 'Producto eliminado permanentemente', eliminado: true };
};

module.exports = {
    obtenerOpciones,
    obtenerSubastasPorTematica,
    listarCatalogosPorSubasta,
    listarMisBienes,
    crearProducto,
    confirmarProducto,
    retirarProducto
};
