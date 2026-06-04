const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store } = require('./data.store');

const formatFechaTexto = (isoDate) => {
    if (!isoDate) return 'Reciente';
    const diffMs = Date.now() - new Date(isoDate).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} hora${diffH === 1 ? '' : 's'}`;
    const diffD = Math.floor(diffH / 24);
    return `Hace ${diffD} día${diffD === 1 ? '' : 's'}`;
};

const getHighestBidLocal = (itemId) => {
    const bids = (store.bids || []).filter((b) => String(b.item_id) === String(itemId));
    if (!bids.length) return null;
    return bids.reduce((max, b) => (Number(b.monto) > Number(max.monto) ? b : max), bids[0]);
};

const buildNotificacion = ({
    id,
    tipo,
    itemId,
    titulo,
    monto,
    etiqueta,
    fecha,
    leida = false
}) => ({
    id_evento: id,
    tipo_evento: tipo,
    item_id: itemId ? String(itemId) : null,
    titulo_lote: titulo,
    fecha_texto: formatFechaTexto(fecha),
    monto: monto ?? null,
    etiqueta_monto: etiqueta ?? null,
    leida
});

const listarNotificacionesLocal = ({ userId }) => {
    const notificaciones = [];
    const readSet = new Set(
        (store.notificacionesLeidas || [])
            .filter((n) => String(n.usuario_id) === String(userId))
            .map((n) => n.id_evento)
    );

    for (const subasta of store.subastas || []) {
        const estadoSubasta = String(subasta.estado || '').toUpperCase();

        for (const item of subasta.items || []) {
            const userBids = (store.bids || []).filter(
                (b) => String(b.item_id) === String(item.id) && String(b.usuario_id) === String(userId)
            );
            const highest = getHighestBidLocal(item.id);
            const esGanadorPorPuja = highest && String(highest.usuario_id) === String(userId);
            const esGanadorAdjudicado =
                item.ganador_usuario_id && String(item.ganador_usuario_id) === String(userId);
            const esGanador = esGanadorPorPuja || esGanadorAdjudicado;
            const subastaFinalizada = estadoSubasta === 'FINALIZADA' || item.vendido === true;

            if (subastaFinalizada && esGanadorAdjudicado) {
                notificaciones.push(
                    buildNotificacion({
                        id: `adj-${item.id}`,
                        tipo: 'ADJUDICADO',
                        itemId: item.id,
                        titulo: item.descripcion,
                        monto: Number(item.ultima_oferta || highest?.monto || 0),
                        etiqueta: 'Ganaste por',
                        fecha: subasta.fecha_fin,
                        leida: readSet.has(`adj-${item.id}`)
                    })
                );
                continue;
            }

            if (!userBids.length) continue;

            const userHighest = userBids.reduce(
                (max, b) => (Number(b.monto) > Number(max.monto) ? b : max),
                userBids[0]
            );
            const ultimaPuja = userBids.sort(
                (a, b) => new Date(b.fecha_puja).getTime() - new Date(a.fecha_puja).getTime()
            )[0];

            if (subastaFinalizada && esGanador) {
                notificaciones.push(
                    buildNotificacion({
                        id: `adj-${item.id}`,
                        tipo: 'ADJUDICADO',
                        itemId: item.id,
                        titulo: item.descripcion,
                        monto: Number(item.ultima_oferta || highest?.monto || 0),
                        etiqueta: 'Ganaste por',
                        fecha: subasta.fecha_fin || ultimaPuja?.fecha_puja,
                        leida: readSet.has(`adj-${item.id}`)
                    })
                );
                continue;
            }

            if (estadoSubasta === 'EN_VIVO' && esGanador) {
                notificaciones.push(
                    buildNotificacion({
                        id: `activa-${item.id}`,
                        tipo: 'PUJA_ACTIVA',
                        itemId: item.id,
                        titulo: item.descripcion,
                        monto: Number(userHighest.monto),
                        etiqueta: 'Tu oferta',
                        fecha: ultimaPuja?.fecha_puja,
                        leida: readSet.has(`activa-${item.id}`)
                    })
                );
                continue;
            }

            if (estadoSubasta === 'EN_VIVO' && !esGanador) {
                notificaciones.push(
                    buildNotificacion({
                        id: `superada-${item.id}`,
                        tipo: 'PUJA_SUPERADA',
                        itemId: item.id,
                        titulo: item.descripcion,
                        monto: Number(highest?.monto || 0),
                        etiqueta: 'Oferta actual',
                        fecha: ultimaPuja?.fecha_puja,
                        leida: readSet.has(`superada-${item.id}`)
                    })
                );
            }
        }
    }

    notificaciones.sort((a, b) => {
        const priority = { ADJUDICADO: 0, PAGO_PENDIENTE: 1, PUJA_SUPERADA: 2, PUJA_ACTIVA: 3 };
        return (priority[a.tipo_evento] ?? 9) - (priority[b.tipo_evento] ?? 9);
    });

    const totalNoLeidas = notificaciones.filter((n) => !n.leida).length;

    return { notificaciones, total_no_leidas: totalNoLeidas };
};

const listarNotificacionesSupabase = async ({ userId }) => {
    // Fallback a local cuando no hay tabla de notificaciones en Supabase
    return listarNotificacionesLocal({ userId });
};

const listarNotificaciones = async ({ userId }) => {
    if (!userId) {
        throw new AppError('No autenticado', 401);
    }

    if (!isConfigured) {
        return listarNotificacionesLocal({ userId });
    }

    return listarNotificacionesSupabase({ userId });
};

const marcarComoLeidaLocal = ({ userId, notificacionId }) => {
    if (!Array.isArray(store.notificacionesLeidas)) {
        store.notificacionesLeidas = [];
    }

    const exists = store.notificacionesLeidas.some(
        (n) => String(n.usuario_id) === String(userId) && String(n.id_evento) === String(notificacionId)
    );

    if (!exists) {
        store.notificacionesLeidas.push({
            usuario_id: userId,
            id_evento: notificacionId,
            leida_en: new Date().toISOString()
        });
    }

    return { mensaje: 'Notificación marcada como leída' };
};

const marcarComoLeida = async ({ userId, notificacionId }) => {
    if (!notificacionId) {
        throw new AppError('Notificación no encontrada', 404);
    }

    return marcarComoLeidaLocal({ userId, notificacionId });
};

module.exports = {
    listarNotificaciones,
    marcarComoLeida
};
