const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
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

    if (isConfigured) {
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

        return {
            mensaje: 'Estado del producto actualizado',
            producto_id: String(data.identificador),
            disponible: data.disponible,
            revisor: data.revisor,
            descripcioncatalogo: data.descripcioncatalogo,
            seguro: data.seguro
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

    return {
        mensaje: 'Estado del producto actualizado',
        producto_id: String(producto.id),
        disponible: producto.disponible,
        revisor: producto.revisor,
        descripcioncatalogo: producto.descripcioncatalogo,
        seguro: producto.seguro
    };
};

const parseFechaHora = (fecha, hora) => {
    if (!fecha || !hora) return null;
    const value = new Date(`${fecha}T${hora}`);
    if (Number.isNaN(value.getTime())) return null;
    return value;
};

const subirPortadaSubasta = async ({ authUser, file, baseUrl }) => {
    if (!file) {
        const err = new AppError('No se recibió ninguna imagen', 400);
        err.codigo = 'SIN_IMAGEN';
        throw err;
    }

    const url = `${baseUrl}/uploads/${file.filename}`;

    return {
        mensaje: 'Imagen subida exitosamente',
        url,
        filename: file.filename
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

    if (fechaHora.getTime() < Date.now()) {
        const err = new AppError('Datos de subasta inválidos', 400);
        err.codigo = 'FECHA_INVALIDA';
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
                estado: 'abierta',
                imagen: imagen || null
            })
            .select('identificador, nombre, fecha, hora, ubicacion, categoria, tematica, estado, imagen')
            .single();

        if (error) {
            throw new AppError('Error al crear subasta: ' + error.message, 500);
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
            imagen: data.imagen
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
        imagen: nuevaSubasta.imagen_portada
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
            .select('identificador, descripcioncatalogo, disponible, revisor, seguro, duenio')
            .or('disponible.is.null,disponible.eq.no')
            .order('identificador', { ascending: true });

        if (error) {
            throw new AppError('Error al obtener productos: ' + error.message, 500);
        }

        return (data || []).map((producto) => ({
            producto_id: producto.identificador,
            descripcioncatalogo: producto.descripcioncatalogo || null,
            disponible: producto.disponible || 'no',
            revisor: producto.revisor || null,
            seguro: producto.seguro || null,
            duenio: producto.duenio || null
        }));
    }

    const productos = Array.isArray(store.productos) ? store.productos : [];
    return productos
        .filter((p) => String(p.disponible || 'no') !== 'si')
        .map((p) => ({
            producto_id: p.id,
            descripcioncatalogo: p.descripcioncatalogo || p.descripcion || null,
            disponible: p.disponible || 'no',
            revisor: p.revisor || null,
            seguro: p.seguro || null,
            duenio: p.duenio || null
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

module.exports = {
    evaluarCliente,
    evaluarProducto,
    crearSubasta,
    subirPortadaSubasta,
    listarClientesPendientes,
    listarProductosPendientes,
    listarClientesRechazados
};
