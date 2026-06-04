import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from '@/src/config/env';
import { NOTIFICACIONES_POLLING_INTERVAL_MS } from '@/src/config/polling';
import NotificacionCard, { Notificacion } from '@/src/components/NotificacionCard';
import ToastOutbid from '@/src/components/ToastOutbid';
import { useToast } from '@/src/hooks/useToast';

const INTERVALOS_CIERRE = [45, 30, 15];

interface PujaActual {
  puja_id: string;
  item_id: string;
  subasta_id: string;
  subasta_titulo?: string;
  numero_lote: string;
  titulo: string;
  imagen: string;
  monto_ofertado: number;
  monto_actual: number;
  monto_maximo_actual: number;
  es_ganadora: boolean;
  fecha_fin?: string | null;
  tiempo_restante: string;
  estado_subasta: string;
}

interface ItemGanado {
  puja_id: string;
  item_id: string;
  titulo: string;
  imagen: string;
  monto_ganador: number;
}

interface SubastaResumen {
  id: string | number;
  identificador?: string | number;
  titulo?: string;
  nombre?: string;
  estado?: string;
  fecha_inicio?: string;
  imagen_portada?: string;
  imagen?: string;
}

const formatearPrecio = (monto: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(monto);
};

type Seccion = {
  titulo: 'HOY' | 'AYER' | 'ANTERIORMENTE';
  data: Notificacion[];
};

export default function PujasActuales() {
  const { token, removeToken } = useAuth();
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const pujasSnapshotRef = useRef<Map<string, boolean>>(new Map());
  const toastMostradoRef = useRef<Set<string>>(new Set());
  const cierresEmitidosRef = useRef<Set<string>>(new Set());
  const ultimaSuperadaRef = useRef<string | null>(null);
  const timestampsCacheRef = useRef<Map<string, string>>(new Map());
  const { toast, mostrar, hide } = useToast();

  const armarNotificaciones = useCallback(
    (pujas: PujaActual[], ganados: ItemGanado[], subastas: SubastaResumen[]): Notificacion[] => {
      const ahora = Date.now();
      const notifs: Notificacion[] = [];
      let seq = 0;

      const push = (n: Omit<Notificacion, '_seq'> & { _seq?: number }): void => {
        n._seq = seq++;
        const cached = timestampsCacheRef.current.get(n.id);
        if (cached) {
          n.timestamp = cached;
        } else {
          timestampsCacheRef.current.set(n.id, n.timestamp);
        }
        notifs.push(n as Notificacion);
      };

      for (const g of ganados) {
        push({
          id: `ganada-${g.puja_id}`,
          tipo: 'GANADA',
          titulo: '¡FELICIDADES! GANASTE EL LOTE',
          lote: `LOTE #${String(g.item_id).padStart(3, '0')}`,
          descripcion: `Tu puja final de ${formatearPrecio(g.monto_ganador)} resultó ganadora.`,
          timestamp: new Date().toISOString(),
          itemId: g.item_id,
          imagen: g.imagen,
          monto: g.monto_ganador,
        });
      }

      for (const p of pujas) {
        const eraGanadora = pujasSnapshotRef.current.get(p.puja_id);
        const esGanadoraAhora = p.es_ganadora;

        if (eraGanadora === true && esGanadoraAhora === false && !toastMostradoRef.current.has(p.puja_id)) {
          ultimaSuperadaRef.current = p.item_id;
          mostrar(
            'OUTBID',
            '¡TE SUPERARON!',
            `LOTE #${p.numero_lote} - Tu oferta fue superada.`
          );
          toastMostradoRef.current.add(p.puja_id);
          setTimeout(() => toastMostradoRef.current.delete(p.puja_id), 60000);
        }

        pujasSnapshotRef.current.set(p.puja_id, esGanadoraAhora);

        if (!esGanadoraAhora) {
          push({
            id: `superada-${p.puja_id}`,
            tipo: 'SUPERADA',
            titulo: 'PUJA SUPERADA',
            lote: `LOTE #${p.numero_lote}`,
            descripcion: `Alguien superó tu oferta por el "${p.titulo}". Puja ahora para recuperar la posición.`,
            timestamp: new Date().toISOString(),
            itemId: p.item_id,
            subastaId: p.subasta_id,
            imagen: p.imagen,
            monto: p.monto_ofertado,
          });
        }
      }

      for (const p of pujas) {
        if (!p.fecha_fin || !p.es_ganadora) continue;
        const finMs = new Date(p.fecha_fin).getTime();
        if (Number.isNaN(finMs)) continue;
        const minutosRestantes = (finMs - ahora) / 60000;
        for (const intervalo of INTERVALOS_CIERRE) {
          const key = `${intervalo}-${p.puja_id}`;
          if (cierresEmitidosRef.current.has(key)) continue;
          if (Math.abs(minutosRestantes - intervalo) <= 0.5) {
            cierresEmitidosRef.current.add(key);
            push({
              id: `cierre-${key}`,
              tipo: 'CIERRE_INMINENTE',
              titulo: 'CIERRE INMINENTE',
              lote: `LOTE #${p.numero_lote}`,
              descripcion: `Faltan ${intervalo} minutos para el cierre. ${intervalo === 15 ? 'Última oportunidad para ajustar tu oferta.' : 'Asegurate de tener configurada tu puja máxima.'}`,
              timestamp: new Date().toISOString(),
              itemId: p.item_id,
              subastaId: p.subasta_id,
              imagen: p.imagen,
            });
          }
        }
      }

      for (const s of subastas) {
        if (s.estado !== 'EN_VIVO') continue;
        if (!s.fecha_inicio) continue;
        const inicioMs = new Date(s.fecha_inicio).getTime();
        if (Number.isNaN(inicioMs)) continue;
        const diffMin = (ahora - inicioMs) / 60000;
        if (diffMin >= 0 && diffMin <= 60 * 24) {
          const idSub = s.identificador ?? s.id;
          push({
            id: `iniciada-${idSub}`,
            tipo: 'SUBASTA_INICIADA',
            titulo: 'SUBASTA INICIADA',
            lote: String(s.nombre || s.titulo || '').toUpperCase(),
            descripcion: `El catálogo "${s.nombre || s.titulo || ''}" ya está recibiendo ofertas. Explora los lotes exclusivos disponibles hoy.`,
            timestamp: s.fecha_inicio,
            subastaId: String(idSub),
            imagen: s.imagen_portada || s.imagen,
          });
        }
      }

      return notifs;
    },
    [mostrar]
  );

  const agruparPorFecha = useCallback((notifs: Notificacion[]): Seccion[] => {
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    const inicioAyer = inicioHoy - 24 * 60 * 60 * 1000;

    const hoy: Notificacion[] = [];
    const ayer: Notificacion[] = [];
    const anteriores: Notificacion[] = [];

    for (const n of notifs) {
      const t = new Date(n.timestamp).getTime();
      if (Number.isNaN(t)) {
        hoy.push(n);
        continue;
      }
      if (t >= inicioHoy) hoy.push(n);
      else if (t >= inicioAyer) ayer.push(n);
      else anteriores.push(n);
    }

    const sortByTime = (a: Notificacion, b: Notificacion) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      const va = Number.isNaN(ta) ? 0 : ta;
      const vb = Number.isNaN(tb) ? 0 : tb;
      if (vb !== va) return vb - va;
      return (b._seq ?? 0) - (a._seq ?? 0);
    };
    hoy.sort(sortByTime);
    ayer.sort(sortByTime);
    anteriores.sort(sortByTime);

    const secciones: Seccion[] = [];
    if (hoy.length) secciones.push({ titulo: 'HOY', data: hoy });
    if (ayer.length) secciones.push({ titulo: 'AYER', data: ayer });
    if (anteriores.length) secciones.push({ titulo: 'ANTERIORMENTE', data: anteriores });
    return secciones;
  }, []);

  const fetchTodo = useCallback(
    async (mostrarCargando: boolean = true) => {
      if (!token) return;
      if (mostrarCargando) setCargando(true);
      try {
        const [pujasRes, ganadosRes, subastasRes] = await Promise.all([
          fetch(`${API_URL}/api/pujas/actuales`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/pujas/ganadas`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/api/subastas?pagina=1&limite=20`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (pujasRes.status === 401 || ganadosRes.status === 401) {
          removeToken();
          return;
        }

        const pujasData = pujasRes.ok ? await pujasRes.json() : { pujas: [] };
        const ganadosData = ganadosRes.ok ? await ganadosRes.json() : { items: [] };
        const subastasData = subastasRes.ok ? await subastasRes.json() : { subastas: [] };

        const notifs = armarNotificaciones(
          pujasData.pujas || [],
          ganadosData.items || [],
          subastasData.subastas || []
        );
        setSecciones(agruparPorFecha(notifs));
      } catch (e) {
        console.error('Error cargando notificaciones', e);
      } finally {
        setCargando(false);
        setRefreshing(false);
      }
    },
    [token, removeToken, armarNotificaciones, agruparPorFecha]
  );

  useEffect(() => {
    if (!token) return;
    fetchTodo(true);
    const interval = setInterval(() => fetchTodo(false), NOTIFICACIONES_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, fetchTodo]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTodo(false);
  };

  const navegarNotificacion = (n: Notificacion) => {
    if (n.tipo === 'GANADA' && n.itemId) {
      router.push({ pathname: '/adjudicacion/[id]', params: { id: n.itemId } });
      return;
    }
    if ((n.tipo === 'SUPERADA' || n.tipo === 'CIERRE_INMINENTE' || n.tipo === 'GANANDO') && n.itemId) {
      router.push({ pathname: '/producto/[id]', params: { id: n.itemId } });
      return;
    }
    if (n.tipo === 'SUBASTA_INICIADA' && n.subastaId) {
      router.push({ pathname: '/catalogo/[id]', params: { id: n.subastaId, titulo: n.lote || '' } });
    }
  };

  const handleActionNotificacion = (n: Notificacion) => {
    navegarNotificacion(n);
  };

  const handlePressNotificacion = (n: Notificacion) => {
    navegarNotificacion(n);
  };

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  const empty = secciones.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOTIFICACIONES</Text>
        <View style={styles.backButton} />
      </View>

      {empty ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={56} color="#CCC" />
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptySubtitle}>
            Cuando ganes una subasta, te superen una puja o haya cierres inminentes, vas a verlos acá.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/subastas')}
          >
            <Text style={styles.emptyButtonText}>EXPLORAR SUBASTAS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={secciones}
          keyExtractor={(s) => s.titulo}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />
          }
          renderItem={({ item: seccion }) => (
            <View>
              <Text style={styles.sectionTitle}>{seccion.titulo}</Text>
              {seccion.data.map((n) => (
                <NotificacionCard
                  key={n.id}
                  notificacion={n}
                  onPress={() => handlePressNotificacion(n)}
                  onActionPress={() => handleActionNotificacion(n)}
                />
              ))}
            </View>
          )}
        />
      )}

      <ToastOutbid
        toast={toast}
        onDismiss={hide}
        onActionPress={() => {
          if (ultimaSuperadaRef.current) {
            router.push({ pathname: '/producto/[id]', params: { id: ultimaSuperadaRef.current } });
            hide();
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  backButton: { width: 32, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#000',
  },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#999',
    letterSpacing: 2,
    marginTop: 12,
    marginBottom: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  emptyButton: {
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1.5,
  },
});
