const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store } = require('./data.store');

const sanitizePerfilPayload = (payload = {}) => {
    const sanitized = {};

    if (payload.nombre_completo !== undefined) {
        const n = String(payload.nombre_completo).trim();
        if (!n) {
            const err = new AppError('Datos inválidos', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }
        sanitized.nombre_completo = n;
    }

    if (payload.direccion !== undefined) {
        const d = String(payload.direccion).trim();
        if (!d) {
            const err = new AppError('Datos inválidos', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }
        sanitized.direccion = d;
    }

    if (payload.telefono !== undefined) {
        sanitized.telefono = String(payload.telefono).trim();
    }

    return sanitized;
};

const parseCuentaCobro = (medio) => {
    if (!medio) return null;

    return {
        entidad_bancaria: medio.entidad || null,
        numero_cbu: medio.detalles_enmascarados || null,
        alias_pago: null,
        estado_verificacion: String(medio.verificado || '').toLowerCase() === 'si' ? 'VERIFICADA' : 'EN_REVISION',
        es_principal: String(medio.es_principal || '').toLowerCase() === 'si'
    };
};

const getLocalUser = (authUser) => {
    const user = (store.users || []).find((u) => String(u.id) === String(authUser?.id));
    if (!user) {
        throw new AppError('No autenticado', 401);
    }
    return user;
};

const resolveClienteIdSupabase = async (authUser) => {
    const asNumber = Number(authUser?.id);
    if (!Number.isNaN(asNumber)) {
        return asNumber;
    }

    if (!authUser?.email) {
        throw new AppError('No autenticado', 401);
    }

    // Fallback para esquemas que aún no tienen email en personas
    const queryWithEmail = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', authUser.email)
        .maybeSingle();

    if (!queryWithEmail.error) {
        if (!queryWithEmail.data?.identificador) {
            throw new AppError('No autenticado', 401);
        }
        return queryWithEmail.data.identificador;
    }

    throw new AppError('No autenticado', 401);
};

const fetchPersonaClienteSupabase = async (clienteId) => {
    let personaData = null;
    let personaError = null;

    ({ data: personaData, error: personaError } = await supabase
        .from('personas')
        .select('identificador, documento, nombre, direccion, email, foto, telefono, foto_perfil')
        .eq('identificador', clienteId)
        .maybeSingle());

    if (personaError && /column .*foto_perfil/i.test(personaError.message || '')) {
        ({ data: personaData, error: personaError } = await supabase
            .from('personas')
            .select('identificador, documento, nombre, direccion, email, foto, telefono')
            .eq('identificador', clienteId)
            .maybeSingle());
    }

    if (personaError && /column .*telefono/i.test(personaError.message || '')) {
        ({ data: personaData, error: personaError } = await supabase
            .from('personas')
            .select('identificador, documento, nombre, direccion, email, foto')
            .eq('identificador', clienteId)
            .maybeSingle());
    }

    if (personaError && /column .*email/i.test(personaError.message || '')) {
        ({ data: personaData, error: personaError } = await supabase
            .from('personas')
            .select('identificador, documento, nombre, direccion, foto')
            .eq('identificador', clienteId)
            .maybeSingle());
    }

    if (personaError) {
        throw new AppError('Error al obtener datos personales: ' + personaError.message, 500);
    }

    let clienteData = null;
    let clienteError = null;

    ({ data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('categoria, numeropais, admitido')
        .eq('identificador', clienteId)
        .maybeSingle());

    if (clienteError && /column .*admitido/i.test(clienteError.message || '')) {
        ({ data: clienteData, error: clienteError } = await supabase
            .from('clientes')
            .select('categoria, numeropais')
            .eq('identificador', clienteId)
            .maybeSingle());
    }

    if (clienteError) {
        throw new AppError('Error al obtener datos de cliente: ' + clienteError.message, 500);
    }

    return {
        persona: personaData,
        cliente: clienteData
    };
};

const obtenerPerfil = async (authUser) => {
    if (!isConfigured) {
        const user = getLocalUser(authUser);
        const cuentaBancaria = (user.medios_pago || []).find((m) => {
            const tipo = String(m.tipo || '').toLowerCase();
            return tipo === 'cuenta_bancaria' || tipo === 'cuenta bancaria';
        }) || null;

        const esDuenio = (store.duenios || []).some((d) => String(d.identificador) === String(user.id));

        return {
            es_duenio: esDuenio,
            usuario_id: String(user.id),
            nombre_completo: user.nombre_completo || user.nombre || null,
            categoria: String(user.categoria || 'comun').toUpperCase(),
            foto_url: user.foto_perfil || null,
            datos_personales: {
                documento: user.documento || null,
                nombre: user.nombre_completo || user.nombre || null,
                direccion: user.domicilio_legal || user.direccion || null,
                email: user.email || null,
                telefono: user.telefono || null,
                pais_residencia: user.pais_residencia ? String(user.pais_residencia) : null,
                foto: user.foto || null
            },
            cuenta_cobro: parseCuentaCobro(cuentaBancaria)
        };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    const { persona, cliente } = await fetchPersonaClienteSupabase(clienteId);

    const { data: cuenta, error: cuentaError } = await supabase
        .from('mediosdepago')
        .select('identificador, tipo, entidad, verificado, es_principal, detalles_enmascarados')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'cuenta_bancaria')
        .order('identificador', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (cuentaError) {
        throw new AppError('Error al obtener cuenta de cobro: ' + cuentaError.message, 500);
    }

    const { data: duenioRow } = await supabase
        .from('duenios')
        .select('identificador')
        .eq('identificador', clienteId)
        .maybeSingle();

    return {
        es_duenio: !!duenioRow,
        usuario_id: String(persona?.identificador || clienteId),
        nombre_completo: persona?.nombre || null,
        categoria: String(cliente?.categoria || 'comun').toUpperCase(),
        foto_url: persona?.foto_perfil || null,
        datos_personales: {
            documento: persona?.documento || null,
            nombre: persona?.nombre || null,
            direccion: persona?.direccion || null,
            email: persona?.email || null,
            telefono: persona?.telefono || null,
            pais_residencia: cliente?.numeropais ? String(cliente.numeropais) : null,
            foto: persona?.foto || null
        },
        cuenta_cobro: parseCuentaCobro(cuenta)
    };
};

const actualizarPerfil = async (authUser, payload) => {
    const sanitized = sanitizePerfilPayload(payload);

    if (Object.keys(sanitized).length === 0) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (!isConfigured) {
        const user = getLocalUser(authUser);

        if (sanitized.nombre_completo !== undefined) {
            user.nombre_completo = sanitized.nombre_completo;
            user.nombre = sanitized.nombre_completo;
        }

        if (sanitized.direccion !== undefined) {
            user.direccion = sanitized.direccion;
            user.domicilio_legal = sanitized.direccion;
        }

        if (sanitized.telefono !== undefined) {
            user.telefono = sanitized.telefono;
        }

        const updated = await obtenerPerfil(authUser);
        return { mensaje: 'Perfil actualizado correctamente', ...updated };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const updateDb = {};
    if (sanitized.nombre_completo !== undefined) {
        updateDb.nombre = sanitized.nombre_completo;
    }
    if (sanitized.direccion !== undefined) {
        updateDb.direccion = sanitized.direccion;
    }
    if (sanitized.telefono !== undefined) {
        updateDb.telefono = sanitized.telefono;
    }

    const { error } = await supabase
        .from('personas')
        .update(updateDb)
        .eq('identificador', clienteId);

    if (error) {
        // Si el error es columna inexistente, reintentar sin telefono
        if (sanitized.telefono !== undefined && /column .*telefono/i.test(error.message || '')) {
            delete updateDb.telefono;
            const { error: retryError } = await supabase
                .from('personas')
                .update(updateDb)
                .eq('identificador', clienteId);

            if (retryError) {
                throw new AppError('Error al actualizar perfil: ' + retryError.message, 500);
            }
        } else {
            throw new AppError('Error al actualizar perfil: ' + error.message, 500);
        }
    }

    const updated = await obtenerPerfil(authUser);
    return { mensaje: 'Perfil actualizado correctamente', ...updated };
};

const subirFotoPerfil = async (authUser, file) => {
    if (!file) {
        throw new AppError('No se recibió ninguna imagen', 400);
    }

    const filename = file.filename;

    if (!isConfigured) {
        const user = getLocalUser(authUser);
        user.foto_perfil = filename;
        const updated = await obtenerPerfil(authUser);
        return { mensaje: 'Foto de perfil actualizada', ...updated };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { error: updateError } = await supabase
        .from('personas')
        .update({ foto_perfil: filename })
        .eq('identificador', clienteId);

    if (updateError) {
        throw new AppError('Error al guardar foto de perfil: ' + updateError.message, 500);
    }

    const updated = await obtenerPerfil(authUser);
    return { mensaje: 'Foto de perfil actualizada', ...updated };
};

const eliminarFotoPerfil = async (authUser) => {
    if (!isConfigured) {
        const user = getLocalUser(authUser);
        user.foto_perfil = null;
        const updated = await obtenerPerfil(authUser);
        return { mensaje: 'Foto de perfil eliminada', ...updated };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { error: updateError } = await supabase
        .from('personas')
        .update({ foto_perfil: null })
        .eq('identificador', clienteId);

    if (updateError) {
        throw new AppError('Error al eliminar foto de perfil: ' + updateError.message, 500);
    }

    const updated = await obtenerPerfil(authUser);
    return { mensaje: 'Foto de perfil eliminada', ...updated };
};

const obtenerEstadisticasLocal = (authUser) => {
    const user = getLocalUser(authUser);

    const asistencias = (store.asistentes || []).filter((a) => String(a.cliente_id) === String(user.id));
    const subastasParticipadas = new Set(asistencias.map((a) => a.subasta_id)).size;

    const asistenciaIds = new Set(asistencias.map((a) => String(a.id)));

    const pujasUsuario = (store.bids || []).filter((b) => {
        if (b.asistente_id) return asistenciaIds.has(String(b.asistente_id));
        return String(b.usuario_id) === String(user.id);
    });

    const lotesGanados = pujasUsuario.filter((p) => String(p.ganador || 'no') === 'si').length;
    const totalPujas = pujasUsuario.length;

    const compras = (store.registroDeSubasta || []).filter((r) => String(r.cliente_id || r.cliente) === String(user.id));
    const inversionTotal = compras.reduce((acc, c) => acc + Number(c.importe || 0), 0);

    return {
        subastas_participadas: subastasParticipadas,
        lotes_ganados: lotesGanados,
        total_pujas: totalPujas,
        inversion_total: Number(inversionTotal || 0)
    };
};

const obtenerEstadisticasSupabase = async (authUser) => {
    const clienteId = await resolveClienteIdSupabase(authUser);

    // REQ-6.3.1: Subastas participadas (DISTINCT)
    const { data: asistenciasRows, error: e1 } = await supabase
        .from('asistentes')
        .select('subasta')
        .eq('cliente', clienteId);

    if (e1) throw new AppError('Error al obtener estadísticas: ' + e1.message, 500);

    const subastasParticipadas = new Set((asistenciasRows || []).map((r) => r.subasta)).size;

    const { data: pujasUsuarioRows, error: pujasError } = await supabase
        .from('pujos')
        .select('ganador, importe, asistentes!inner(cliente)')
        .eq('asistentes.cliente', clienteId);

    if (pujasError) throw new AppError('Error al obtener estadísticas: ' + pujasError.message, 500);

    const totalPujas = (pujasUsuarioRows || []).length;
    const ganadas = (pujasUsuarioRows || []).filter((p) => String(p.ganador) === 'si');
    const lotesGanados = ganadas.length;
    const inversionTotal = ganadas.reduce((acc, p) => acc + Number(p.importe || 0), 0);

    return {
        subastas_participadas: Number(subastasParticipadas || 0),
        lotes_ganados: Number(lotesGanados || 0),
        total_pujas: Number(totalPujas || 0),
        inversion_total: Number(inversionTotal || 0)
    };
};

const obtenerEstadisticas = async (authUser) => {
    if (!isConfigured) {
        return obtenerEstadisticasLocal(authUser);
    }

    return obtenerEstadisticasSupabase(authUser);
};

const obtenerRestriccionesLocal = (authUser) => {
    const user = getLocalUser(authUser);

    const morosa = (store.registroDeSubasta || []).find((r) => {
        const sameClient = String(r.cliente_id || r.cliente) === String(user.id);
        const impago = String(r.estado_cobro || '').toLowerCase() === 'impago';
        return sameClient && impago;
    });

    if (!morosa) {
        return {
            restriccion_activa: false,
            motivo: null,
            monto_regularizar: 0
        };
    }

    const monto = Number(morosa.importe || 0);
    const multa = Number((monto * 0.10).toFixed(2));

    return {
        restriccion_activa: true,
        motivo: 'Falta de pago en subasta. Debe regularizar su situación para continuar operando.',
        monto_regularizar: multa
    };
};

const obtenerRestriccionesSupabase = async (authUser) => {
    const clienteId = await resolveClienteIdSupabase(authUser);

    // Tu schema de `registrodesubasta` no incluye estado de cobro.
    // Sin un campo de estado (o tabla de pagos), no se puede inferir mora desde BD.
    // Retornamos "sin restricción" y dejamos la detección de mora para el modo local.
    const { data, error } = await supabase
        .from('registrodesubasta')
        .select('identificador')
        .eq('cliente', clienteId)
        .limit(1);

    if (error) {
        throw new AppError('Error al obtener restricciones: ' + error.message, 500);
    }

    if (!data || data.length === 0) {
        return {
            restriccion_activa: false,
            motivo: null,
            monto_regularizar: 0
        };
    }

    return {
        restriccion_activa: false,
        motivo: null,
        monto_regularizar: 0
    };
};

const obtenerRestricciones = async (authUser) => {
    if (!isConfigured) {
        return obtenerRestriccionesLocal(authUser);
    }

    return obtenerRestriccionesSupabase(authUser);
};

const construirEstadoCuenta = (data) => {
    const {
        usuario,
        verificacion,
        completitud,
        cuenta_cobro,
        es_duenio,
        restriccion,
        timestamp
    } = data;

    const items = [];
    let puntosOk = 0;
    let puntosPendientes = 0;
    let puntosAdvertencia = 0;
    const totalPuntos = 9;

    items.push({
        id: 'identidad',
        label: 'Identidad verificada',
        status: completitud.documento ? 'OK' : 'PENDIENTE',
        detalle: completitud.documento
            ? `DNI ${completitud.documento}`.trim()
            : 'Cargá tu documento para operar'
    });
    if (completitud.documento) puntosOk++; else puntosPendientes++;

    items.push({
        id: 'email',
        label: 'Email registrado',
        status: completitud.email ? 'OK' : 'PENDIENTE',
        detalle: completitud.email || 'Sin email'
    });
    if (completitud.email) puntosOk++; else puntosPendientes++;

    items.push({
        id: 'telefono',
        label: 'Teléfono registrado',
        status: completitud.telefono ? 'OK' : 'PENDIENTE',
        detalle: completitud.telefono || 'Agregá un teléfono de contacto'
    });
    if (completitud.telefono) puntosOk++; else puntosPendientes++;

    items.push({
        id: 'direccion',
        label: 'Domicilio registrado',
        status: completitud.direccion ? 'OK' : 'PENDIENTE',
        detalle: completitud.direccion || 'Cargá tu dirección'
    });
    if (completitud.direccion) puntosOk++; else puntosPendientes++;

    items.push({
        id: 'categoria',
        label: 'Categoría asignada',
        status: verificacion.categoria ? 'OK' : 'PENDIENTE',
        detalle: verificacion.categoria
            ? `Nivel ${verificacion.categoria}`
            : 'Pendiente de aprobación'
    });
    verificacion.categoria ? puntosOk++ : puntosPendientes++;

    if (cuenta_cobro) {
        items.push({
            id: 'banco',
            label: 'Cuenta bancaria',
            status: cuenta_cobro.estado_verificacion === 'VERIFICADA' ? 'OK' : 'PENDIENTE',
            detalle: `${cuenta_cobro.entidad_bancaria || 'Banco'} · ${cuenta_cobro.numero_cbu || '—'}${cuenta_cobro.estado_verificacion === 'VERIFICADA' ? ' (Verificada)' : ' (En revisión)'}`
        });
        cuenta_cobro.estado_verificacion === 'VERIFICADA' ? puntosOk++ : puntosPendientes++;
    } else {
        items.push({
            id: 'banco',
            label: 'Cuenta bancaria',
            status: 'PENDIENTE',
            detalle: 'Agregá un medio de cobro para recibir pagos'
        });
        puntosPendientes++;
    }

    items.push({
        id: 'duenio',
        label: 'Registrada como dueño',
        status: es_duenio ? 'OK' : 'PENDIENTE',
        detalle: es_duenio
            ? 'Habilitada para vender en subastas'
            : 'Opcional · Te permite publicar productos'
    });
    es_duenio ? puntosOk++ : puntosPendientes++;

    items.push({
        id: 'deuda',
        label: 'Sin deudas pendientes',
        status: restriccion.activa ? 'ADVERTENCIA' : 'OK',
        detalle: restriccion.activa
            ? `Adeuda ${restriccion.monto_regularizar.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })}`
            : 'Sin movimientos impagos'
    });
    if (restriccion.activa) {
        puntosAdvertencia++;
    } else {
        puntosOk++;
    }

    items.push({
        id: 'estado',
        label: 'Cuenta habilitada',
        status: verificacion.admitido === 'si' ? 'OK' : (verificacion.admitido === 'no' ? 'ADVERTENCIA' : 'PENDIENTE'),
        detalle: verificacion.admitido === 'si'
            ? 'Aprobada por administración'
            : verificacion.admitido === 'no'
                ? 'Cuenta rechazada · contactanos'
                : 'En revisión por administración'
    });
    if (verificacion.admitido === 'si') {
        puntosOk++;
    } else if (verificacion.admitido === 'no') {
        puntosAdvertencia++;
    } else {
        puntosPendientes++;
    }

    let estadoGeneral = 'CORRECTO';
    let mensajePrincipal = 'Tu cuenta está verificada y al día';

    if (verificacion.admitido === 'no') {
        estadoGeneral = 'BLOQUEADO';
        mensajePrincipal = 'Tu cuenta está bloqueada. Contactá a soporte.';
    } else if (restriccion.activa) {
        estadoGeneral = 'CON_DEUDA';
        mensajePrincipal = 'Tenés una deuda pendiente. Regularizá para operar.';
    } else if (verificacion.admitido === null) {
        estadoGeneral = 'EN_REVISION';
        mensajePrincipal = 'Tu cuenta está en revisión por administración.';
    }

    return {
        estado_general: estadoGeneral,
        mensaje_principal: mensajePrincipal,
        timestamp_verificacion: timestamp,
        usuario: {
            id: String(usuario.id),
            nombre_completo: usuario.nombre_completo || null,
            email: usuario.email || null,
            categoria: usuario.categoria || null,
            foto_url: usuario.foto_url || null
        },
        verificacion: {
            admitido: verificacion.admitido,
            categoria: verificacion.categoria,
            bloqueado: verificacion.bloqueado
        },
        cuenta_cobro: cuenta_cobro
            ? {
                entidad_bancaria: cuenta_cobro.entidad_bancaria,
                numero_cbu: cuenta_cobro.numero_cbu,
                estado_verificacion: cuenta_cobro.estado_verificacion,
                es_principal: cuenta_cobro.es_principal
            }
            : null,
        es_duenio: es_duenio,
        items: items,
        resumen: {
            puntos_ok: puntosOk,
            puntos_pendientes: puntosPendientes,
            puntos_advertencia: puntosAdvertencia,
            total_puntos: totalPuntos
        }
    };
};

const obtenerEstadoCuentaLocal = (authUser) => {
    const user = getLocalUser(authUser);

    const cuentaBancaria = (user.medios_pago || []).find((m) => {
        const tipo = String(m.tipo || '').toLowerCase();
        return tipo === 'cuenta_bancaria' || tipo === 'cuenta bancaria';
    }) || null;

    const esDuenio = (store.duenios || []).some((d) => String(d.identificador) === String(user.id));

    const morosa = (store.registroDeSubasta || []).find((r) => {
        const sameClient = String(r.cliente_id || r.cliente) === String(user.id);
        const impago = String(r.estado_cobro || '').toLowerCase() === 'impago';
        return sameClient && impago;
    });

    let restriccionActiva = false;
    let motivo = null;
    let montoRegularizar = 0;
    if (morosa) {
        restriccionActiva = true;
        motivo = 'Falta de pago en subasta. Debe regularizar su situación para continuar operando.';
        const monto = Number(morosa.importe || 0);
        montoRegularizar = Number((monto * 0.10).toFixed(2));
    }

    const categoriaStr = String(user.categoria || '').toLowerCase();
    const estadoValidacion = String(user.estado_validacion || '').toUpperCase();
    let admitido;
    if (estadoValidacion === 'APROBADO') admitido = 'si';
    else if (estadoValidacion === 'RECHAZADO') admitido = 'no';
    else admitido = null;

    return construirEstadoCuenta({
        usuario: {
            id: user.id,
            nombre_completo: user.nombre_completo || user.nombre || null,
            email: user.email || null,
            categoria: categoriaStr ? categoriaStr.toUpperCase() : null,
            foto_url: user.foto_perfil || null
        },
        verificacion: {
            admitido,
            categoria: categoriaStr ? categoriaStr.toUpperCase() : null,
            bloqueado: !!user.bloqueado
        },
        completitud: {
            documento: user.documento || null,
            email: user.email || null,
            telefono: user.telefono || null,
            direccion: user.domicilio_legal || user.direccion || null,
            foto_perfil: user.foto_perfil || null
        },
        cuenta_cobro: parseCuentaCobro(cuentaBancaria),
        es_duenio: esDuenio,
        restriccion: {
            activa: restriccionActiva,
            motivo,
            monto_regularizar: montoRegularizar
        },
        timestamp: new Date().toISOString()
    });
};

const obtenerEstadoCuentaSupabase = async (authUser) => {
    const clienteId = await resolveClienteIdSupabase(authUser);
    const { persona, cliente } = await fetchPersonaClienteSupabase(clienteId);

    const { data: cuenta, error: cuentaError } = await supabase
        .from('mediosdepago')
        .select('identificador, tipo, entidad, verificado, es_principal, detalles_enmascarados')
        .eq('cliente_id', clienteId)
        .eq('tipo', 'cuenta_bancaria')
        .order('identificador', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (cuentaError) {
        throw new AppError('Error al obtener cuenta de cobro: ' + cuentaError.message, 500);
    }

    const { data: duenioRow } = await supabase
        .from('duenios')
        .select('identificador')
        .eq('identificador', clienteId)
        .maybeSingle();

    const { data: registroRows } = await supabase
        .from('registrodesubasta')
        .select('identificador, cliente')
        .eq('cliente', clienteId)
        .limit(1);

    const categoria = cliente?.categoria ? String(cliente.categoria).toUpperCase() : null;
    const cuentaCobro = parseCuentaCobro(cuenta);

    return construirEstadoCuenta({
        usuario: {
            id: persona?.identificador || clienteId,
            nombre_completo: persona?.nombre || null,
            email: persona?.email || null,
            categoria,
            foto_url: persona?.foto_perfil || null
        },
        verificacion: {
            admitido: cliente == null ? null : (String(cliente.admitido || '').toLowerCase() === 'si' ? 'si' : (String(cliente.admitido || '').toLowerCase() === 'no' ? 'no' : null)),
            categoria,
            bloqueado: false
        },
        completitud: {
            documento: persona?.documento || null,
            email: persona?.email || null,
            telefono: persona?.telefono || null,
            direccion: persona?.direccion || null,
            foto_perfil: persona?.foto_perfil || null
        },
        cuenta_cobro: cuentaCobro,
        es_duenio: !!duenioRow,
        restriccion: {
            activa: false,
            motivo: null,
            monto_regularizar: 0
        },
        timestamp: new Date().toISOString()
    });
};

const obtenerEstadoCuenta = async (authUser) => {
    if (!isConfigured) {
        return obtenerEstadoCuentaLocal(authUser);
    }
    return obtenerEstadoCuentaSupabase(authUser);
};

const registrarComoDuenio = async (authUser) => {
    const clienteId = await resolveClienteIdSupabase(authUser);

    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('admitido, numeropais')
        .eq('identificador', clienteId)
        .maybeSingle();

    if (clienteError) {
        throw new AppError('Error al verificar estado del usuario: ' + clienteError.message, 500);
    }

    if (!cliente || String(cliente.admitido || '').toLowerCase() === 'no') {
        const err = new AppError('Usuarios rechazados no pueden registrarse como dueños', 403);
        err.codigo = 'USUARIO_RECHAZADO';
        throw err;
    }

    const { data: existing } = await supabase
        .from('duenios')
        .select('identificador')
        .eq('identificador', clienteId)
        .maybeSingle();

    if (existing) {
        return { es_duenio: true, ya_existia: true };
    }

    const { error: insertError } = await supabase
        .from('duenios')
        .insert({
            identificador: clienteId,
            numeropais: cliente.numeropais || null,
            verificacionfinanciera: 'si',
            verificacionjudicial: 'si'
        });

    if (insertError) {
        throw new AppError('Error al registrarte como dueño: ' + insertError.message, 500);
    }

    return { es_duenio: true, ya_existia: false };
};

module.exports = {
    obtenerPerfil,
    actualizarPerfil,
    subirFotoPerfil,
    eliminarFotoPerfil,
    obtenerEstadisticas,
    obtenerRestricciones,
    obtenerEstadoCuenta,
    registrarComoDuenio
};
