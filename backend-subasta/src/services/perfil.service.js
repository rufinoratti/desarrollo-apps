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
    // Intento 1: con email
    let personaData = null;
    let personaError = null;

    ({ data: personaData, error: personaError } = await supabase
        .from('personas')
        .select('identificador, documento, nombre, direccion, email, foto')
        .eq('identificador', clienteId)
        .maybeSingle());

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

    const { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('categoria')
        .eq('identificador', clienteId)
        .maybeSingle();

    if (clienteError) {
        throw new AppError('Error al obtener datos de cliente: ' + clienteError.message, 500);
    }

    return {
        persona: personaData,
        cliente
    };
};

const obtenerPerfil = async (authUser) => {
    if (!isConfigured) {
        const user = getLocalUser(authUser);
        const cuentaBancaria = (user.medios_pago || []).find((m) => {
            const tipo = String(m.tipo || '').toLowerCase();
            return tipo === 'cuenta_bancaria' || tipo === 'cuenta bancaria';
        }) || null;

        return {
            usuario_id: String(user.id),
            nombre_completo: user.nombre_completo || user.nombre || null,
            categoria: String(user.categoria || 'comun').toUpperCase(),
            datos_personales: {
                documento: user.documento || null,
                nombre: user.nombre_completo || user.nombre || null,
                direccion: user.domicilio_legal || user.direccion || null,
                email: user.email || null,
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

    return {
        usuario_id: String(persona?.identificador || clienteId),
        nombre_completo: persona?.nombre || null,
        categoria: String(cliente?.categoria || 'comun').toUpperCase(),
        datos_personales: {
            documento: persona?.documento || null,
            nombre: persona?.nombre || null,
            direccion: persona?.direccion || null,
            email: persona?.email || null,
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

        return { mensaje: 'Perfil actualizado correctamente' };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const updateDb = {};
    if (sanitized.nombre_completo !== undefined) {
        updateDb.nombre = sanitized.nombre_completo;
    }
    if (sanitized.direccion !== undefined) {
        updateDb.direccion = sanitized.direccion;
    }

    const { error } = await supabase
        .from('personas')
        .update(updateDb)
        .eq('identificador', clienteId);

    if (error) {
        throw new AppError('Error al actualizar perfil: ' + error.message, 500);
    }

    return { mensaje: 'Perfil actualizado correctamente' };
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
    const lotesGanados = (pujasUsuarioRows || []).filter((p) => String(p.ganador) === 'si').length;

    const { data: comprasRows, error: comprasError } = await supabase
        .from('registrodesubasta')
        .select('importe')
        .eq('cliente', clienteId);

    if (comprasError) throw new AppError('Error al obtener estadísticas: ' + comprasError.message, 500);

    const inversionTotal = (comprasRows || []).reduce((acc, row) => acc + Number(row.importe || 0), 0);

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

module.exports = {
    obtenerPerfil,
    actualizarPerfil,
    obtenerEstadisticas,
    obtenerRestricciones
};
