const PROXIMAMENTE = 'PROXIMAMENTE';
const EN_VIVO = 'EN_VIVO';
const FINALIZADA = 'FINALIZADA';

const calcularInicio = (row) => {
    if (!row || !row.fecha || !row.hora) return null;
    const inicio = new Date(`${row.fecha}T${row.hora}`);
    return Number.isNaN(inicio.getTime()) ? null : inicio;
};

const calcularEstadoSubastaDisplay = (row, ahora = new Date()) => {
    const inicio = calcularInicio(row);
    if (inicio && inicio.getTime() > ahora.getTime()) {
        return PROXIMAMENTE;
    }
    const estadoNorm = String(row?.estado || '').toLowerCase();
    if (estadoNorm === 'abierta') return EN_VIVO;
    return FINALIZADA;
};

const calcularFechasIso = (row) => {
    const inicio = calcularInicio(row);
    if (!inicio) return { fecha_inicio_iso: null, fecha_fin_iso: null };
    const fin = new Date(inicio.getTime() + 3600 * 1000);
    return {
        fecha_inicio_iso: inicio.toISOString(),
        fecha_fin_iso: fin.toISOString()
    };
};

const DURACION_HORAS = 1;

const compararParaListado = (a, b) => {
    const ea = calcularEstadoSubastaDisplay(a);
    const eb = calcularEstadoSubastaDisplay(b);
    const orden = { [EN_VIVO]: 0, [PROXIMAMENTE]: 1, [FINALIZADA]: 2 };
    if (orden[ea] !== orden[eb]) return orden[ea] - orden[eb];
    const ta = (calcularInicio(a) || new Date(0)).getTime();
    const tb = (calcularInicio(b) || new Date(0)).getTime();
    if (ea === PROXIMAMENTE) return ta - tb;
    return tb - ta;
};

module.exports = {
    PROXIMAMENTE,
    EN_VIVO,
    FINALIZADA,
    DURACION_HORAS,
    calcularInicio,
    calcularEstadoSubastaDisplay,
    calcularFechasIso,
    compararParaListado
};
