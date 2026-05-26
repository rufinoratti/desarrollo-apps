/**
 * ============================================================
 * REMATIX - Data Store (Memoria)
 * ============================================================
 *
 * Almacén de datos en memoria para el entorno de desarrollo local.
 * Cuando SUPABASE_ENABLED=true, los servicios persisten en Supabase
 * y este store se utiliza solo para registros temporales y cache.
 *
 * @module services/data.store
 */

/**
 * Ranking de categorías de usuarios para comparación de permisos.
 * @type {Object<string, number>}
 */
const CATEGORY_RANK = {
    comun: 1,
    especial: 2,
    plata: 3,
    oro: 4,
    platino: 5
};

const nowIso = new Date().toISOString();
const proximoIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 días desde ahora

/**
 * Store principal en memoria.
 * @type {Object}
 */
const store = {
    /** Usuarios registrados y activos. */
    users: [
        {
            id: 'u1',
            nombre: 'Ada',
            nombre_completo: 'Ada Lovelace',
            apellido: 'Lovelace',
            email: 'ada@rematix.com',
            passwordHash: '$2b$10$P4wl0tfSryMX5d/J5gA2.OOrWdJxLX1sWX0NmDCPxgAIA/qLWjORa', // Test1234!
            pais_origen: 'AR',
            domicilio_legal: 'CABA',
            categoria: 'platino',
            estado_registro: 'completo',
            estado_validacion: 'APROBADO',
            clave_generada: true,
            bloqueado: false,
            multa_pendiente: 0,
            subasta_conectada_id: null,
            medios_pago: [
                {
                    id: 'mp1',
                    tipo: 'tarjeta',
                    descripcion: 'Visa Internacional',
                    verificado: true,
                    monto_garantia: null
                }
            ],
            created_at: nowIso
        }
    ],

    /**
     * Catálogo de categorías de artículos para subastas.
     * Módulo 2: Home y Exploración.
     */
    categorias: [
        { id: 1, nombre: 'Arte y Pintura',  activa: true },
        { id: 2, nombre: 'Vehículos Clásicos', activa: true },
        { id: 3, nombre: 'Relojería',       activa: true },
        { id: 4, nombre: 'Joyería',         activa: true },
        { id: 5, nombre: 'Antigüedades',    activa: true },
        { id: 6, nombre: 'Inmuebles',       activa: true },
        { id: 7, nombre: 'Coleccionables',  activa: true }
    ],

    /**
     * Subastas disponibles en el sistema.
     * - categoria_id: referencia a la categoría del artículo (Arte, Joyería, etc.)
     * - nivel_acceso: mínimo de categoría de postor requerido (comun, especial, plata, oro, platino)
     * - estado: EN_VIVO | PROXIMAMENTE | FINALIZADA  (valores del Swagger)
     */
    subastas: [
        {
            id: 's1',
            titulo: 'Subasta de Arte Contemporáneo',
            categoria_id: 1,
            categoria_nombre: 'Arte y Pintura',
            nivel_acceso: 'comun',
            estado: 'EN_VIVO',
            moneda: 'USD',
            imagen_portada: 'https://cdn.rematix.com/subastas/arte-contemporaneo.jpg',
            ubicacion: 'Buenos Aires',
            rematador: 'Martillero 1',
            fecha_inicio: nowIso,
            fecha_fin: null,
            precio_base_minimo: 10000,
            total_items: 1,
            items: [
                {
                    id: 'i101',
                    numero_pieza: '101',
                    descripcion: 'Cuadro abstracto original',
                    precio_base: 10000,
                    ultima_oferta: 15000,
                    duenio_actual_id: 'duenio-1',
                    vendido: false,
                    imagenes: ['img1', 'img2', 'img3', 'img4', 'img5', 'img6']
                }
            ]
        },
        {
            id: 's2',
            titulo: 'Colección Vintage de Relojes Suizos',
            categoria_id: 3,
            categoria_nombre: 'Relojería',
            nivel_acceso: 'especial',
            estado: 'PROXIMAMENTE',
            moneda: 'USD',
            imagen_portada: 'https://cdn.rematix.com/subastas/relojes-suizos.jpg',
            ubicacion: 'Córdoba',
            rematador: 'Martillero 2',
            fecha_inicio: proximoIso,
            fecha_fin: null,
            precio_base_minimo: 5000,
            total_items: 1,
            items: [
                {
                    id: 'i202',
                    numero_pieza: '202',
                    descripcion: 'Juego de Té 18 piezas',
                    precio_base: 5000,
                    ultima_oferta: 0,
                    duenio_actual_id: 'duenio-2',
                    vendido: false,
                    imagenes: ['img1', 'img2', 'img3', 'img4', 'img5', 'img6']
                }
            ]
        },
        {
            id: 's3',
            titulo: 'Gran Subasta de Joyería Exclusiva',
            categoria_id: 4,
            categoria_nombre: 'Joyería',
            nivel_acceso: 'oro',
            estado: 'PROXIMAMENTE',
            moneda: 'USD',
            imagen_portada: 'https://cdn.rematix.com/subastas/joyeria.jpg',
            ubicacion: 'Rosario',
            rematador: 'Martillero 3',
            fecha_inicio: proximoIso,
            fecha_fin: null,
            precio_base_minimo: 25000,
            total_items: 0,
            items: []
        },
        {
            id: 's4',
            titulo: 'Automóviles Clásicos — Temporada 2025',
            categoria_id: 2,
            categoria_nombre: 'Vehículos Clásicos',
            nivel_acceso: 'comun',
            estado: 'FINALIZADA',
            moneda: 'ARS',
            imagen_portada: 'https://cdn.rematix.com/subastas/autos-clasicos.jpg',
            ubicacion: 'Mendoza',
            rematador: 'Martillero 4',
            fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            fecha_fin: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
            precio_base_minimo: 800000,
            total_items: 0,
            items: []
        }
    ],

    /** Historial de pujas realizadas. */
    bids: [
        {
            id: 'b1',
            subasta_id: 's1',
            item_id: 'i101',
            usuario_id: 'u1',
            monto: 15000,
            fecha_puja: nowIso
        }
    ],

    /** Solicitudes de artículos para subastar. */
    articleRequests: [],

    /** Productos publicados (pendientes de evaluación). */
    productos: [],

    /** Registros temporales en proceso de registro de usuarios. */
    registrosTemporales: [],

    /** Medios de pago registrados en el sistema. */
    mediosPago: [],

    /** Rate limiting para recuperación de contraseña. */
    recoveryAttempts: {}
};

/**
 * Contadores para generar IDs secuenciales únicos.
 * @type {Object<string, number>}
 */
const counters = {
    user: 2,
    medioPago: 2,
    bid: 2,
    articleReq: 1,
    registroTemp: 1,
    subasta: 5,
    producto: 1
};

/**
 * Genera un ID único con prefijo y contador incremental.
 *
 * @param {string} prefix - Prefijo del ID (ej: 'u', 'mp', 'b')
 * @param {string} key    - Clave del contador en el objeto counters
 * @returns {string} ID generado (ej: 'u2', 'mp2')
 */
const nextId = (prefix, key) => {
    const value = counters[key];
    counters[key] += 1;
    return `${prefix}${value}`;
};

module.exports = {
    store,
    CATEGORY_RANK,
    nextId
};
