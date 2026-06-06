/**
 * ============================================================
 * REMATIX - Servicio Home y Exploración (Módulo 2)
 * ============================================================
 */

const { store } = require('./data.store');
const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const {
    PROXIMAMENTE,
    EN_VIVO,
    FINALIZADA,
    calcularEstadoSubastaDisplay,
    calcularFechasIso,
    compararParaListado
} = require('../utils/estadoSubasta');

const obtenerCategorias = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('categorias_tematicas')
            .select('identificador, nombre')
            .order('nombre');

        if (error) {
            throw new AppError('Error al obtener categorías: ' + error.message, 500);
        }

        return data || [];
    }
    return store.categorias || [];
};

/**
 * Devuelve el listado paginado de subastas.
 *
 * Query params:
 *   tematica : id de temática
 *   estado   : EN_VIVO | PROXIMAMENTE | FINALIZADA
 *   limite   : elementos por página (default 20, máx 100)
 *   pagina   : número de página (default 1)
 */
const obtenerSubastas = async ({ tematica, estado, limite = 20, pagina = 1 } = {}) => {
    const limiteSano = Math.min(Math.max(Number(limite) || 20, 1), 100);
    const paginaSana = Math.max(Number(pagina) || 1, 1);
    const desde = (paginaSana - 1) * limiteSano;
    const hasta = desde + limiteSano - 1;

    let estadoDB = null;
    let estadoDisplayFiltro = null;
    if (estado) {
        const estadoUpper = String(estado).toUpperCase();
        if (estadoUpper === EN_VIVO) {
            estadoDB = 'abierta';
            estadoDisplayFiltro = EN_VIVO;
        } else if (estadoUpper === PROXIMAMENTE) {
            estadoDB = 'cerrada';
            estadoDisplayFiltro = PROXIMAMENTE;
        } else if (estadoUpper === FINALIZADA) {
            estadoDB = 'finalizada';
            estadoDisplayFiltro = FINALIZADA;
        }
    }

    if (isConfigured) {
        let query = supabase
            .from('subastas')
            .select(`
                identificador,
                fecha,
                hora,
                estado,
                subastador,
                ubicacion,
                categoria,
                tematica,
                nombre,
                imagen,
                categorias_tematicas (nombre)
            `, { count: 'exact' });

        if (tematica) {
            query = query.eq('tematica', Number(tematica));
        }

        if (estadoDB) {
            query = query.eq('estado', estadoDB);
        }

        const { data, count, error } = await query;

        if (error) {
            console.error('Error exacto en DB:', error);
            throw new AppError('Error al obtener subastas: ' + error.message, 500);
        }

        let rows = data || [];

        if (estadoDisplayFiltro === PROXIMAMENTE || estadoDisplayFiltro === FINALIZADA) {
            const ahoraMs = Date.now();
            rows = rows.filter((r) => {
                if (!r.fecha || !r.hora) return false;
                const inicio = new Date(`${r.fecha}T${r.hora}`).getTime();
                if (Number.isNaN(inicio)) return false;
                if (estadoDisplayFiltro === PROXIMAMENTE) return inicio > ahoraMs;
                return inicio <= ahoraMs;
            });
        }

        const subastaIds = rows.map((s) => s.identificador).filter(Boolean);
        const itemsPorSubasta = {};

        if (subastaIds.length) {
            const { data: catalogos } = await supabase
                .from('catalogos')
                .select('identificador, subasta')
                .in('subasta', subastaIds);

            const catalogoIds = (catalogos || []).map((c) => c.identificador).filter(Boolean);

            if (catalogoIds.length) {
                const { data: items } = await supabase
                    .from('itemscatalogo')
                    .select('catalogo')
                    .in('catalogo', catalogoIds);

                const itemsCount = {};
                for (const it of items || []) {
                    itemsCount[it.catalogo] = (itemsCount[it.catalogo] || 0) + 1;
                }
                for (const cat of catalogos || []) {
                    const prev = itemsPorSubasta[cat.subasta] || 0;
                    itemsPorSubasta[cat.subasta] = prev + (itemsCount[cat.identificador] || 0);
                }
            }
        }

        const ordenadas = [...rows].sort(compararParaListado);
        const subastas = ordenadas.slice(desde, hasta + 1).map((row) =>
            formatearSubastaResumen(row, itemsPorSubasta[row.identificador] || 0)
        );
        const total = count || 0;

        return {
            subastas,
            total,
            pagina_actual: paginaSana,
            total_paginas: Math.ceil(total / limiteSano) || 1
        };
    } else {
        let resultado = Array.isArray(store.subastas) ? [...store.subastas] : [];

        if (tematica) {
            resultado = resultado.filter((s) => Number(s.categoria_id) === Number(tematica));
        }

        if (estadoDisplayFiltro) {
            resultado = resultado.filter((s) => {
                if (s.estado === EN_VIVO && estadoDisplayFiltro === EN_VIVO) return true;
                if (s.estado === PROXIMAMENTE && estadoDisplayFiltro === PROXIMAMENTE) return true;
                if (s.estado === FINALIZADA && estadoDisplayFiltro === FINALIZADA) return true;
                return false;
            });
        }

        const ordenadas = [...resultado].sort(compararParaListado);
        const subastas = ordenadas.slice(desde, hasta + 1).map((s) => {
            let fechaFin = s.fecha_fin || null;
            if (!fechaFin && s.fecha_inicio) {
                fechaFin = new Date(new Date(s.fecha_inicio).getTime() + 3600 * 1000).toISOString();
            }
            return {
                ...s,
                fecha_fin: fechaFin,
                cantidad_articulos: s.cantidad_articulos ?? (Array.isArray(s.items) ? s.items.length : s.total_items ?? 0)
            };
        });
        const total = ordenadas.length;

        return {
            subastas,
            total,
            pagina_actual: paginaSana,
            total_paginas: Math.ceil(total / limiteSano) || 1
        };
    }
};

// ============================================================
// HELPERS DE FORMATO
// ============================================================

/**
 * Mapea una fila de Supabase al formato SubastaResumen del Swagger,
 * calculando el estado de display (PROXIMAMENTE / EN_VIVO / FINALIZADA)
 * a partir de la fecha y hora reales, no de la columna `estado`.
 */
const formatearSubastaResumen = (row, totalItems = 0) => {
    const fechaInicio = `${row.fecha}T${row.hora}`;
    const { fecha_inicio_iso, fecha_fin_iso } = calcularFechasIso(row);
    return {
        id: row.identificador,
        titulo: row.nombre || `Subasta #${row.identificador}`,
        categoria_id: row.tematica,
        categoria_nombre: row.categorias_tematicas?.nombre || null,
        icono_url: null,
        estado: calcularEstadoSubastaDisplay(row),
        imagen_portada: row.imagen || null,
        moneda: 'ARS',
        ubicacion: row.ubicacion || 'Ubicación no definida',
        rematador: row.subastador,
        fecha_inicio: fechaInicio,
        fecha_fin: fecha_fin_iso,
        fecha_inicio_iso,
        fecha_fin_iso,
        nivel_acceso: row.categoria,
        precio_base_minimo: null,
        cantidad_articulos: totalItems
    };
};

module.exports = {
    obtenerCategorias,
    obtenerSubastas
};
