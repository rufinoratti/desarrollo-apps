const AppError = require('../utils/appError');
const { supabase, isConfigured } = require('../config/supabase');
const { store, nextId } = require('./data.store');

const DB_TO_API_TYPE = {
    tarjeta_credito: 'TARJETA',
    cuenta_bancaria: 'CUENTA_BANCARIA',
    cheque: 'CHEQUE',
    tarjeta: 'TARJETA'
};

const API_TO_DB_TYPE = {
    TARJETA: 'tarjeta_credito',
    CUENTA_BANCARIA: 'cuenta_bancaria',
    CHEQUE: 'cheque'
};

const VALID_MONEDAS = new Set(['ARS', 'USD', 'AMBAS']);

const onlyDigits = (v = '') => String(v).replace(/\D/g, '');
const last4 = (v = '') => {
    const digits = onlyDigits(v);
    return digits.slice(-4) || '0000';
};

const mapVerificadoToEstado = (verificado) => (String(verificado).toLowerCase() === 'si' ? 'VERIFICADA' : 'EN_REVISION');
const mapPrincipalToBool = (v) => String(v).toLowerCase() === 'si' || v === true;

const mapMedioToApi = (medio) => ({
    id: String(medio.identificador ?? medio.id),
    tipo_pago: DB_TO_API_TYPE[medio.tipo] || 'CUENTA_BANCARIA',
    descripcion_corta: medio.detalles_enmascarados || medio.descripcion || 'Sin detalles',
    estado: mapVerificadoToEstado(medio.verificado),
    es_principal: mapPrincipalToBool(medio.es_principal)
});

const normalizeMoneda = (moneda) => {
    const monedaUp = String(moneda || 'ARS').toUpperCase();
    return VALID_MONEDAS.has(monedaUp) ? monedaUp : 'ARS';
};

const parsePayloadMedio = ({ tipo_pago, detalles, moneda }) => {
    const tipoPago = String(tipo_pago || '').toUpperCase();
    const tipoDb = API_TO_DB_TYPE[tipoPago];

    if (!tipoDb || !detalles || typeof detalles !== 'object') {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    if (tipoPago === 'TARJETA') {
        if (!detalles.numero_tarjeta || !detalles.titular) {
            const err = new AppError('Datos inválidos', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }

        return {
            tipo: tipoDb,
            entidad: detalles.titular,
            detalles_enmascarados: `Tarjeta de Crédito **** ${last4(detalles.numero_tarjeta)}`,
            moneda: normalizeMoneda(moneda || 'ARS'),
            limite_garantia: 0
        };
    }

    if (tipoPago === 'CUENTA_BANCARIA') {
        if (!detalles.cbu_alias || !detalles.banco) {
            const err = new AppError('Datos inválidos', 400);
            err.codigo = 'DATOS_INVALIDOS';
            throw err;
        }

        return {
            tipo: tipoDb,
            entidad: detalles.banco,
            detalles_enmascarados: `${detalles.banco} - CBU/Alias **** ${last4(detalles.cbu_alias)}`,
            moneda: normalizeMoneda(moneda || 'ARS'),
            limite_garantia: 0
        };
    }

    if (!detalles.numero_cheque || detalles.monto === undefined || detalles.monto === null) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    const monto = Number(detalles.monto);
    if (Number.isNaN(monto) || monto <= 0) {
        const err = new AppError('Datos inválidos', 400);
        err.codigo = 'DATOS_INVALIDOS';
        throw err;
    }

    return {
        tipo: tipoDb,
        entidad: detalles.banco || 'Cheque Certificado',
        detalles_enmascarados: `Cheque Certificado **** ${last4(detalles.numero_cheque)}`,
        moneda: normalizeMoneda(moneda || 'ARS'),
        limite_garantia: monto
    };
};

const getLocalUser = (authUser) => {
    const user = (store.users || []).find((u) => String(u.id) === String(authUser?.id));
    if (!user) {
        throw new AppError('No autenticado', 401);
    }
    if (!Array.isArray(user.medios_pago)) {
        user.medios_pago = [];
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

    const { data: persona, error } = await supabase
        .from('personas')
        .select('identificador')
        .eq('email', authUser.email)
        .maybeSingle();

    if (error) {
        throw new AppError('Error al resolver usuario: ' + error.message, 500);
    }

    if (!persona?.identificador) {
        throw new AppError('No autenticado', 401);
    }

    return persona.identificador;
};

const listarMediosPago = async (authUser) => {
    if (!isConfigured) {
        const user = getLocalUser(authUser);
        return user.medios_pago.map((m) => mapMedioToApi(m));
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    const { data, error } = await supabase
        .from('mediosdepago')
        .select('identificador, tipo, detalles_enmascarados, verificado, es_principal')
        .eq('cliente_id', clienteId)
        .order('identificador', { ascending: true });

    if (error) {
        throw new AppError('Error al obtener medios de pago: ' + error.message, 500);
    }

    return (data || []).map(mapMedioToApi);
};

const agregarMedioPago = async (authUser, payload) => {
    const parsed = parsePayloadMedio(payload || {});

    if (!isConfigured) {
        const user = getLocalUser(authUser);
        const isFirst = user.medios_pago.length === 0;

        const nuevo = {
            id: nextId('mp', 'medioPago'),
            tipo: parsed.tipo,
            entidad: parsed.entidad,
            verificado: 'no',
            es_principal: isFirst ? 'si' : 'no',
            detalles_enmascarados: parsed.detalles_enmascarados,
            moneda: parsed.moneda,
            limite_garantia: parsed.limite_garantia
        };

        user.medios_pago.push(nuevo);

        return {
            id: String(nuevo.id),
            mensaje: 'Medio de pago agregado correctamente',
            estado: mapVerificadoToEstado(nuevo.verificado)
        };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { count, error: countError } = await supabase
        .from('mediosdepago')
        .select('identificador', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);

    if (countError) {
        throw new AppError('Error al validar medios de pago: ' + countError.message, 500);
    }

    const esPrincipal = (count || 0) === 0 ? 'si' : 'no';

    const { data, error } = await supabase
        .from('mediosdepago')
        .insert({
            cliente_id: clienteId,
            tipo: parsed.tipo,
            entidad: parsed.entidad,
            verificado: 'no',
            es_principal: esPrincipal,
            detalles_enmascarados: parsed.detalles_enmascarados,
            moneda: parsed.moneda,
            limite_garantia: parsed.limite_garantia
        })
        .select('identificador, verificado')
        .single();

    if (error) {
        throw new AppError('Error al agregar medio de pago: ' + error.message, 500);
    }

    return {
        id: String(data.identificador),
        mensaje: 'Medio de pago agregado correctamente',
        estado: mapVerificadoToEstado(data.verificado)
    };
};

const eliminarMedioPago = async (authUser, medioId) => {
    if (!medioId) {
        throw new AppError('Medio de pago no encontrado', 404);
    }

    if (!isConfigured) {
        const user = getLocalUser(authUser);
        const index = user.medios_pago.findIndex((m) => String(m.id) === String(medioId));

        if (index === -1) {
            throw new AppError('Medio de pago no encontrado', 404);
        }

        if (user.medios_pago.length === 1) {
            const err = new AppError('No puedes eliminar tu único medio de pago', 400);
            err.codigo = 'UNICO_MEDIO_PAGO';
            throw err;
        }

        const [deleted] = user.medios_pago.splice(index, 1);

        if (mapPrincipalToBool(deleted.es_principal)) {
            user.medios_pago.sort((a, b) => String(a.id).localeCompare(String(b.id)));
            if (user.medios_pago[0]) user.medios_pago[0].es_principal = 'si';
            for (let i = 1; i < user.medios_pago.length; i += 1) {
                user.medios_pago[i].es_principal = 'no';
            }
        }

        return { mensaje: 'Medio de pago eliminado correctamente' };
    }

    const clienteId = await resolveClienteIdSupabase(authUser);

    const { data: medio, error: medioError } = await supabase
        .from('mediosdepago')
        .select('identificador, es_principal')
        .eq('identificador', Number(medioId))
        .eq('cliente_id', clienteId)
        .maybeSingle();

    if (medioError) {
        throw new AppError('Error al obtener medio de pago: ' + medioError.message, 500);
    }

    if (!medio) {
        throw new AppError('Medio de pago no encontrado', 404);
    }

    const { count, error: countError } = await supabase
        .from('mediosdepago')
        .select('identificador', { count: 'exact', head: true })
        .eq('cliente_id', clienteId);

    if (countError) {
        throw new AppError('Error al validar medios de pago: ' + countError.message, 500);
    }

    if ((count || 0) <= 1) {
        const err = new AppError('No puedes eliminar tu único medio de pago', 400);
        err.codigo = 'UNICO_MEDIO_PAGO';
        throw err;
    }

    const { error: deleteError } = await supabase
        .from('mediosdepago')
        .delete()
        .eq('identificador', medio.identificador)
        .eq('cliente_id', clienteId);

    if (deleteError) {
        throw new AppError('Error al eliminar medio de pago: ' + deleteError.message, 500);
    }

    if (mapPrincipalToBool(medio.es_principal)) {
        const { data: nextMain, error: nextError } = await supabase
            .from('mediosdepago')
            .select('identificador')
            .eq('cliente_id', clienteId)
            .order('identificador', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (nextError) {
            throw new AppError('Error al reasignar principal: ' + nextError.message, 500);
        }

        if (nextMain?.identificador) {
            const { error: updateMainError } = await supabase
                .from('mediosdepago')
                .update({ es_principal: 'si' })
                .eq('identificador', nextMain.identificador)
                .eq('cliente_id', clienteId);

            if (updateMainError) {
                throw new AppError('Error al reasignar principal: ' + updateMainError.message, 500);
            }
        }
    }

    return { mensaje: 'Medio de pago eliminado correctamente' };
};

// ------------------------------
// Reglas de negocio (REQ-BIZ)
// ------------------------------

const verificarLimiteCheque = ({ medioPago, ofertaActual, comision = 0 }) => {
    if (!medioPago) {
        throw new AppError('Medio de pago inválido', 400);
    }

    const tipo = String(medioPago.tipo || '').toLowerCase();
    if (tipo !== 'cheque') {
        return true;
    }

    const total = Number(ofertaActual || 0) + Number(comision || 0);
    const limite = Number(medioPago.limite_garantia || 0);

    if (Number.isNaN(total) || total <= 0) {
        throw new AppError('Oferta inválida', 400);
    }

    if (total > limite) {
        const err = new AppError('La oferta supera el límite de garantía del cheque', 400);
        err.codigo = 'LIMITE_GARANTIA_EXCEDIDO';
        throw err;
    }

    return true;
};

const tieneMedioCompatibleMoneda = async ({ authUser, monedaSubasta }) => {
    const moneda = String(monedaSubasta || 'ARS').toUpperCase();
    if (moneda !== 'USD') {
        return true;
    }

    const medios = await listarMediosPago(authUser);
    // listarMediosPago no expone moneda; para esta regla leemos fuente original
    if (!isConfigured) {
        const user = getLocalUser(authUser);
        return user.medios_pago.some((m) => ['USD', 'AMBAS'].includes(String(m.moneda || 'ARS').toUpperCase()));
    }

    const clienteId = await resolveClienteIdSupabase(authUser);
    const { data, error } = await supabase
        .from('mediosdepago')
        .select('moneda')
        .eq('cliente_id', clienteId);

    if (error) {
        throw new AppError('Error al validar moneda de medios de pago: ' + error.message, 500);
    }

    return (data || []).some((m) => ['USD', 'AMBAS'].includes(String(m.moneda || 'ARS').toUpperCase()));
};

module.exports = {
    listarMediosPago,
    agregarMedioPago,
    eliminarMedioPago,
    verificarLimiteCheque,
    tieneMedioCompatibleMoneda
};
