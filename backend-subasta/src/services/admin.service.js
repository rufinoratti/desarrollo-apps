const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const storage = require('../config/storage');
const { store, nextId } = require('./data.store');

const CATEGORIAS_CLIENTE = ['comun', 'especial', 'plata', 'oro', 'platino'];
const SI_NO = ['si', 'no'];

const normalizeLower = (value) => String(value || '').toLowerCase().trim();

const parseIdNumber = (value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? null : numeric;
};

const evaluarCliente = async ({ id, payload }) => {
    const clienteId = parseIdNumber(id) ?? String(id || '').trim();
    if (!clienteId) {
        throw new AppError('Cliente no encontrado', 404);
    }

    const admitido = normalizeLower(payload?.admitido);
    const categoria = payload?.categoria ? normalizeLower(payload.categoria) : null;

    if (!SI_NO.includes(admitido)) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (admitido === 'si' && (!categoria || !CATEGORIAS_CLIENTE.includes(categoria))) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (admitido === 'no' && categoria) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (isConfigured) {
        const { data, error } = await supabase
            .from('clientes')
            .update({
                admitido,
                categoria: admitido === 'si' ? categoria : null
            })
            .eq('identificador', clienteId)
            .select('identificador, admitido, categoria')
            .maybeSingle();

        if (error) {
            throw new AppError('Error al actualizar cliente: ' + error.message, 500);
        }

        if (!data) {
            throw new AppError('Cliente no encontrado', 404);
        }

        return {
            mensaje: 'Cliente evaluado exitosamente',
            cliente_id: String(data.identificador),
            admitido: data.admitido,
            categoria: data.categoria
        };
    }

    const user = (store.users || []).find((u) => String(u.id) === String(clienteId));
    if (!user) {
        throw new AppError('Cliente no encontrado', 404);
    }

    if (admitido === 'si') {
        user.estado_validacion = 'APROBADO';
        user.categoria = categoria;
        user.bloqueado = false;
    } else {
        user.estado_validacion = 'RECHAZADO';
        user.categoria = null;
        user.bloqueado = true;
    }

    return {
        mensaje: 'Cliente evaluado exitosamente',
        cliente_id: String(user.id),
        admitido,
        categoria: user.categoria
    };
};

const evaluarProducto = async ({ id, payload }) => {
    const productoId = parseIdNumber(id) ?? String(id || '').trim();
    if (!productoId) {
        throw new AppError('Producto no encontrado', 404);
    }

    const disponible = normalizeLower(payload?.disponible);
    const revisor = payload?.revisor;
    const descripcioncatalogo = payload?.descripcioncatalogo || null;
    const seguro = payload?.seguro ?? null;

    if (!SI_NO.includes(disponible) || revisor === undefined || revisor === null) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    let preciobase = null;
    let comision = null;
    let subastaId = null;
    let resolvedCatalogoId = null;

    if (disponible === 'si') {
        preciobase = parseIdNumber(payload?.preciobase);
        comision = parseIdNumber(payload?.comision);
        subastaId = parseIdNumber(payload?.subasta_id);

        if (!preciobase || preciobase <= 0) {
            const err = new AppError('Precio base inválido', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }
        if (!comision || comision <= 0) {
            const err = new AppError('Comisión inválida', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }
        if (!subastaId) {
            const err = new AppError('Debe seleccionar una subasta', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }
    }

    if (isConfigured) {
        if (disponible === 'si') {
            const { data: catalogoRow, error: catalogoError } = await supabase
                .from('catalogos')
                .select('identificador')
                .eq('subasta', subastaId)
                .maybeSingle();

            if (catalogoError) {
                throw new AppError('Error al obtener catálogo: ' + catalogoError.message, 500);
            }

            if (!catalogoRow) {
                const err = new AppError('La subasta no tiene un catálogo asociado', 400);
                err.codigo = 'DATOS_INVALIDOS';
                throw err;
            }

            resolvedCatalogoId = catalogoRow.identificador;
        }

        const { data, error } = await supabase
            .from('productos')
            .update({
                disponible,
                revisor,
                descripcioncatalogo,
                seguro
            })
            .eq('identificador', productoId)
            .select('identificador, disponible, revisor, descripcioncatalogo, seguro')
            .maybeSingle();

        if (error) {
            throw new AppError('Error al actualizar producto: ' + error.message, 500);
        }

        if (!data) {
            throw new AppError('Producto no encontrado', 404);
        }

        if (disponible === 'si') {
            const { data: existingItem } = await supabase
                .from('itemscatalogo')
                .select('identificador')
                .eq('producto', productoId)
                .maybeSingle();

            if (existingItem) {
                const { error: updateItemError } = await supabase
                    .from('itemscatalogo')
                    .update({
                        catalogo: resolvedCatalogoId,
                        preciobase,
                        comision,
                        subastado: 'no'
                    })
                    .eq('identificador', existingItem.identificador);

                if (updateItemError) {
                    throw new AppError('Error al actualizar ítem de catálogo: ' + updateItemError.message, 500);
                }
            } else {
                const { error: insertItemError } = await supabase
                    .from('itemscatalogo')
                    .insert({
                        catalogo: resolvedCatalogoId,
                        producto: productoId,
                        preciobase,
                        comision,
                        subastado: 'no'
                    });

                if (insertItemError) {
                    throw new AppError('Error al crear ítem de catálogo: ' + insertItemError.message, 500);
                }
            }
        }

        return {
            mensaje: 'Estado del producto actualizado',
            producto_id: String(data.identificador),
            disponible: data.disponible,
            revisor: data.revisor,
            descripcioncatalogo: data.descripcioncatalogo,
            seguro: data.seguro,
            preciobase: disponible === 'si' ? preciobase : null,
            comision: disponible === 'si' ? comision : null,
            subasta_id: disponible === 'si' ? subastaId : null
        };
    }

    const productos = store.productos || [];
    const producto = productos.find((p) => String(p.id) === String(productoId));
    if (!producto) {
        throw new AppError('Producto no encontrado', 404);
    }

    producto.disponible = disponible;
    producto.revisor = revisor;
    producto.descripcioncatalogo = descripcioncatalogo;
    producto.seguro = seguro;

    if (disponible === 'si') {
        const catalogos = store.catalogos || [];
        const catalogo = catalogos.find((c) => Number(c.subasta) === Number(subastaId));
        if (!catalogo) {
            const err = new AppError('La subasta no tiene un catálogo asociado', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }

        const items = store.itemscatalogo || [];
        const existingIdx = items.findIndex((i) => String(i.producto) === String(productoId));
        if (existingIdx >= 0) {
            items[existingIdx] = {
                ...items[existingIdx],
                catalogo: catalogo.id,
                preciobase,
                comision,
                subastado: 'no'
            };
        } else {
            const itemId = nextId('i', 'item');
            items.push({
                id: itemId,
                catalogo: catalogo.id,
                producto: productoId,
                preciobase,
                comision,
                subastado: 'no'
            });
        }
        store.itemscatalogo = items;
    }

    return {
        mensaje: 'Estado del producto actualizado',
        producto_id: String(producto.id),
        disponible: producto.disponible,
        revisor: producto.revisor,
        descripcioncatalogo: producto.descripcioncatalogo,
        seguro: producto.seguro,
        preciobase: disponible === 'si' ? preciobase : null,
        comision: disponible === 'si' ? comision : null,
        subasta_id: disponible === 'si' ? subastaId : null
    };
};

const parseFechaHora = (fecha, hora) => {
    if (!fecha || !hora) return null;
    const value = new Date(`${fecha}T${hora}`);
    if (Number.isNaN(value.getTime())) return null;
    return value;
};

const subirPortadaSubasta = async ({ authUser, file }) => {
    if (!file) {
        const err = new AppError('No se recibió ninguna imagen', 400);
        err.codigo = 'SIN_IMAGEN';
        throw err;
    }
    if (!storage.isStorageConfigured()) {
        throw new AppError('Supabase Storage no está configurado. Revisá SUPABASE_SERVICE_ROLE_KEY y SUPABASE_BUCKET_MEDIA en .env', 503);
    }

    const url = await storage.uploadBuffer({
        folder: 'portadas',
        fieldname: file.fieldname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname
    });

    return {
        mensaje: 'Imagen subida exitosamente',
        url,
        path: storage.extractPathFromUrl(url)
    };
};

const crearSubasta = async ({ payload }) => {
    const {
        nombre,
        fecha,
        hora,
        ubicacion,
        capacidadasistentes,
        tienedeposito,
        seguridadpropia,
        categoria,
        tematica,
        imagen
    } = payload || {};

    if (!nombre || !fecha || !hora || !categoria || tematica === undefined || tematica === null) {
        const err = new AppError('Datos de subasta inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    const fechaHora = parseFechaHora(fecha, hora);
    if (!fechaHora) {
        const err = new AppError('Datos de subasta inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    const tieneDeposito = tienedeposito ? normalizeLower(tienedeposito) : null;
    const seguridad = seguridadpropia ? normalizeLower(seguridadpropia) : null;

    if (tieneDeposito && !SI_NO.includes(tieneDeposito)) {
        const err = new AppError('Datos de subasta inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (seguridad && !SI_NO.includes(seguridad)) {
        const err = new AppError('Datos de subasta inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (isConfigured) {
        const { data, error } = await supabase
            .from('subastas')
            .insert({
                nombre: String(nombre).trim(),
                fecha,
                hora,
                ubicacion: ubicacion || null,
                capacidadasistentes: capacidadasistentes ?? null,
                tienedeposito: tieneDeposito || null,
                seguridadpropia: seguridad || null,
                categoria: String(categoria).trim(),
                tematica,
                estado: fechaHora.getTime() > Date.now() ? 'cerrada' : 'abierta',
                imagen: imagen || null
            })
            .select('identificador, nombre, fecha, hora, ubicacion, categoria, tematica, estado, imagen')
            .single();

        if (error) {
            throw new AppError('Error al crear subasta: ' + error.message, 500);
        }

        const catalogoNombre = String(nombre).trim();
        const { data: responsable, error: respError } = await supabase
            .from('empleados')
            .select('identificador')
            .ilike('cargo', '%resp%')
            .limit(1)
            .maybeSingle();

        if (respError) {
            throw new AppError('Error al obtener responsable: ' + respError.message, 500);
        }

        const { data: catalogo, error: catError } = await supabase
            .from('catalogos')
            .insert({
                descripcion: catalogoNombre,
                subasta: data.identificador,
                responsable: responsable?.identificador || data.identificador
            })
            .select('identificador')
            .single();

        if (catError) {
            throw new AppError('Error al crear catálogo: ' + catError.message, 500);
        }

        return {
            mensaje: 'Subasta creada exitosamente',
            subasta_id: String(data.identificador),
            nombre: data.nombre,
            fecha: data.fecha,
            hora: data.hora,
            ubicacion: data.ubicacion,
            categoria: data.categoria,
            tematica: data.tematica,
            estado: data.estado,
            imagen: data.imagen,
            catalogo_id: catalogo.identificador
        };
    }

    const subastas = store.subastas || [];
    const categoriaTematica = (store.categorias || []).find(
        (c) => String(c.id) === String(tematica)
    );

    const subastaId = nextId('s', 'subasta');
    const estado = fechaHora.getTime() > Date.now() ? 'PROXIMAMENTE' : 'EN_VIVO';

    const nuevaSubasta = {
        id: subastaId,
        titulo: String(nombre).trim(),
        categoria_id: Number(tematica),
        categoria_nombre: categoriaTematica?.nombre || null,
        nivel_acceso: String(categoria).trim(),
        estado,
        moneda: 'ARS',
        imagen_portada: imagen || null,
        ubicacion: ubicacion || 'Ubicación no definida',
        rematador: null,
        fecha_inicio: fechaHora.toISOString(),
        fecha_fin: null,
        precio_base_minimo: null,
        total_items: 0,
        items: []
    };

    subastas.push(nuevaSubasta);
    store.subastas = subastas;

    const catalogos = store.catalogos || [];
    const catalogoId = nextId('c', 'catalogo');
    catalogos.push({ id: catalogoId, descripcion: String(nombre).trim(), subasta: subastaId, responsable: null });
    store.catalogos = catalogos;

    return {
        mensaje: 'Subasta creada exitosamente',
        subasta_id: subastaId,
        nombre: nuevaSubasta.titulo,
        fecha,
        hora,
        ubicacion: nuevaSubasta.ubicacion,
        categoria: nuevaSubasta.nivel_acceso,
        tematica: nuevaSubasta.categoria_id,
        estado: nuevaSubasta.estado,
        imagen: nuevaSubasta.imagen_portada,
        catalogo_id: catalogoId
    };
};

const listarClientesPendientes = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('clientes')
            .select('identificador, admitido, categoria, numeropais, personas (nombre, documento, email)')
            .is('admitido', null)
            .order('identificador', { ascending: true });

        if (error) {
            throw new AppError('Error al obtener clientes: ' + error.message, 500);
        }

        return (data || []).map((cliente) => ({
            cliente_id: cliente.identificador,
            nombre: cliente.personas?.nombre || null,
            documento: cliente.personas?.documento || null,
            email: cliente.personas?.email || null,
            admitido: cliente.admitido || 'no',
            categoria: cliente.categoria || null,
            numeropais: cliente.numeropais || null
        }));
    }

    const usuarios = Array.isArray(store.users) ? store.users : [];
    return usuarios
        .filter((u) => String(u.estado_validacion || '').toUpperCase() === 'EN_REVISION')
        .map((u) => ({
            cliente_id: u.id,
            nombre: u.nombre_completo || u.nombre || null,
            documento: u.documento || null,
            email: u.email || null,
            admitido: u.estado_validacion === 'APROBADO' ? 'si' : 'no',
            categoria: u.categoria || null,
            numeropais: u.pais_residencia || null
        }));
};

const listarProductosPendientes = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('productos')
            .select('identificador, descripcioncatalogo, descripcioncompleta, disponible, revisor, seguro, duenio, preciosugerido')
            .is('disponible', null)
            .order('identificador', { ascending: true });

        if (error) {
            throw new AppError('Error al obtener productos: ' + error.message, 500);
        }

        const productoIds = [...new Set((data || []).map((producto) => producto.identificador).filter(Boolean))];
        let itemsMap = new Map();
        let fotosMap = new Map();

        if (productoIds.length) {
            const { data: items, error: itemsError } = await supabase
                .from('itemscatalogo')
                .select('producto, preciobase, comision')
                .in('producto', productoIds);

            if (itemsError) {
                throw new AppError('Error al obtener ítems del catálogo: ' + itemsError.message, 500);
            }

            for (const item of items || []) {
                if (!itemsMap.has(item.producto)) {
                    itemsMap.set(item.producto, item);
                }
            }

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
        }

        return (data || []).map((producto) => {
            const item = itemsMap.get(producto.identificador);
            return {
                producto_id: producto.identificador,
                descripcioncatalogo: producto.descripcioncatalogo || null,
                descripcioncompleta: producto.descripcioncompleta || null,
                disponible: producto.disponible || 'no',
                revisor: producto.revisor || null,
                seguro: producto.seguro || null,
                duenio: producto.duenio || null,
                preciosugerido: producto.preciosugerido ?? null,
                preciobase: item?.preciobase ?? null,
                comision: item?.comision ?? null,
                fotos: fotosMap.get(producto.identificador) || []
            };
        });
    }

    const productos = Array.isArray(store.productos) ? store.productos : [];
    return productos
        .filter((p) => p.disponible === null || p.disponible === undefined)
        .map((p) => ({
            producto_id: p.id,
            descripcioncatalogo: p.descripcioncatalogo || p.descripcion || null,
            descripcioncompleta: p.descripcioncompleta || p.descripcion || null,
            disponible: p.disponible || 'no',
            revisor: p.revisor || null,
            seguro: p.seguro || null,
            duenio: p.duenio || null,
            preciosugerido: p.preciosugerido || null,
            preciobase: p.preciobase || p.precio_base || null,
            comision: p.comision || null,
            fotos: p.imagenes || []
        }));
};

const listarClientesRechazados = async () => {
    if (isConfigured) {
        const { data, error } = await supabase
            .from('clientes')
            .select('identificador, admitido, categoria, numeropais, personas (nombre, documento, email)')
            .eq('admitido', 'no')
            .order('identificador', { ascending: true });

        if (error) {
            throw new AppError('Error al obtener clientes rechazados: ' + error.message, 500);
        }

        return (data || []).map((cliente) => ({
            cliente_id: cliente.identificador,
            nombre: cliente.personas?.nombre || null,
            documento: cliente.personas?.documento || null,
            email: cliente.personas?.email || null,
            admitido: cliente.admitido || 'no',
            categoria: cliente.categoria || null,
            numeropais: cliente.numeropais || null
        }));
    }

    const usuarios = Array.isArray(store.users) ? store.users : [];
    return usuarios
        .filter((u) => String(u.estado_validacion || '').toUpperCase() === 'RECHAZADO')
        .map((u) => ({
            cliente_id: u.id,
            nombre: u.nombre_completo || u.nombre || null,
            documento: u.documento || null,
            email: u.email || null,
            admitido: 'no',
            categoria: u.categoria || null,
            numeropais: u.pais_residencia || null
        }));
};

const listarSubastas = async () => {
    if (!isConfigured) {
        return (store.subastas || []).map((s) => ({
            id: s.id,
            nombre: s.titulo || `Subasta #${s.id}`,
            fecha: s.fecha_inicio || null,
            estado: s.estado || null
        }));
    }

    const { data, error } = await supabase
        .from('subastas')
        .select('identificador, nombre, fecha, estado, tematica')
        .order('fecha', { ascending: false });

    if (error) throw new AppError('Error al obtener subastas: ' + error.message, 500);

    return (data || []).map((s) => ({
        id: s.identificador,
        nombre: s.nombre || `Subasta #${s.identificador}`,
        fecha: s.fecha || null,
        estado: s.estado || null,
        tematica: s.tematica || null
    }));
};

const listarCatalogosPorSubasta = async ({ subastaId }) => {
    const id = parseIdNumber(subastaId);
    if (!id) throw new AppError('Subasta inválida', 400);

    if (!isConfigured) {
        return (store.catalogos || []).filter((c) => Number(c.subasta) === id).map((c) => ({
            id: c.id,
            descripcion: c.descripcion,
            subasta: c.subasta,
            responsable: c.responsable
        }));
    }

    const { data, error } = await supabase
        .from('catalogos')
        .select('identificador, descripcion, subasta, responsable')
        .eq('subasta', id)
        .order('identificador', { ascending: true });

    if (error) throw new AppError('Error al obtener catálogos: ' + error.message, 500);

    return (data || []).map((c) => ({
        id: c.identificador,
        descripcion: c.descripcion,
        subasta: c.subasta,
        responsable: c.responsable
    }));
};

const crearCatalogo = async ({ payload }) => {
    const subastaId = parseIdNumber(payload?.subasta_id);
    const descripcion = String(payload?.descripcion || '').trim();
    const responsable = parseIdNumber(payload?.responsable);

    if (!subastaId || !descripcion || !responsable) {
        const err = new AppError('Faltan datos para crear el catálogo', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (!isConfigured) {
        const catalogos = store.catalogos || [];
        const id = nextId('c', 'catalogo');
        const nuevo = { id, descripcion, subasta: subastaId, responsable };
        catalogos.push(nuevo);
        store.catalogos = catalogos;
        return { id, descripcion, subasta: subastaId, responsable };
    }

    const { data, error } = await supabase
        .from('catalogos')
        .insert({
            descripcion,
            subasta: subastaId,
            responsable
        })
        .select('identificador, descripcion, subasta, responsable')
        .single();

    if (error) throw new AppError('Error al crear catálogo: ' + error.message, 500);

    return {
        id: data.identificador,
        descripcion: data.descripcion,
        subasta: data.subasta,
        responsable: data.responsable
    };
};

const obtenerOpcionesAdmin = async () => {
    if (!isConfigured) {
        return { revisores: [], empleados: [] };
    }

    let revisoresData, empleadosData;

    const revisoresQuery = supabase
        .from('empleados')
        .select('identificador, cargo, nombre')
        .ilike('cargo', '%revisor%');

    const empleadosQuery = supabase
        .from('empleados')
        .select('identificador, nombre, cargo')
        .ilike('cargo', '%resp%')
        .order('nombre', { ascending: true });

    const { data: rData, error: rError } = await revisoresQuery;
    if (rError && /column .*nombre/i.test(rError.message || '')) {
        const { data: fallback, error: fbError } = await supabase
            .from('empleados')
            .select('identificador, cargo')
            .ilike('cargo', '%revisor%');
        if (fbError) throw new AppError('Error al obtener revisores: ' + fbError.message, 500);
        revisoresData = fallback;
    } else if (rError) {
        throw new AppError('Error al obtener revisores: ' + rError.message, 500);
    } else {
        revisoresData = rData;
    }

    const { data: eData, error: eError } = await empleadosQuery;
    if (eError && /column .*nombre/i.test(eError.message || '')) {
        const { data: fallback, error: fbError } = await supabase
            .from('empleados')
            .select('identificador, cargo')
            .ilike('cargo', '%resp%');
        if (fbError) throw new AppError('Error al obtener empleados: ' + fbError.message, 500);
        empleadosData = fallback;
    } else if (eError) {
        throw new AppError('Error al obtener empleados: ' + eError.message, 500);
    } else {
        empleadosData = eData;
    }

    return {
        revisores: (revisoresData || []).map((row) => ({
            id: row.identificador,
            nombre: row.nombre || row.cargo || `Revisor ${row.identificador}`
        })),
        empleados: (empleadosData || []).map((row) => ({
            id: row.identificador,
            nombre: row.nombre || row.cargo || `Empleado ${row.identificador}`
        }))
    };
};

module.exports = {
    evaluarCliente,
    evaluarProducto,
    crearSubasta,
    subirPortadaSubasta,
    listarClientesPendientes,
    listarProductosPendientes,
    listarClientesRechazados,
    obtenerOpcionesAdmin,
    listarSubastas,
    listarCatalogosPorSubasta,
    crearCatalogo
};
