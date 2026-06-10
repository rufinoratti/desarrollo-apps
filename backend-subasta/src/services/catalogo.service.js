const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store, CATEGORY_RANK } = require('./data.store');
const {
    calcularEstadoSubastaDisplay,
    calcularFechasIso
} = require('../utils/estadoSubasta');

const normalizeText = (v = '') => String(v).toLowerCase().trim();

const sortArticulos = (articulos = [], orden = 'lote_numero') => {
    const list = [...articulos];

    if (orden === 'precio_asc') {
        return list.sort((a, b) => Number(a.precio_base || 0) - Number(b.precio_base || 0));
    }

    if (orden === 'precio_desc') {
        return list.sort((a, b) => Number(b.precio_base || 0) - Number(a.precio_base || 0));
    }

    if (orden === 'tiempo_asc') {
        return list.sort((a, b) => new Date(a.tiempo_referencia || 0) - new Date(b.tiempo_referencia || 0));
    }

    return list.sort((a, b) => String(a.numero_lote || '').localeCompare(String(b.numero_lote || '')));
};

const estadoSubastaDbToApi = (row) => calcularEstadoSubastaDisplay(row);

const parseItemIdForDb = (itemId) => {
    const numeric = Number(itemId);
    return Number.isNaN(numeric) ? null : numeric;
};

const mapArticuloResumenLocal = (item) => ({
    id: item.id,
    numero_lote: item.numero_pieza,
    titulo: item.descripcion,
    precio_base: item.precio_base,
    imagen_principal: item.imagenes?.[0] || null,
    estado: item.vendido ? 'VENDIDO' : 'DISPONIBLE',
    tiempo_referencia: new Date().toISOString()
});

const obtenerCatalogoPorSubastaLocal = ({ subastaId, q, orden, usuario }) => {
    const subasta = (store.subastas || []).find((s) => String(s.id) === String(subastaId));
    if (!subasta) {
        throw new AppError('Subasta no encontrada', 404);
    }

    const rankUsuario = CATEGORY_RANK[String(usuario?.categoria || '').toLowerCase()] || 1;
    const rankSubasta = CATEGORY_RANK[String(subasta.nivel_acceso || '').toLowerCase()] || 1;
    if (rankUsuario < rankSubasta) {
        throw new AppError('Nivel insuficiente para acceder a esta subasta', 403);
    }

    let articulos = (subasta.items || []).map(mapArticuloResumenLocal);

    if (q) {
        const query = normalizeText(q);
        articulos = articulos.filter((a) => normalizeText(a.titulo).includes(query));
    }

    articulos = sortArticulos(articulos, orden);

    let fechaInicio = subasta.fecha_inicio || null;
    let fechaFin = subasta.fecha_fin || null;
    if (!fechaFin && fechaInicio) {
        fechaFin = new Date(new Date(fechaInicio).getTime() + 3600 * 1000).toISOString();
    }

    return {
        subasta_info: {
            id: String(subasta.id),
            titulo: subasta.titulo,
            estado: subasta.estado,
            nivel_acceso: subasta.nivel_acceso || subasta.categoria || null,
            imagen_portada: subasta.imagen_portada || subasta.imagen || null,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin
        },
        articulos: articulos.map(({ tiempo_referencia, ...articulo }) => articulo),
        total_articulos: articulos.length
    };
};

const obtenerCatalogoPorSubastaSupabase = async ({ subastaId, q, orden, usuario }) => {
    const subastaIdNum = Number(subastaId);
    if (Number.isNaN(subastaIdNum)) {
        throw new AppError('Subasta no encontrada', 404);
    }

    const { data: subasta, error: subastaError } = await supabase
        .from('subastas')
        .select('identificador, estado, ubicacion, categoria, nombre, imagen, fecha, hora')
        .eq('identificador', subastaIdNum)
        .maybeSingle();

    if (subastaError) {
        throw new AppError('Error al obtener subasta: ' + subastaError.message, 500);
    }

    if (!subasta) {
        throw new AppError('Subasta no encontrada', 404);
    }

    const rankUsuario = CATEGORY_RANK[String(usuario?.categoria || '').toLowerCase()] || 1;
    const rankSubasta = CATEGORY_RANK[String(subasta.categoria || '').toLowerCase()] || 1;
    if (rankUsuario < rankSubasta) {
        throw new AppError('Nivel insuficiente para acceder a esta subasta', 403);
    }

    const { data: catalogo, error: catalogoError } = await supabase
        .from('catalogos')
        .select('identificador, descripcion')
        .eq('subasta', subastaIdNum)
        .maybeSingle();

    if (catalogoError) {
        throw new AppError('Error al obtener catálogo: ' + catalogoError.message, 500);
    }

    if (!catalogo) {
        return {
            subasta_info: {
                id: String(subasta.identificador),
                titulo: catalogo?.descripcion || `Subasta #${subasta.identificador}`,
                estado: estadoSubastaDbToApi(subasta),
                nivel_acceso: subasta.categoria || null,
                imagen_portada: subasta.imagen || null
            },
            articulos: [],
            total_articulos: 0
        };
    }

    const { data: items, error: itemsError } = await supabase
        .from('itemscatalogo')
        .select('identificador, producto, preciobase, subastado')
        .eq('catalogo', catalogo.identificador)
        .order('identificador', { ascending: true });

    if (itemsError) {
        throw new AppError('Error al obtener ítems del catálogo: ' + itemsError.message, 500);
    }

    const productIds = [...new Set((items || []).map((it) => it.producto))];
    let productsMap = new Map();
    let photosMap = new Map();

    if (productIds.length) {
        const { data: products, error: productsError } = await supabase
            .from('productos')
            .select('identificador, descripcioncatalogo, descripcioncompleta, duenio, disponible')
            .in('identificador', productIds)
            .eq('disponible', 'si');

        if (productsError) {
            throw new AppError('Error al obtener productos: ' + productsError.message, 500);
        }

        productsMap = new Map((products || []).map((p) => [p.identificador, p]));

        const { data: photos, error: photosError } = await supabase
            .from('fotos')
            .select('producto, foto_url')
            .in('producto', productIds);

        if (photosError) {
            throw new AppError('Error al obtener fotos: ' + photosError.message, 500);
        }

        for (const ph of photos || []) {
            if (!photosMap.has(ph.producto)) {
                photosMap.set(ph.producto, []);
            }
            photosMap.get(ph.producto).push(ph.foto_url);
        }
    }

    let articulos = (items || []).map((it) => {
        const product = productsMap.get(it.producto);
        if (!product) return null;
        const photos = photosMap.get(it.producto) || [];

        return {
            id: String(it.identificador),
            numero_lote: String(it.identificador),
            titulo: product?.descripcioncatalogo || `Ítem #${it.identificador}`,
            precio_base: Number(it.preciobase || 0),
            imagen_principal: photos[0] || null,
            estado: it.subastado === 'si' ? 'VENDIDO' : 'DISPONIBLE',
            tiempo_referencia: new Date().toISOString()
        };
    }).filter(Boolean);

    if (q) {
        const query = normalizeText(q);
        articulos = articulos.filter((a) => normalizeText(a.titulo).includes(query));
    }

    articulos = sortArticulos(articulos, orden);

    const fechaInicioSub = subasta.fecha && subasta.hora ? `${subasta.fecha}T${subasta.hora}` : null;
    const { fecha_inicio_iso, fecha_fin_iso } = calcularFechasIso(subasta);

    return {
        subasta_info: {
            id: String(subasta.identificador),
            titulo: catalogo.descripcion || `Subasta #${subasta.identificador}`,
            estado: estadoSubastaDbToApi(subasta),
            nivel_acceso: subasta.categoria || null,
            imagen_portada: subasta.imagen || null,
            fecha_inicio: fechaInicioSub,
            fecha_fin: fecha_fin_iso,
            fecha_inicio_iso,
            fecha_fin_iso
        },
        articulos: articulos.map(({ tiempo_referencia, ...articulo }) => articulo),
        total_articulos: articulos.length
    };
};

const obtenerCatalogoPorSubasta = async ({ subastaId, q, orden, usuario }) => {
    if (!subastaId) {
        throw new AppError('Subasta no encontrada', 404);
    }

    if (!isConfigured) {
        return obtenerCatalogoPorSubastaLocal({ subastaId, q, orden, usuario });
    }

    try {
        return await obtenerCatalogoPorSubastaSupabase({ subastaId, q, orden, usuario });
    } catch (err) {
        if (err.statusCode === 404) {
            return obtenerCatalogoPorSubastaLocal({ subastaId, q, orden, usuario });
        }
        throw err;
    }
};

const obtenerDetalleItemLocal = ({ itemId, usuario }) => {
    for (const subasta of store.subastas || []) {
        const item = (subasta.items || []).find((it) => String(it.id) === String(itemId));
        if (item) {
            const rankUsuario = CATEGORY_RANK[String(usuario?.categoria || '').toLowerCase()] || 1;
            const rankSubasta = CATEGORY_RANK[String(subasta.nivel_acceso || '').toLowerCase()] || 1;
            if (rankUsuario < rankSubasta) {
                throw new AppError('Nivel insuficiente para acceder a esta subasta', 403);
            }
            const tiempoRestante = subasta.fecha_fin
                ? Math.max(0, Math.floor((new Date(subasta.fecha_fin).getTime() - Date.now()) / 1000))
                : null;

            return {
                id: item.id,
                numero_pieza: item.numero_pieza,
                descripcion: item.descripcion,
                descripcion_detallada: item.descripcion_detallada || item.descripcion,
                precio_base: item.precio_base,
                ultima_oferta: item.ultima_oferta || 0,
                estado: item.vendido ? 'VENDIDO' : 'DISPONIBLE',
                imagenes: item.imagenes || [],
                ficha_tecnica: item.ficha_tecnica || null,
                duenio_nombre: item.duenio_nombre || null,
                historial_propietarios: [],
                subasta: {
                    id: subasta.id,
                    titulo: subasta.titulo,
                    estado: subasta.estado,
                    fecha_fin: subasta.fecha_fin || null
                },
                tiempo_restante_segundos: tiempoRestante
            };
        }
    }

    throw new AppError('Artículo no encontrado', 404);
};

const obtenerDetalleItemSupabase = async ({ itemId, usuario }) => {
    const itemIdNum = parseItemIdForDb(itemId);
    if (itemIdNum === null) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const { data: item, error: itemError } = await supabase
        .from('itemscatalogo')
        .select('identificador, producto, preciobase, subastado, catalogo')
        .eq('identificador', itemIdNum)
        .maybeSingle();

    if (itemError) {
        throw new AppError('Error al obtener artículo: ' + itemError.message, 500);
    }

    if (!item) {
        throw new AppError('Artículo no encontrado', 404);
    }

    let product, productError;
    ({ data: product, error: productError } = await supabase
        .from('productos')
        .select('identificador, descripcioncatalogo, descripcioncompleta, duenio, disponible')
        .eq('identificador', item.producto)
        .eq('disponible', 'si')
        .maybeSingle());

    if (productError) {
        throw new AppError('Error al obtener producto: ' + productError.message, 500);
    }

    if (!product) {
        throw new AppError('Artículo no encontrado', 404);
    }

    let duenioNombre = null;
    if (product?.duenio) {
        const duenioId = Number(product.duenio);
        if (!Number.isNaN(duenioId)) {
            const { data: duenioData, error: duenioError } = await supabase
                .from('duenios')
                .select('nombre')
                .eq('identificador', duenioId)
                .maybeSingle();
            if (!duenioError && duenioData) {
                duenioNombre = duenioData.nombre || null;
            }
        }
    }

    const { data: photos, error: photosError } = await supabase
        .from('fotos')
        .select('foto_url')
        .eq('producto', item.producto);

    if (photosError) {
        throw new AppError('Error al obtener fotos: ' + photosError.message, 500);
    }

    const { data: bidRow } = await supabase
        .from('pujos')
        .select('importe')
        .eq('item', item.identificador)
        .order('importe', { ascending: false })
        .limit(1)
        .maybeSingle();

    const { data: catalogo, error: catalogoError } = await supabase
        .from('catalogos')
        .select('subasta')
        .eq('identificador', item.catalogo)
        .maybeSingle();

    if (catalogoError) {
        throw new AppError('Error al obtener catálogo: ' + catalogoError.message, 500);
    }

    let tiempoRestante = null;
    let subastaInfo = null;
    if (catalogo?.subasta) {
        let subasta, subastaError;
        ({ data: subasta, error: subastaError } = await supabase
            .from('subastas')
            .select('identificador, estado, fecha_cierre, fecha, hora, categoria')
            .eq('identificador', catalogo.subasta)
            .maybeSingle());

        if (subastaError && /column .*fecha_cierre/i.test(subastaError.message || '')) {
            ({ data: subasta } = await supabase
                .from('subastas')
                .select('identificador, estado, fecha, hora, categoria')
                .eq('identificador', catalogo.subasta)
                .maybeSingle());
        } else if (subastaError) {
            throw new AppError('Error al obtener subasta: ' + subastaError.message, 500);
        }

        if (subasta) {
            const rankUsuario = CATEGORY_RANK[String(usuario?.categoria || '').toLowerCase()] || 1;
            const rankSubasta = CATEGORY_RANK[String(subasta.categoria || '').toLowerCase()] || 1;
            if (rankUsuario < rankSubasta) {
                throw new AppError('Nivel insuficiente para acceder a esta subasta', 403);
            }

            const { fecha_inicio_iso, fecha_fin_iso } = calcularFechasIso(subasta);
            subastaInfo = {
                id: String(subasta.identificador),
                estado: estadoSubastaDbToApi(subasta),
                fecha_cierre: (subasta).fecha_cierre || null,
                fecha_inicio_iso,
                fecha_fin_iso
            };

            if ((subasta).fecha_cierre) {
                tiempoRestante = Math.max(0, Math.floor(
                    (new Date((subasta).fecha_cierre).getTime() - Date.now()) / 1000
                ));
            }
        }
    }

    return {
        id: String(item.identificador),
        numero_pieza: String(item.identificador),
        descripcion: product?.descripcioncatalogo || `Ítem #${item.identificador}`,
        descripcion_detallada: product?.descripcioncompleta || null,
        precio_base: Number(item.preciobase || 0),
        ultima_oferta: Number(bidRow?.importe || 0),
        estado: item.subastado === 'si' ? 'VENDIDO' : 'DISPONIBLE',
        imagenes: (photos || []).map((ph) => ph.foto_url),
        ficha_tecnica: null,
        duenio_nombre: duenioNombre,
        historial_propietarios: product?.duenio ? [String(product.duenio)] : [],
        subasta: subastaInfo,
        tiempo_restante_segundos: tiempoRestante
    };
};

const obtenerDetalleItem = async ({ itemId, usuario }) => {
    if (!itemId) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (!isConfigured) {
        return obtenerDetalleItemLocal({ itemId, usuario });
    }

    try {
        return await obtenerDetalleItemSupabase({ itemId, usuario });
    } catch (err) {
        if (err.statusCode === 404) {
            return obtenerDetalleItemLocal({ itemId, usuario });
        }
        throw err;
    }
};

module.exports = {
    obtenerCatalogoPorSubasta,
    obtenerDetalleItem
};
