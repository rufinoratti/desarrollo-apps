const { supabase } = require('../config/supabase');
const AppError = require('../utils/appError');

const DURACION_SUBASTA_HORAS = 1;

const calcularFechaFin = (fechaInicio) => {
    return new Date(new Date(fechaInicio).getTime() + DURACION_SUBASTA_HORAS * 3600 * 1000);
};

const ejecutarUpdate = async (table, values, column, id) => {
    const { error } = await supabase
        .from(table)
        .update(values)
        .eq(column, id);
    if (error) throw new AppError(`Error al actualizar ${table}: ${error.message}`, 500);
    return true;
};

const cerrarSubasta = async (subastaId) => {
    await ejecutarUpdate('subastas', { estado: 'cerrada' }, 'identificador', subastaId);

    const { data: catalogos, error: errCatalogos } = await supabase
        .from('catalogos')
        .select('identificador')
        .eq('subasta', subastaId);
    if (errCatalogos) throw new AppError('Error al obtener catálogos: ' + errCatalogos.message, 500);

    const catalogoIds = (catalogos || []).map((c) => c.identificador);
    if (!catalogoIds.length) return;

    const { data: items, error: errItems } = await supabase
        .from('itemscatalogo')
        .select('identificador')
        .in('catalogo', catalogoIds);
    if (errItems) throw new AppError('Error al obtener items: ' + errItems.message, 500);

    for (const item of items || []) {
        const { data: maxBid, error: errBid } = await supabase
            .from('pujos')
            .select('identificador, importe')
            .eq('item', item.identificador)
            .order('importe', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (errBid) throw new AppError('Error al obtener puja máxima: ' + errBid.message, 500);

        if (maxBid) {
            await ejecutarUpdate('pujos', { ganador: 'si' }, 'identificador', maxBid.identificador);
            await ejecutarUpdate('itemscatalogo', { subastado: 'si' }, 'identificador', item.identificador);
        } else {
            await ejecutarUpdate('itemscatalogo', { subastado: 'no' }, 'identificador', item.identificador);
        }
    }
};

const ejecutarCierre = async () => {
    const ahora = new Date();
    const { data: subastas, error: errSubastas } = await supabase
        .from('subastas')
        .select('identificador, fecha, hora')
        .eq('estado', 'abierta');
    if (errSubastas) throw new AppError('Error al obtener subastas abiertas: ' + errSubastas.message, 500);

    let cerradas = 0;
    const errores = [];

    for (const subasta of subastas || []) {
        if (!subasta.fecha || !subasta.hora) continue;
        const fechaInicio = new Date(`${subasta.fecha}T${subasta.hora}`);
        const fechaFin = calcularFechaFin(fechaInicio);
        if (fechaFin > ahora) continue;

        try {
            await cerrarSubasta(subasta.identificador);
            cerradas++;
        } catch (err) {
            console.error(`Error al cerrar subasta ${subasta.identificador}: ${err.message}`);
            errores.push({ subasta: subasta.identificador, error: err.message });
        }
    }

    if (errores.length) {
        console.error(`[CRON] ${errores.length} subasta(s) con errores:`, errores);
    }

    return { cerradas, errores };
};

const ejecutarCierreSubasta = async (subastaId) => {
    if (!subastaId) {
        throw new AppError('ID de subasta requerido', 400);
    }

    const idNum = Number(subastaId);
    if (Number.isNaN(idNum)) {
        throw new AppError('ID de subasta inválido', 400);
    }

    const { data: subasta, error: err } = await supabase
        .from('subastas')
        .select('identificador, estado')
        .eq('identificador', idNum)
        .maybeSingle();

    if (err) throw new AppError('Error al obtener subasta: ' + err.message, 500);
    if (!subasta) throw new AppError('Subasta no encontrada', 404);
    if (subasta.estado === 'cerrada') throw new AppError('La subasta ya está cerrada', 400);

    await cerrarSubasta(subasta.identificador);
    return { mensaje: 'Subasta cerrada correctamente' };
};

module.exports = {
    ejecutarCierre,
    ejecutarCierreSubasta
};
