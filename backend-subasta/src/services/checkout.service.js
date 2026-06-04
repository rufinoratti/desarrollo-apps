const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store } = require('./data.store');
const catalogoService = require('./catalogo.service');

const COMISION_PORCENTAJE = 0.1;
const IVA_SOBRE_COMISION = 0.21;

const calcularLiquidacion = (precioFinal) => {
    const precio = Number(precioFinal) || 0;
    const comision = Math.round(precio * COMISION_PORCENTAJE);
    const ivaComision = Math.round(comision * IVA_SOBRE_COMISION);
    const total = precio + comision + ivaComision;

    return {
        precio_final: precio,
        comision,
        comision_porcentaje: COMISION_PORCENTAJE * 100,
        iva_sobre_comision: ivaComision,
        iva_porcentaje: IVA_SOBRE_COMISION * 100,
        total_a_pagar: total
    };
};

const getHighestBidLocal = (itemId) => {
    const bids = (store.bids || []).filter((b) => String(b.item_id) === String(itemId));
    if (!bids.length) return null;
    return bids.reduce((max, b) => (Number(b.monto) > Number(max.monto) ? b : max), bids[0]);
};

const userWonItemLocal = ({ itemId, userId }) => {
    for (const subasta of store.subastas || []) {
        const item = (subasta.items || []).find((it) => String(it.id) === String(itemId));
        if (!item) continue;

        const subastaFinalizada = String(subasta.estado || '').toUpperCase() === 'FINALIZADA';
        const itemVendido = item.vendido === true;

        if (!subastaFinalizada && !itemVendido) {
            return { won: false, subasta, item };
        }

        if (item.ganador_usuario_id && String(item.ganador_usuario_id) === String(userId)) {
            return { won: true, subasta, item };
        }

        const highest = getHighestBidLocal(itemId);
        if (highest && String(highest.usuario_id) === String(userId)) {
            return { won: true, subasta, item };
        }

        return { won: false, subasta, item };
    }

    return { won: false, subasta: null, item: null };
};

const obtenerLiquidacionAdjudicacionLocal = async ({ itemId, userId }) => {
    const { won, subasta, item } = userWonItemLocal({ itemId, userId });

    if (!item) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (!won) {
        throw new AppError('No tenés adjudicación sobre este lote', 403);
    }

    const detalle = await catalogoService.obtenerDetalleItem({ itemId });
    const highest = getHighestBidLocal(itemId);
    const precioFinal = Number(item.ultima_oferta || highest?.monto || detalle.ultima_oferta || 0);
    const liquidacion = calcularLiquidacion(precioFinal);

    return {
        item_id: String(detalle.id),
        numero_lote: detalle.numero_pieza,
        titulo: detalle.descripcion,
        descripcion: detalle.descripcion_detallada || detalle.descripcion,
        imagen: detalle.imagenes?.[0] || null,
        subasta: {
            id: String(subasta?.id || detalle.subasta?.id || ''),
            titulo: subasta?.titulo || detalle.subasta?.titulo || null,
            ubicacion: subasta?.ubicacion || null,
            estado: subasta?.estado || detalle.subasta?.estado || null
        },
        estado_adjudicacion: 'ADJUDICADO',
        estado_pago: item.estado_pago || 'PENDIENTE',
        ...liquidacion
    };
};

const resolveClienteIdSupabase = async (authUser) => {
    const asNumber = Number(authUser?.id);
    if (!Number.isNaN(asNumber)) return asNumber;

    if (!authUser?.email) throw new AppError('No autenticado', 401);

    const { data: persona, error } = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', authUser.email)
        .maybeSingle();

    if (error) throw new AppError('Error al resolver usuario: ' + error.message, 500);
    if (!persona?.identificador) throw new AppError('No autenticado', 401);

    return persona.identificador;
};

const obtenerLiquidacionAdjudicacionSupabase = async ({ itemId, userId }) => {
    const itemIdNum = Number(itemId);
    if (Number.isNaN(itemIdNum)) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const clienteId = await resolveClienteIdSupabase({ id: userId, email: userId });

    const { data: topBid, error: bidError } = await supabase
        .from('pujos')
        .select('importe, asistente, ganador')
        .eq('item', itemIdNum)
        .order('importe', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (bidError) {
        throw new AppError('Error al obtener puja ganadora: ' + bidError.message, 500);
    }

    if (!topBid) {
        throw new AppError('No tenés adjudicación sobre este lote', 403);
    }

    const { data: asistente, error: asistenteError } = await supabase
        .from('asistentes')
        .select('cliente')
        .eq('identificador', topBid.asistente)
        .maybeSingle();

    if (asistenteError) {
        throw new AppError('Error al validar adjudicación: ' + asistenteError.message, 500);
    }

    if (String(asistente?.cliente) !== String(clienteId)) {
        throw new AppError('No tenés adjudicación sobre este lote', 403);
    }

    const detalle = await catalogoService.obtenerDetalleItem({ itemId });
    const precioFinal = Number(topBid.importe || detalle.ultima_oferta || 0);
    const liquidacion = calcularLiquidacion(precioFinal);

    return {
        item_id: String(detalle.id),
        numero_lote: detalle.numero_pieza,
        titulo: detalle.descripcion,
        descripcion: detalle.descripcion_detallada || detalle.descripcion,
        imagen: detalle.imagenes?.[0] || null,
        subasta: detalle.subasta
            ? {
                id: String(detalle.subasta.id || ''),
                titulo: detalle.subasta.titulo || null,
                ubicacion: null,
                estado: detalle.subasta.estado || null
            }
            : null,
        estado_adjudicacion: 'ADJUDICADO',
        estado_pago: 'PENDIENTE',
        ...liquidacion
    };
};

const obtenerLiquidacionAdjudicacion = async ({ itemId, userId }) => {
    if (!itemId) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (!isConfigured) {
        return obtenerLiquidacionAdjudicacionLocal({ itemId, userId });
    }

    try {
        return await obtenerLiquidacionAdjudicacionSupabase({ itemId, userId });
    } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 403) {
            return obtenerLiquidacionAdjudicacionLocal({ itemId, userId });
        }
        throw err;
    }
};

module.exports = {
    obtenerLiquidacionAdjudicacion,
    calcularLiquidacion
};
