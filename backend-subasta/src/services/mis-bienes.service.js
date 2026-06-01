const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
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

const mapEstadoProducto = (disponible) => {
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
                preciobase: p.preciobase || null,
                comision: p.comision || null,
                motivorechazo: p.motivorechazo || null,
                fotos: []
            }))
        };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    await ensureDuenioSupabase(clienteId);

    const { data: productos, error: productosError } = await supabase
        .from('productos')
        .select('identificador, descripcioncatalogo, descripcioncompleta, disponible')
        .eq('duenio', clienteId)
        .order('identificador', { ascending: false });

    if (productosError) {
        throw new AppError('Error al obtener productos: ' + productosError.message, 500);
    }

    const productoIds = (productos || []).map((p) => p.identificador).filter(Boolean);
    let fotosMap = new Map();
    let itemsMap = new Map();

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
    }

    const productosFiltrados = (productos || []).filter((p) => {
        if (mapEstadoProducto(p.disponible) !== 'RECHAZADO') return true;
        return itemsMap.has(p.identificador);
    });

    return {
        productos: productosFiltrados.map((p) => {
            const itemData = itemsMap.get(p.identificador);
            return {
                producto_id: p.identificador,
                descripcioncatalogo: p.descripcioncatalogo || null,
                descripcioncompleta: p.descripcioncompleta || null,
                status: mapEstadoProducto(p.disponible),
                preciobase: itemData?.preciobase ?? null,
                comision: itemData?.comision ?? null,
                fotos: fotosMap.get(p.identificador) || []
            };
        })
    };
};

const crearProducto = async ({ authUser, payload, files, baseUrl }) => {
    const clienteId = isConfigured ? await resolveClienteIdSupabase(authUser) : authUser?.id;
    if (!clienteId) {
        throw new AppError('No autenticado', 401);
    }

    if (!isConfigured) {
        const productos = store.productos || [];
        const id = nextId('p', 'producto');
        const nuevo = {
            id,
            descripcioncatalogo: payload.descripcioncatalogo,
            descripcioncompleta: payload.descripcioncompleta,
            disponible: null,
            revisor: payload.revisor,
            duenio: clienteId,
            seguro: payload.seguro || null
        };
        productos.push(nuevo);
        store.productos = productos;
        return { mensaje: 'Producto creado', producto_id: id };
    }

    await ensureDuenioSupabase(clienteId);

    const descripcioncatalogo = String(payload?.descripcioncatalogo || '').trim();
    const descripcioncompleta = String(payload?.descripcioncompleta || '').trim();
    const revisorId = parseNumber(payload?.revisor);
    const seguro = payload?.seguro ? String(payload.seguro).trim() : null;
    const catalogoId = parseNumber(payload?.catalogo_id) || null;
    const subastaId = parseNumber(payload?.subasta_id) || null;
    const precioBase = parseNumber(payload?.preciobase);
    const comision = parseNumber(payload?.comision);

    if (!descripcioncatalogo || !descripcioncompleta || !revisorId || !precioBase || !comision) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (precioBase <= 0.01 || comision <= 0.01) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (!Array.isArray(files) || files.length === 0) {
        const err = new AppError('Debe subir al menos una imagen', 400);
        err.codigo = 'SIN_IMAGEN';
        throw err;
    }

    let resolvedCatalogoId = catalogoId;
    if (!resolvedCatalogoId && subastaId) {
        const { data: catalogo, error: catalogoError } = await supabase
            .from('catalogos')
            .select('identificador')
            .eq('subasta', subastaId)
            .maybeSingle();
        if (catalogoError) {
            throw new AppError('Error al obtener catálogo: ' + catalogoError.message, 500);
        }
        resolvedCatalogoId = catalogo?.identificador || null;
    }

    if (!resolvedCatalogoId) {
        const err = new AppError('Debe seleccionar una subasta válida', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    const { data: producto, error: productoError } = await supabase
        .from('productos')
        .insert({
            fecha: formatDateOnly(),
            disponible: null,
            descripcioncatalogo,
            descripcioncompleta,
            revisor: revisorId,
            duenio: clienteId,
            seguro: seguro || null
        })
        .select('identificador')
        .single();

    if (productoError) {
        throw new AppError('Error al crear producto: ' + productoError.message, 500);
    }

    const productoId = producto?.identificador;

    try {
        const { error: itemError } = await supabase
            .from('itemscatalogo')
            .insert({
                catalogo: resolvedCatalogoId,
                producto: productoId,
                preciobase: precioBase,
                comision,
                subastado: 'no'
            });

        if (itemError) {
            throw new AppError('Error al vincular producto: ' + itemError.message, 500);
        }

        const fotosPayload = files.map((file) => ({
            producto: productoId,
            foto_url: `${baseUrl}/uploads/${file.filename}`
        }));

        const { error: fotosError } = await supabase
            .from('fotos')
            .insert(fotosPayload);

        if (fotosError) {
            throw new AppError('Error al guardar fotos: ' + fotosError.message, 500);
        }
    } catch (error) {
        await supabase.from('itemscatalogo').delete().eq('producto', productoId);
        await supabase.from('fotos').delete().eq('producto', productoId);
        await supabase.from('productos').delete().eq('identificador', productoId);
        throw error;
    }

    return {
        mensaje: 'Producto enviado a revisión',
        producto_id: String(productoId)
    };
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
        const producto = productos.find((item) => String(item.id) === String(normalizedProductoId));
        if (!producto) {
            throw new AppError('Artículo no encontrado', 404);
        }
        if (String(producto.duenio) !== String(clienteId)) {
            throw new AppError('No es el propietario del artículo', 403);
        }

        const bids = (store.bids || []).filter((bid) => String(bid.item_id) === String(normalizedProductoId));
        if (bids.length) {
            throw new AppError('No se puede retirar (tiene pujas activas)', 400);
        }

        producto.disponible = 'no';
        store.productos = productos;
        return { mensaje: 'Artículo retirado de la subasta' };
    }

    await ensureDuenioSupabase(clienteId);

    const { data: producto, error: productoError } = await supabase
        .from('productos')
        .select('identificador, duenio')
        .eq('identificador', normalizedProductoId)
        .maybeSingle();

    if (productoError) {
        throw new AppError('Error al obtener producto: ' + productoError.message, 500);
    }

    if (!producto) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (String(producto.duenio) !== String(clienteId)) {
        throw new AppError('No es el propietario del artículo', 403);
    }

    const { data: itemsCatalogo, error: itemsError } = await supabase
        .from('itemscatalogo')
        .select('identificador')
        .eq('producto', normalizedProductoId);

    if (itemsError) {
        throw new AppError('Error al obtener itemscatalogo: ' + itemsError.message, 500);
    }

    const itemIds = (itemsCatalogo || []).map((item) => item.identificador).filter(Boolean);

    if (itemIds.length) {
        const { data: bids, error: bidsError } = await supabase
            .from('pujos')
            .select('identificador')
            .in('item', itemIds)
            .limit(1);

        if (bidsError) {
            throw new AppError('Error al validar pujas: ' + bidsError.message, 500);
        }

        if ((bids || []).length) {
            throw new AppError('No se puede retirar (tiene pujas activas)', 400);
        }

        const { error: deleteItemError } = await supabase
            .from('itemscatalogo')
            .delete()
            .eq('producto', normalizedProductoId);

        if (deleteItemError) {
            throw new AppError('Error al retirar artículo: ' + deleteItemError.message, 500);
        }
    }

    const { error: updateError } = await supabase
        .from('productos')
        .update({ disponible: 'no' })
        .eq('identificador', normalizedProductoId);

    if (updateError) {
        throw new AppError('Error al retirar artículo: ' + updateError.message, 500);
    }

    return { mensaje: 'Artículo retirado de la subasta' };
};

module.exports = {
    obtenerOpciones,
    obtenerSubastasPorTematica,
    listarCatalogosPorSubasta,
    listarMisBienes,
    crearProducto,
    retirarProducto
};
