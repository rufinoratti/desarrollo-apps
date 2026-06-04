const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store, nextId, CATEGORY_RANK } = require('./data.store');
const { verificarLimiteCheque } = require('./billetera.service');

const mapEstadoSubastaApi = (estado) => {
    const est = String(estado || '').toLowerCase();
    if (est === 'abierta' || est === 'en_vivo') return 'ABIERTA';
    return 'CERRADA';
};

const getNow = () => new Date();

const isMedioVerificado = (m) => String(m?.verificado).toLowerCase() === 'si' || m?.verificado === true;

const buildMontoError = (msg, codigo, montoMinimo) => {
    const err = new AppError(msg, 400);
    err.codigo = codigo;
    if (montoMinimo !== undefined) {
        err.monto_minimo = Number(montoMinimo);
    }
    return err;
};

const getOfertaActualFromList = (bids = [], precioBase = 0) => {
    if (!bids.length) return Number(precioBase || 0);
    return Math.max(...bids.map((b) => Number(b.monto || b.importe || 0)));
};

const getOrCreateLocalAsistente = ({ clienteId, subastaId }) => {
    if (!Array.isArray(store.asistentes)) {
        store.asistentes = [];
    }

    let asistente = store.asistentes.find(
        (a) => String(a.cliente_id) === String(clienteId) && String(a.subasta_id) === String(subastaId)
    );

    if (!asistente) {
        const numero = store.asistentes.filter((a) => String(a.subasta_id) === String(subastaId)).length + 1;
        asistente = {
            id: `as-${store.asistentes.length + 1}`,
            cliente_id: clienteId,
            subasta_id: subastaId,
            numero_postor: numero
        };
        store.asistentes.push(asistente);
    }

    return asistente;
};

const getLocalItemContext = (itemId) => {
    for (const subasta of store.subastas || []) {
        const item = (subasta.items || []).find((it) => String(it.id) === String(itemId));
        if (item) {
            return { subasta, item };
        }
    }

    throw new AppError('Artículo no encontrado', 404);
};

const buildLocalHistorial = ({ itemId }) => {
    const bids = (store.bids || [])
        .filter((b) => String(b.item_id) === String(itemId))
        .sort((a, b) => new Date(b.fecha_puja) - new Date(a.fecha_puja));

    const historial = bids.map((b) => {
        const asistente = (store.asistentes || []).find((a) => String(a.id) === String(b.asistente_id));
        return {
            monto: Number(b.monto),
            fecha_hora: b.fecha_puja,
            postor: `Postor #${asistente?.numero_postor || 'N/A'}`
        };
    });

    const participantesSet = new Set(bids.map((b) => b.asistente_id || b.usuario_id));

    return {
        historial,
        totalParticipantes: participantesSet.size
    };
};

const obtenerEstadoPujasItemLocal = ({ itemId }) => {
    const { subasta, item } = getLocalItemContext(itemId);
    const bids = (store.bids || []).filter((b) => String(b.item_id) === String(itemId));
    const ofertaActual = getOfertaActualFromList(bids, item.precio_base);
    const { historial, totalParticipantes } = buildLocalHistorial({ itemId });

    return {
        item_id: String(item.id),
        oferta_actual: ofertaActual,
        estado_subasta: mapEstadoSubastaApi(subasta.estado),
        tiempo_restante_segundos: null,
        total_participantes: totalParticipantes,
        historial_pujas: historial
    };
};

const obtenerEstadoPujasItemSupabase = async ({ itemId }) => {
    const itemIdNum = Number(itemId);
    if (Number.isNaN(itemIdNum)) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const { data: item, error: itemError } = await supabase
        .from('itemscatalogo')
        .select('identificador, preciobase, catalogo')
        .eq('identificador', itemIdNum)
        .maybeSingle();

    if (itemError) {
        throw new AppError('Error al obtener artículo: ' + itemError.message, 500);
    }

    if (!item) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const { data: catalogo, error: catalogoError } = await supabase
        .from('catalogos')
        .select('subasta')
        .eq('identificador', item.catalogo)
        .maybeSingle();

    if (catalogoError) {
        throw new AppError('Error al obtener subasta del artículo: ' + catalogoError.message, 500);
    }

    if (!catalogo?.subasta) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const { data: subasta, error: subastaError } = await supabase
        .from('subastas')
        .select('identificador, estado, fecha, hora')
        .eq('identificador', catalogo.subasta)
        .maybeSingle();

    if (subastaError) {
        throw new AppError('Error al obtener subasta: ' + subastaError.message, 500);
    }

    const { data: bids, error: bidsError } = await supabase
        .from('pujos')
        .select('identificador, importe, asistente')
        .eq('item', itemIdNum)
        .order('identificador', { ascending: false });

    if (bidsError) {
        throw new AppError('Error al obtener historial de pujas: ' + bidsError.message, 500);
    }

    const ofertaActual = bids?.length
        ? Number(bids[0].importe)
        : Number(item.preciobase || 0);

    const asistentesIds = [...new Set((bids || []).map((b) => b.asistente))].filter(Boolean);
    let asistentesMap = new Map();

    if (asistentesIds.length) {
      const { data: asistentesData, error: asistentesError } = await supabase
          .from('asistentes')
          .select('identificador, numeropostor')
          .in('identificador', asistentesIds);

      if (asistentesError) {
          throw new AppError('Error al obtener asistentes: ' + asistentesError.message, 500);
      }

      asistentesMap = new Map((asistentesData || []).map((a) => [a.identificador, a]));
    }

    const historial = (bids || []).map((b) => ({
        monto: Number(b.importe),
        fecha_hora: null,
        postor: `Postor #${asistentesMap.get(b.asistente)?.numeropostor || 'N/A'}`
    }));

    return {
        item_id: String(item.identificador),
        oferta_actual: ofertaActual,
        estado_subasta: mapEstadoSubastaApi(subasta?.estado),
        tiempo_restante_segundos: null,
        total_participantes: asistentesIds.length,
        historial_pujas: historial
    };
};

const obtenerEstadoPujasItem = async ({ itemId }) => {
    if (!itemId) {
        throw new AppError('Artículo no encontrado', 404);
    }

    if (!isConfigured) {
        return obtenerEstadoPujasItemLocal({ itemId });
    }

    return obtenerEstadoPujasItemSupabase({ itemId });
};

const validateMontoRules = ({ montoOfertado, ofertaActual, precioBase, categoriaSubasta }) => {
    const monto = Number(montoOfertado);
    const actual = Number(ofertaActual);
    const base = Number(precioBase);

    if (Number.isNaN(monto) || monto <= 0) {
        throw buildMontoError('Monto insuficiente o inválido', 'MONTO_INSUFICIENTE', actual);
    }

    const esPrimeraPuja = actual === base;
    const montoMinimo = esPrimeraPuja ? base : actual + (base * 0.01);

    if (monto < montoMinimo) {
        throw buildMontoError('El monto debe ser mayor a la oferta actual', 'MONTO_INSUFICIENTE', montoMinimo);
    }

    const categoria = String(categoriaSubasta || '').toLowerCase();
    if (!['oro', 'platino'].includes(categoria)) {
        const montoMaximo = actual + (base * 0.20);
        if (monto > montoMaximo) {
            const err = new AppError('El monto supera el límite máximo permitido', 400);
            err.codigo = 'MONTO_EXCEDE_LIMITE';
            throw err;
        }
    }
};

const realizarPujaLocal = async ({ authUser, payload }) => {
    const { item_id, monto_ofertado } = payload || {};
    if (!item_id || monto_ofertado === undefined) {
        throw new AppError('Datos inválidos o incompletos', 400);
    }

    const user = (store.users || []).find((u) => String(u.id) === String(authUser?.id));
    if (!user) {
        throw new AppError('No autenticado', 401);
    }

    const { subasta, item } = getLocalItemContext(item_id);

    const estadoLocal = String(subasta.estado || '').toUpperCase();
    if (!['EN_VIVO', 'ABIERTA'].includes(estadoLocal)) {
        throw new AppError('Artículo no encontrado o subasta cerrada', 404);
    }

    const rankUsuario = CATEGORY_RANK[String(user.categoria || '').toLowerCase()] || 0;
    const rankSubasta = CATEGORY_RANK[String(subasta.nivel_acceso || '').toLowerCase()] || 0;
    if (rankUsuario < rankSubasta) {
        throw new AppError('Nivel insuficiente para participar en esta subasta', 403);
    }

    const mediosVerificados = (user.medios_pago || []).filter(isMedioVerificado);
    if (mediosVerificados.length === 0) {
        throw new AppError('Sin medio de pago verificado', 403);
    }

    const itemBids = (store.bids || []).filter((b) => String(b.item_id) === String(item.id));
    const ofertaActual = getOfertaActualFromList(itemBids, item.precio_base);

    validateMontoRules({
        montoOfertado: monto_ofertado,
        ofertaActual,
        precioBase: item.precio_base,
        categoriaSubasta: subasta.nivel_acceso
    });

    // REQ-BIZ-1: si principal verificado es cheque, validar límite
    const principal = mediosVerificados.find((m) => String(m.es_principal).toLowerCase() === 'si') || mediosVerificados[0];
    verificarLimiteCheque({
        medioPago: principal,
        ofertaActual: Number(monto_ofertado),
        comision: 0
    });

    const asistente = getOrCreateLocalAsistente({
        clienteId: user.id,
        subastaId: subasta.id
    });

    const newBid = {
        id: nextId('b', 'bid'),
        subasta_id: subasta.id,
        item_id: item.id,
        usuario_id: user.id,
        asistente_id: asistente.id,
        monto: Number(monto_ofertado),
        fecha_puja: new Date().toISOString(),
        ganador: 'no'
    };

    if (!Array.isArray(store.bids)) {
        store.bids = [];
    }
    store.bids.push(newBid);

    item.ultima_oferta = Number(monto_ofertado);
    user.subasta_conectada_id = subasta.id;

    return {
        mensaje: 'Puja registrada correctamente',
        puja_id: String(newBid.id),
        oferta_actual: Number(monto_ofertado),
        posicion: 'GANANDO'
    };
};

const resolveClienteIdSupabase = async (authUser) => {
    const asNumber = Number(authUser?.id);
    if (!Number.isNaN(asNumber)) {
        return asNumber;
    }

    if (!authUser?.email) {
        throw new AppError('No autenticado', 401);
    }

    const { data: persona, error } = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', authUser.email)
        .maybeSingle();

    if (error) throw new AppError('Error al resolver usuario: ' + error.message, 500);
    if (!persona?.identificador) throw new AppError('No autenticado', 401);

    return persona.identificador;
};

const obtenerContextoItemSupabase = async (itemIdNum) => {
    const { data: item, error: itemError } = await supabase
        .from('itemscatalogo')
        .select('identificador, catalogo, preciobase')
        .eq('identificador', itemIdNum)
        .maybeSingle();

    if (itemError) throw new AppError('Error al obtener artículo: ' + itemError.message, 500);
    if (!item) throw new AppError('Artículo no encontrado', 404);

    const { data: catalogo, error: catalogoError } = await supabase
        .from('catalogos')
        .select('subasta')
        .eq('identificador', item.catalogo)
        .maybeSingle();

    if (catalogoError) throw new AppError('Error al obtener catálogo: ' + catalogoError.message, 500);
    if (!catalogo?.subasta) throw new AppError('Artículo no encontrado', 404);

    const { data: subasta, error: subastaError } = await supabase
        .from('subastas')
        .select('identificador, estado, categoria, fecha, hora')
        .eq('identificador', catalogo.subasta)
        .maybeSingle();

    if (subastaError) throw new AppError('Error al obtener subasta: ' + subastaError.message, 500);
    if (!subasta) throw new AppError('Artículo no encontrado o subasta cerrada', 404);

    return { item, subasta };
};

const getOfertaActualSupabase = async (itemIdNum, precioBase) => {
    const { data: topBid, error } = await supabase
        .from('pujos')
        .select('importe')
        .eq('item', itemIdNum)
        .order('importe', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        throw new AppError('Error al obtener oferta actual: ' + error.message, 500);
    }

    return topBid?.importe ? Number(topBid.importe) : Number(precioBase || 0);
};

const getOrCreateAsistenteSupabase = async ({ clienteId, subastaId }) => {
    const { data: existente, error: exError } = await supabase
        .from('asistentes')
        .select('identificador, numeropostor')
        .eq('cliente', clienteId)
        .eq('subasta', subastaId)
        .maybeSingle();

    if (exError) {
        throw new AppError('Error al obtener asistente: ' + exError.message, 500);
    }

    if (existente) return existente;

    const { count, error: countError } = await supabase
        .from('asistentes')
        .select('identificador', { count: 'exact', head: true })
        .eq('subasta', subastaId);

    if (countError) {
        throw new AppError('Error al generar número de postor: ' + countError.message, 500);
    }

    const numeroPostor = (count || 0) + 1;

    const { data: nuevo, error: newError } = await supabase
        .from('asistentes')
        .insert({
            numeropostor: numeroPostor,
            cliente: clienteId,
            subasta: subastaId
        })
        .select('identificador, numeropostor')
        .single();

    if (newError) {
        throw new AppError('Error al crear asistente: ' + newError.message, 500);
    }

    return nuevo;
};

const realizarPujaSupabase = async ({ authUser, payload }) => {
    const { item_id, monto_ofertado } = payload || {};
    if (!item_id || monto_ofertado === undefined) {
        throw new AppError('Datos inválidos o incompletos', 400);
    }

    const itemIdNum = Number(item_id);
    if (Number.isNaN(itemIdNum)) {
        throw new AppError('Artículo no encontrado', 404);
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    const { item, subasta } = await obtenerContextoItemSupabase(itemIdNum);

    const estadoSupa = String(subasta.estado || '').toUpperCase();
    if (!['ABIERTA', 'EN_VIVO'].includes(estadoSupa)) {
        throw new AppError('Artículo no encontrado o subasta cerrada', 404);
    }

    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('categoria')
        .eq('identificador', clienteId)
        .maybeSingle();

    if (clienteError) {
        throw new AppError('Error al validar categoría del usuario: ' + clienteError.message, 500);
    }

    const rankUsuario = CATEGORY_RANK[String(cliente?.categoria || '').toLowerCase()] || 0;
    const rankSubasta = CATEGORY_RANK[String(subasta.categoria || '').toLowerCase()] || 0;
    if (rankUsuario < rankSubasta) {
        throw new AppError('Nivel insuficiente para participar en esta subasta', 403);
    }

    const { count: verifiedCount, error: verifiedError } = await supabase
        .from('mediosdepago')
        .select('identificador', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)
        .eq('verificado', 'si');

    if (verifiedError) {
        throw new AppError('Error al validar medios de pago: ' + verifiedError.message, 500);
    }

    if ((verifiedCount || 0) === 0) {
        throw new AppError('Sin medio de pago verificado', 403);
    }

    const ofertaActual = await getOfertaActualSupabase(itemIdNum, item.preciobase);

    validateMontoRules({
        montoOfertado: monto_ofertado,
        ofertaActual,
        precioBase: item.preciobase,
        categoriaSubasta: subasta.categoria
    });

    // Validación de cheque principal (si aplica)
    const { data: medioPrincipal } = await supabase
        .from('mediosdepago')
        .select('tipo, limite_garantia, es_principal, verificado')
        .eq('cliente_id', clienteId)
        .eq('verificado', 'si')
        .order('es_principal', { ascending: false })
        .order('identificador', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (medioPrincipal) {
        verificarLimiteCheque({
            medioPago: medioPrincipal,
            ofertaActual: Number(monto_ofertado),
            comision: 0
        });
    }

    const asistente = await getOrCreateAsistenteSupabase({
        clienteId,
        subastaId: subasta.identificador
    });

    // Re-check antes de insertar para reducir carreras (sin transacción explícita en supabase-js)
    const ofertaActualRecheck = await getOfertaActualSupabase(itemIdNum, item.preciobase);
    validateMontoRules({
        montoOfertado: monto_ofertado,
        ofertaActual: ofertaActualRecheck,
        precioBase: item.preciobase,
        categoriaSubasta: subasta.categoria
    });

    const { data: inserted, error: insertError } = await supabase
        .from('pujos')
        .insert({
            asistente: asistente.identificador,
            item: itemIdNum,
            importe: Number(monto_ofertado),
            ganador: 'no'
        })
        .select('identificador')
        .single();

    if (insertError) {
        throw new AppError('Error al registrar puja: ' + insertError.message, 500);
    }

    return {
        mensaje: 'Puja registrada correctamente',
        puja_id: String(inserted.identificador),
        oferta_actual: Number(monto_ofertado),
        posicion: 'GANANDO'
    };
};

const realizarPuja = async ({ authUser, payload }) => {
    if (!isConfigured) {
        return realizarPujaLocal({ authUser, payload });
    }

    return realizarPujaSupabase({ authUser, payload });
};

// Requisito no funcional: hook para emitir websocket tras insertar puja
const emitirNuevaPuja = ({ itemId, monto, numeroPostor }) => {
    return { evento: 'NUEVA_PUJA', itemId, monto, numeroPostor };
};

// Requisito no funcional: cierre de subasta (invocable por cron/manual)
const cerrarSubastaYLiquidar = async () => {
    // Placeholder funcional mínimo. Requiere transacción SQL completa para producción.
    return { mensaje: 'Proceso de cierre disponible para integración transaccional' };
};

// ============================================================
// PUJAS ACTUALES DEL USUARIO
// ============================================================

const obtenerPujasActuales = async ({ authUser }) => {
    if (!authUser) throw new AppError('No autenticado', 401);

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { data: asistencias } = await supabase
        .from('asistentes')
        .select('identificador')
        .eq('cliente', clienteId);

    const asistenciaIds = (asistencias || []).map((a) => a.identificador);
    if (!asistenciaIds.length) return { pujas: [] };

    const { data: pujos } = await supabase
        .from('pujos')
        .select('identificador, item, importe')
        .in('asistente', asistenciaIds);

    if (!pujos?.length) return { pujas: [] };

    const itemIds = [...new Set(pujos.map((p) => p.item))];

    const { data: items } = await supabase
        .from('itemscatalogo')
        .select('identificador, preciobase, catalogo, producto')
        .in('identificador', itemIds);

    const itemsMap = new Map((items || []).map((i) => [i.identificador, i]));
    const catalogoIds = [...new Set((items || []).map((i) => i.catalogo).filter(Boolean))];

    let subastasMap = new Map();
    let subastasActivas = new Set();
    if (catalogoIds.length) {
        const { data: catalogos } = await supabase
            .from('catalogos')
            .select('identificador, subasta')
            .in('identificador', catalogoIds);

        const subastaIds = [...new Set((catalogos || []).map((c) => c.subasta).filter(Boolean))];

        if (subastaIds.length) {
            const { data: subastas } = await supabase
                .from('subastas')
                .select('identificador, nombre, fecha, hora')
                .in('identificador', subastaIds)
                .eq('estado', 'abierta');
            subastasMap = new Map((subastas || []).map((s) => [s.identificador, s]));
            subastasActivas = new Set((subastas || []).map((s) => s.identificador));
        }
    }

    const { data: maxPujas } = await supabase
        .from('pujos')
        .select('item, importe')
        .in('item', itemIds)
        .order('importe', { ascending: false });

    const maxPorItem = new Map();
    for (const mp of maxPujas || []) {
        if (!maxPorItem.has(mp.item)) maxPorItem.set(mp.item, Number(mp.importe));
    }

    const productIds = [...new Set((items || []).map((i) => i.producto).filter(Boolean))];

    const { data: productos } = await supabase
        .from('productos')
        .select('identificador, descripcioncatalogo')
        .in('identificador', productIds);

    const productosMap = new Map((productos || []).map((p) => [p.identificador, p]));

    const { data: fotos } = await supabase
        .from('fotos')
        .select('producto, foto_url')
        .in('producto', productIds);

    const fotosMap = new Map();
    for (const f of fotos || []) {
        if (!fotosMap.has(f.producto)) fotosMap.set(f.producto, []);
        fotosMap.get(f.producto).push(f.foto_url);
    }

    const pujas = [];
    for (const p of pujos || []) {
        const item = itemsMap.get(p.item);
        if (!item) continue;

        let subastaId = null;
        if (item.catalogo) {
            const { data: cat } = await supabase
                .from('catalogos')
                .select('subasta')
                .eq('identificador', item.catalogo)
                .maybeSingle();
            if (cat) subastaId = cat.subasta;
        }

        if (!subastaId || !subastasActivas.has(subastaId)) continue;

        const producto = productosMap.get(item.producto);
        const subasta = subastasMap.get(subastaId);
        const miImporte = Number(p.importe);
        const montoMaximo = maxPorItem.get(p.item) ?? miImporte;

        let fechaFin = null;
        if (subasta?.fecha && subasta?.hora) {
            const inicio = new Date(`${subasta.fecha}T${subasta.hora}`);
            if (!Number.isNaN(inicio.getTime())) {
                fechaFin = new Date(inicio.getTime() + 3600 * 1000).toISOString();
            }
        }

        pujas.push({
            puja_id: String(p.identificador),
            item_id: String(p.item),
            subasta_id: String(subastaId),
            subasta_titulo: subasta?.nombre || `Subasta #${subastaId}`,
            numero_lote: String(p.item).padStart(3, '0'),
            titulo: producto?.descripcioncatalogo || `Ítem #${p.item}`,
            imagen: fotosMap.get(item.producto)?.[0] || '',
            monto_ofertado: miImporte,
            monto_actual: montoMaximo,
            monto_maximo_actual: montoMaximo,
            es_ganadora: miImporte === montoMaximo,
            fecha_fin: fechaFin,
            tiempo_restante: 'EN VIVO',
            estado_subasta: 'EN VIVO'
        });
    }

    return { pujas };
};

// ============================================================
// PUJAS GANADAS DEL USUARIO
// ============================================================

const obtenerPujasGanadas = async ({ authUser }) => {
    if (!authUser) throw new AppError('No autenticado', 401);

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { data: asistencias } = await supabase
        .from('asistentes')
        .select('identificador')
        .eq('cliente', clienteId);

    const asistenciaIds = (asistencias || []).map((a) => a.identificador);
    if (!asistenciaIds.length) return { items: [] };

    const { data: pujos } = await supabase
        .from('pujos')
        .select('identificador, item, importe')
        .in('asistente', asistenciaIds)
        .eq('ganador', 'si');

    if (!pujos?.length) return { items: [] };

    const itemIds = [...new Set(pujos.map((p) => p.item))];

    const { data: items } = await supabase
        .from('itemscatalogo')
        .select('identificador, producto')
        .in('identificador', itemIds);

    const itemsMap = new Map((items || []).map((i) => [i.identificador, i]));
    const productIds = [...new Set((items || []).map((i) => i.producto).filter(Boolean))];

    const { data: productos } = await supabase
        .from('productos')
        .select('identificador, descripcioncatalogo')
        .in('identificador', productIds);

    const productosMap = new Map((productos || []).map((p) => [p.identificador, p]));

    const { data: fotos } = await supabase
        .from('fotos')
        .select('producto, foto_url')
        .in('producto', productIds);

    const fotosMap = new Map();
    for (const f of fotos || []) {
        if (!fotosMap.has(f.producto)) fotosMap.set(f.producto, []);
        fotosMap.get(f.producto).push(f.foto_url);
    }

    const ganados = (pujos || []).map((p) => {
        const item = itemsMap.get(p.item);
        const producto = item ? productosMap.get(item.producto) : null;
        return {
            puja_id: String(p.identificador),
            item_id: String(p.item),
            titulo: producto?.descripcioncatalogo || `Ítem #${p.item}`,
            imagen: (item ? fotosMap.get(item.producto)?.[0] : '') || '',
            monto_ganador: Number(p.importe)
        };
    });

    return { items: ganados };
};

module.exports = {
    obtenerEstadoPujasItem,
    realizarPuja,
    emitirNuevaPuja,
    cerrarSubastaYLiquidar,
    obtenerPujasActuales,
    obtenerPujasGanadas
};