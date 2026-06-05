import { useState, useEffect } from 'react';

const SEGUNDOS_POR_DEFECTO = 3600;

export interface UseCountdownResult {
  estado: 'PROXIMAMENTE' | 'EN_VIVO' | 'FINALIZADA' | null;
  tiempoTexto: string | null;
  segundosRestantes: number | null;
}

const formatearTiempo = (segundos: number): string => {
  if (segundos <= 0) return '00h 00m 00s';
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (d > 0) return `${d}d ${hh}h ${mm}m ${ss}s`;
  if (h > 0 || m > 0) return `${hh}h ${mm}m ${ss}s`;
  return `${ss}s`;
};

export function useCountdown(
  fechaInicio?: string | null,
  fechaFin?: string | null,
  duracionDefectoSegundos: number = SEGUNDOS_POR_DEFECTO,
): UseCountdownResult {
  const [ahora, setAhora] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!fechaInicio && !fechaFin) {
    return { estado: null, tiempoTexto: null, segundosRestantes: null };
  }

  const inicioMs = fechaInicio ? new Date(fechaInicio).getTime() : null;
  let finMs = fechaFin ? new Date(fechaFin).getTime() : null;

  if (!finMs && inicioMs) {
    finMs = inicioMs + duracionDefectoSegundos * 1000;
  }

  if (inicioMs && ahora < inicioMs) {
    const segundos = Math.max(0, Math.floor((inicioMs - ahora) / 1000));
    return { estado: 'PROXIMAMENTE', tiempoTexto: formatearTiempo(segundos), segundosRestantes: segundos };
  }

  if (finMs && ahora >= finMs) {
    return { estado: 'FINALIZADA', tiempoTexto: null, segundosRestantes: 0 };
  }

  if (finMs) {
    const segundos = Math.max(0, Math.floor((finMs - ahora) / 1000));
    return { estado: 'EN_VIVO', tiempoTexto: formatearTiempo(segundos), segundosRestantes: segundos };
  }

  return { estado: null, tiempoTexto: null, segundosRestantes: null };
}
