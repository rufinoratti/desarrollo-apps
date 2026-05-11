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
                categorias_tematicas (nombre)
            `, { count: 'exact' });

        // 2. FILTROS CORREGIDOS
        if (tematica) {
            query = query.eq('tematica', Number(tematica));
        }

        if (estadoDB) {
            query = query.eq('estado', estadoDB);
        } else if (!estado) {
            // Por defecto traemos las abiertas
            query = query.eq('estado', 'abierta');
        }

        // Ordenamos por la fecha de la base de datos
        query = query.order('fecha', { ascending: false }).range(desde, hasta);

        const { data, count, error } = await query;

        if (error) {
            console.error("Error exacto en DB:", error);
            throw new AppError('Error al obtener subastas: ' + error.message, 500);
        }

        // 3. MAPEO PARA EL FRONTEND
        const subastas = (data || []).map(formatearSubastaResumen);
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
        const subastas = ordenadas.slice(desde, hasta + 1);
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
const formatearSubastaResumen = (row) => ({
    id: row.identificador,
    // Inventamos un título prolijo ya que la tabla del profe no tiene 'titulo'
    titulo: `Gran Subasta #${row.identificador}`, 
    categoria_id: row.tematica,
    categoria_nombre: row.categorias_tematicas?.nombre || null,
    icono_url: null,
    // Convertimos estado de DB a estado de Swagger
    estado: row.estado === 'abierta' ? 'EN_VIVO' : 'FINALIZADA', 
    imagen_portada: null,
    moneda: 'ARS', // Asumimos Pesos
    ubicacion: row.ubicacion || 'Ubicación no definida',
    rematador: row.subastador,
    // Unimos fecha y hora para el frontend
    fecha_inicio: `${row.fecha}T${row.hora}`, 
    fecha_fin: null,
    nivel_acceso: row.categoria, // 'comun', 'oro', etc.
    precio_base_minimo: null,
    total_items: 0
});

module.exports = {
    obtenerCategorias,
    obtenerSubastas
};