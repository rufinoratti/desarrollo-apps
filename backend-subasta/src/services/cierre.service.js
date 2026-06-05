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

const CHUNK_SIZE = 10;

const ejecutarEnChunks = async (tareas, chunkSize = CHUNK_SIZE) => {
    for (let i = 0; i < tareas.length; i += chunkSize) {
        const bloque = tareas.slice(i, i + chunkSize);
        await Promise.all(bloque.map((t) => ejecutarUpdate(t.table, t.values, t.column, t.id)));
    }
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

    const itemIds = (items || []).map((i) => i.identificador);
    if (!itemIds.length) return;

    const { data: pujas, error: errPujas } = await supabase
        .from('pujos')
        .select('identificador, importe, item')
        .in('item', itemIds);
    if (errPujas) throw new AppError('Error al obtener pujas: ' + errPujas.message, 500);

    const maxBidPorItem = new Map();
    for (const puja of pujas || []) {
        const actual = maxBidPorItem.get(puja.item);
        if (!actual || puja.importe > actual.importe) {
            maxBidPorItem.set(puja.item, puja);
        }
    }

    const updatesPujas = [];
    const updatesItemsSi = [];
    const updatesItemsNo = [];

    for (const itemId of itemIds) {
        const ganador = maxBidPorItem.get(itemId);
        if (ganador) {
            updatesPujas.push({
                table: 'pujos',
                values: { ganador: 'si' },
                column: 'identificador',
                id: ganador.identificador
            });
            updatesItemsSi.push({
                table: 'itemscatalogo',
                values: { subastado: 'si' },
                column: 'identificador',
                id: itemId
            });
        } else {
            updatesItemsNo.push({
                table: 'itemscatalogo',
                values: { subastado: 'no' },
                column: 'identificador',
                id: itemId
            });
        }
    }

    await Promise.all([
        ejecutarEnChunks(updatesPujas),
        ejecutarEnChunks(updatesItemsSi),
        ejecutarEnChunks(updatesItemsNo)
    ]);
};

const ejecutarCierre = async () => {
    const ahora = new Date();

    const { data: porAbrir, error: errPorAbrir } = await supabase
        .from('subastas')
        .select('identificador, fecha, hora')
        .eq('estado', 'cerrada');
    if (errPorAbrir) throw new AppError('Error al obtener subastas por abrir: ' + errPorAbrir.message, 500);

    let abiertas = 0;
    const erroresAbrir = [];
    for (const subasta of porAbrir || []) {
        if (!subasta.fecha || !subasta.hora) continue;
        const fechaInicio = new Date(`${subasta.fecha}T${subasta.hora}`);
        if (Number.isNaN(fechaInicio.getTime())) continue;
        const fechaFin = calcularFechaFin(fechaInicio);
        if (fechaInicio.getTime() > ahora.getTime()) continue;
        if (fechaFin.getTime() <= ahora.getTime()) continue;

        try {
            await ejecutarUpdate('subastas', { estado: 'abierta' }, 'identificador', subasta.identificador);
            abiertas++;
        } catch (err) {
            console.error(`Error al abrir subasta ${subasta.identificador}: ${err.message}`);
            erroresAbrir.push({ subasta: subasta.identificador, error: err.message });
        }
    }

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

    if (erroresAbrir.length) {
        console.error(`[CRON] ${erroresAbrir.length} subasta(s) con errores al abrir:`, erroresAbrir);
    }
    if (errores.length) {
        console.error(`[CRON] ${errores.length} subasta(s) con errores al cerrar:`, errores);
    }

    return { abiertas, cerradas, errores: [...erroresAbrir, ...errores] };
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
