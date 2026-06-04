/**
 * ============================================================
 * REMATIX - Servicio Home y Exploración (Módulo 2)
 * ============================================================
 */

const { store } = require('./data.store');
const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');

const normalizarEstadoSwagger = (estado) => String(estado || '').toUpperCase();

const ordenarSubastasLocales = (items = []) => {
    return [...items].sort((a, b) => {
        const fa = new Date(a.fecha_inicio || 0).getTime();
        const fb = new Date(b.fecha_inicio || 0).getTime();
        return fb - fa;
    });
};

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
 * Devuelve el listado paginado de subastas
 */
const obtenerSubastas = async ({ tematica, estado, limite = 20, pagina = 1 } = {}) => {
    const limiteSano = Math.min(Math.max(Number(limite) || 20, 1), 100);
    const paginaSana = Math.max(Number(pagina) || 1, 1);
    const desde = (paginaSana - 1) * limiteSano;
    const hasta = desde + limiteSano - 1;

    // Mapeo de estados del Frontend (Swagger) a la Base de Datos (Profe)
    let estadoDB = null;
    if (estado) {
        const estadoUpper = String(estado).toUpperCase();
        if (estadoUpper === 'EN_VIVO') estadoDB = 'abierta';
        else if (estadoUpper === 'FINALIZADA') estadoDB = 'cerrada';
        // Si mandan "PROXIMAMENTE", no lo filtramos acá para no romper, o asumimos abierta con fecha futura
    }

    if (isConfigured) {
        // 1. SELECT CORREGIDO: Solo pedimos columnas que EXISTEN en la base del profe
        // Y hacemos el JOIN correcto con categorias_tematicas
        // 1. SELECT CORREGIDO: Solo columnas reales del Profe
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

        // 2. FILTROS CORREGIDOS
        if (tematica) {
            query = query.eq('tematica', Number(tematica));
        }

        if (estadoDB) {
            query = query.eq('estado', estadoDB);
        }

        // Ordenamos por la fecha de la base de datos
        query = query.order('fecha', { ascending: false }).range(desde, hasta);

        const { data, count, error } = await query;

        if (error) {
            console.error("Error exacto en DB:", error);
            throw new AppError('Error al obtener subastas: ' + error.message, 500);
        }

        // 3. CONTAR ARTÍCULOS POR SUBASTA
        const subastaIds = (data || []).map((s) => s.identificador).filter(Boolean);
        let itemsPorSubasta = {};

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

        // 4. MAPEO PARA EL FRONTEND
        const subastas = (data || []).map((row) => formatearSubastaResumen(row, itemsPorSubasta[row.identificador] || 0));
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

        if (estado) {
            const estadoNormalizado = normalizarEstadoSwagger(estado);
            resultado = resultado.filter(
                (s) => normalizarEstadoSwagger(s.estado) === estadoNormalizado
            );
        } else {
            // Mantener comportamiento por defecto equivalente a la rama DB (solo en vivo)
            resultado = resultado.filter(
                (s) => normalizarEstadoSwagger(s.estado) === 'EN_VIVO'
            );
        }

        const ordenadas = ordenarSubastasLocales(resultado);
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
 * Mapea una fila de Supabase (esquema del profe) al formato SubastaResumen del Swagger.
 */
const formatearSubastaResumen = (row, totalItems = 0) => {
    const fechaInicio = `${row.fecha}T${row.hora}`;
    const inicio = new Date(fechaInicio);
    const fechaFin = new Date(inicio.getTime() + 3600 * 1000).toISOString();
    return {
        id: row.identificador,
        titulo: row.nombre || `Subasta #${row.identificador}`,
        categoria_id: row.tematica,
        categoria_nombre: row.categorias_tematicas?.nombre || null,
        icono_url: null,
        estado: row.estado === 'abierta' ? 'EN_VIVO' : 'FINALIZADA',
        imagen_portada: row.imagen || null,
        moneda: 'ARS',
        ubicacion: row.ubicacion || 'Ubicación no definida',
        rematador: row.subastador,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        nivel_acceso: row.categoria,
        precio_base_minimo: null,
        cantidad_articulos: totalItems
    };
};

module.exports = {
    obtenerCategorias,
    obtenerSubastas
};