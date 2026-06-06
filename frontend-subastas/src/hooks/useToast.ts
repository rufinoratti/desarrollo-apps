import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastTipo = 'OUTBID' | 'INFO' | 'SUCCESS';

export interface ToastData {
  id: number;
  tipo: ToastTipo;
  titulo: string;
  mensaje: string;
}

export function useToast(autoHideMs: number = 3500) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const counterRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const mostrar = useCallback(
    (tipo: ToastTipo, titulo: string, mensaje: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      counterRef.current += 1;
      setToast({ id: counterRef.current, tipo, titulo, mensaje });
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, autoHideMs);
    },
    [autoHideMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, mostrar, hide };
}
