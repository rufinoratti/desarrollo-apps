const AppError = require('../utils/appError');
const catalogoService = require('./catalogo.service');
const pujasService = require('./pujas.service');

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

const obtenerLiquidacionAdjudicacion = async ({ itemId, authUser }) => {
    if (!itemId) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const { items } = await pujasService.obtenerPujasGanadas({ authUser });
    const ganado = (items || []).find((g) => String(g.item_id) === String(itemId));

    if (!ganado) {
        throw new AppError('No tenés adjudicación sobre este lote', 403);
    }

    const detalle = await catalogoService.obtenerDetalleItem({ itemId });
    const precioFinal = Number(ganado.monto_ganador || detalle.ultima_oferta || 0);
    const liquidacion = calcularLiquidacion(precioFinal);

    const subastaId = detalle.subasta?.id || detalle.subasta?.identificador || null;
    const ubicacion = detalle.subasta?.ubicacion || null;

    return {
        item_id: String(detalle.id),
        numero_lote: detalle.numero_pieza || String(detalle.id),
        titulo: detalle.descripcion,
        descripcion: detalle.descripcion_detallada || detalle.descripcion,
        imagen: ganado.imagen || detalle.imagenes?.[0] || null,
        subasta: detalle.subasta
            ? {
                id: String(subastaId || ''),
                titulo: detalle.subasta.titulo || null,
                ubicacion,
                estado: detalle.subasta.estado || null
            }
            : null,
        estado_adjudicacion: 'ADJUDICADO',
        estado_pago: 'PENDIENTE',
        ...liquidacion
    };
};

module.exports = {
    obtenerLiquidacionAdjudicacion,
    calcularLiquidacion
};
