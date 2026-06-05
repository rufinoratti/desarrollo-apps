import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Modal, Pressable, Alert, Image, ScrollView } from 'react-native';
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
import { SkeletonList } from '@/src/components/Skeleton';

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
  const [selectedGanado, setSelectedGanado] = useState<Notificacion | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<'retiro' | 'envio'>('retiro');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const paidItemsRef = useRef<Set<string>>(new Set());

  const pujasSnapshotRef = useRef<Map<string, boolean>>(new Map());
  const toastMostradoRef = useRef<Set<string>>(new Set());
  const cierresEmitidosRef = useRef<Set<string>>(new Set());
  const ultimaSuperadaRef = useRef<string | null>(null);
  const ultimaSuperadaSubastaIdRef = useRef<string | null>(null);
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
          ultimaSuperadaSubastaIdRef.current = p.subasta_id;
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

  const handleActionNotificacion = (n: Notificacion) => {
    if (n.tipo === 'SUPERADA' && n.subastaId) {
      router.push({ pathname: '/catalogo/[id]', params: { id: n.subastaId, titulo: n.lote || '' } });
    } else if (n.tipo === 'SUBASTA_INICIADA' && n.subastaId) {
      router.push({ pathname: '/catalogo/[id]', params: { id: n.subastaId, titulo: n.lote || '' } });
    }
  };

  const handlePressNotificacion = (n: Notificacion) => {
    // ensure payment state is reset whenever user opens a ganado modal
    setPaymentConfirmed(false);
    if (n.tipo === 'GANADA') {
      const itemKey = String(n.itemId ?? n.id ?? '');
      if (paidItemsRef.current.has(itemKey)) {
        Alert.alert('Operación ya completada', 'El pago de este lote ya fue confirmado.');
        return;
      }
      setSelectedGanado(n);
    } else if ((n.tipo === 'SUPERADA' || n.tipo === 'CIERRE_INMINENTE' || n.tipo === 'GANANDO') && n.subastaId) {
      router.push({ pathname: '/catalogo/[id]', params: { id: n.subastaId, titulo: n.lote || '' } });
    } else if (n.tipo === 'SUBASTA_INICIADA' && n.subastaId) {
      router.push({ pathname: '/catalogo/[id]', params: { id: n.subastaId, titulo: n.lote || '' } });
    }
  };

  const ganados = secciones.flatMap((s) => s.data.filter((n) => n.tipo === 'GANADA'));
  const selectedMonto = selectedGanado?.monto ?? 0;
  const comision = Math.round(selectedMonto * 0.1);
  const iva = Math.round(comision * 0.21);
  const totalPagar = selectedMonto + comision + iva;

  const handleSelectDelivery = (option: 'retiro' | 'envio') => {
    setSelectedDelivery(option);
  };

  const handleConfirmPago = () => {
    // mark as paid for this selected item so user can't re-open the flow
    if (selectedGanado) {
      const key = String(selectedGanado.itemId ?? selectedGanado.id ?? '');
      paidItemsRef.current.add(key);
    }
    setPaymentConfirmed(true);
  };

  const handleCloseSuccess = () => {
    setPaymentConfirmed(false);
    setSelectedGanado(null);
    router.push('/(tabs)');
  };

  const handleSelectGanado = (ganado: Notificacion) => {
    setSelectedGanado(ganado);
    setPaymentConfirmed(false);
  };

  if (cargando) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>NOTIFICACIONES</Text>
          <View style={styles.backButton} />
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
          <SkeletonList rows={4} gap={12} />
        </View>
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
          if (ultimaSuperadaSubastaIdRef.current) {
            router.push({ pathname: '/catalogo/[id]', params: { id: ultimaSuperadaSubastaIdRef.current } });
            hide();
          }
        }}
      />

      <Modal visible={!!selectedGanado} transparent animationType="slide" onRequestClose={() => { setSelectedGanado(null); setPaymentConfirmed(false); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalStatus}>¡FELICIDADES!</Text>
                <Text style={styles.modalSubtitle}>Has ganado el lote {selectedGanado?.lote ?? ''}</Text>
              </View>
              <Pressable onPress={() => { setSelectedGanado(null); setPaymentConfirmed(false); }} style={styles.modalCloseButton}>
                <Ionicons name="close" size={22} color="#000" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {paymentConfirmed ? (
                <View style={styles.successContent}>
                  <View style={styles.successIconContainer}>
                    <Ionicons name="checkmark-circle" size={52} color="#10B981" />
                  </View>
                  <Text style={styles.successTitle}>¡PAGO CONFIRMADO!</Text>
                  <Text style={styles.successSubtitle}>
                    Tu compra del {selectedGanado?.lote ?? 'lote'} fue procesada exitosamente.
                  </Text>
                  <View style={styles.successCard}>
                    <Ionicons name="cube-outline" size={18} color="#111" />
                    <Text style={styles.successCardText}>
                      Recibirás un email con el presupuesto de envío en las próximas 24 horas.
                    </Text>
                  </View>
                  <Text style={styles.successReference}>N° de referencia: {selectedGanado ? `RMX-${String(selectedGanado.itemId).padStart(7, '0')}` : 'RMX-0000000'}</Text>
                  <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85} onPress={handleCloseSuccess}>
                    <Text style={styles.confirmButtonText}>IR AL INICIO</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.productoCard}>
                    {selectedGanado?.imagen ? (
                      <Image source={{ uri: selectedGanado.imagen }} style={styles.productoImagen} resizeMode="cover" />
                    ) : (
                      <View style={styles.productoImagenPlaceholder} />
                    )}
                    <Text style={styles.productoTitulo} numberOfLines={2}>{selectedGanado?.titulo}</Text>
                    <Text style={styles.productoDescripcion} numberOfLines={3}>{selectedGanado?.descripcion}</Text>
                  </View>

                  <View style={styles.resumenCard}>
                    <Text style={styles.resumenLabel}>RESUMEN DE LIQUIDACIÓN</Text>
                    <View style={styles.resumenRow}>
                      <Text style={styles.resumenTexto}>Precio Final</Text>
                      <Text style={styles.resumenValor}>{selectedMonto > 0 ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(selectedMonto) : '-'} </Text>
                    </View>
                    <View style={styles.resumenRow}>
                      <Text style={styles.resumenTexto}>Comisiones (10%)</Text>
                      <Text style={styles.resumenValor}>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(comision)}</Text>
                    </View>
                    <View style={styles.resumenRow}>
                      <Text style={styles.resumenTexto}>IVA sobre comisiones (21%)</Text>
                      <Text style={styles.resumenValor}>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(iva)}</Text>
                    </View>
                    <View style={styles.resumenDivider} />
                    <View style={styles.resumenRow}> 
                      <Text style={[styles.resumenTexto, styles.totalTexto]}>TOTAL A PAGAR</Text>
                      <Text style={[styles.resumenValor, styles.totalTexto]}>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(totalPagar)}</Text>
                    </View>
                  </View>

                  <Text style={styles.sectionTitleModal}>MÉTODO DE ENTREGA</Text>
                  <View style={styles.deliveryOptions}>
                    <TouchableOpacity
                      style={[styles.deliveryCard, selectedDelivery === 'retiro' && styles.deliveryCardSelected]}
                      activeOpacity={0.85}
                      onPress={() => handleSelectDelivery('retiro')}
                    >
                      <Text style={styles.deliveryTitle}>Retiro en Sucursal</Text>
                      <Text style={styles.deliverySubtitle}>Buenos Aires, Recoleta (CABA)</Text>
                      <Text style={styles.deliveryNote}>SIN CARGO ADICIONAL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deliveryCard, selectedDelivery === 'envio' && styles.deliveryCardSelected]}
                      activeOpacity={0.85}
                      onPress={() => handleSelectDelivery('envio')}
                    >
                      <Text style={styles.deliveryTitle}>Envío Asegurado</Text>
                      <Text style={styles.deliverySubtitle}>Logística especializada de lujo</Text>
                      <Text style={styles.deliveryNote}>A COTIZAR POST-PAGO</Text>
                    </TouchableOpacity>
                  </View>

                  {ganados.length > 1 && (
                    <View style={styles.otrosGanadosSection}>
                      <Text style={styles.sectionTitleModal}>OTROS LOTES GANADOS</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.otrosGanadosScroll}>
                        {ganados.filter((n) => n.id !== selectedGanado?.id).map((n) => (
                          <TouchableOpacity
                            key={n.id}
                            style={styles.otherCard}
                            onPress={() => handleSelectGanado(n)}
                          >
                            {n.imagen ? (
                              <Image source={{ uri: n.imagen }} style={styles.otherImage} resizeMode="cover" />
                            ) : (
                              <View style={styles.otherPlaceholder} />
                            )}
                            <Text style={styles.otherTitle} numberOfLines={2}>{n.titulo}</Text>
                            <Text style={styles.otherLote}>{n.lote}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85} onPress={handleConfirmPago}>
                    <Text style={styles.confirmButtonText}>CONFIRMAR Y PROCEDER AL PAGO</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '92%',
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F1F1',
    backgroundColor: '#FFF',
  },
  modalStatus: {
    color: '#111',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSubtitle: {
    color: '#555',
    fontSize: 13,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  productoCard: {
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: '#F8F8F8',
    padding: 16,
    gap: 12,
  },
  productoImagen: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
  },
  productoImagenPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
  },
  productoTitulo: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111',
  },
  productoDescripcion: {
    fontSize: 13,
    color: '#666',
    lineHeight: 19,
  },
  resumenCard: {
    marginTop: 22,
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  resumenLabel: {
    color: '#999',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  resumenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resumenTexto: {
    color: '#555',
    fontSize: 13,
    flex: 1,
  },
  resumenValor: {
    color: '#111',
    fontSize: 13,
    fontWeight: '700',
  },
  resumenDivider: {
    height: 1,
    backgroundColor: '#EFEFEF',
    marginVertical: 12,
  },
  totalTexto: {
    fontSize: 15,
    fontWeight: '900',
  },
  sectionTitleModal: {
    marginTop: 26,
    marginBottom: 12,
    fontSize: 10,
    fontWeight: '800',
    color: '#999',
    letterSpacing: 2,
  },
  deliveryOptions: {
    gap: 12,
  },
  deliveryCard: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFF',
  },
  deliveryCardSelected: {
    borderColor: '#000',
    backgroundColor: '#F7F7F7',
  },
  deliveryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111',
    marginBottom: 4,
  },
  deliverySubtitle: {
    fontSize: 12,
    color: '#666',
  },
  deliveryNote: {
    marginTop: 8,
    fontSize: 11,
    color: '#999',
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  otrosGanadosSection: {
    marginTop: 26,
  },
  otrosGanadosScroll: {
    paddingBottom: 8,
  },
  otherCard: {
    width: 140,
    marginRight: 14,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    padding: 12,
  },
  otherImage: {
    width: '100%',
    height: 96,
    borderRadius: 14,
    backgroundColor: '#EAEAEA',
    marginBottom: 10,
  },
  otherPlaceholder: {
    width: '100%',
    height: 96,
    borderRadius: 14,
    backgroundColor: '#EAEAEA',
    marginBottom: 10,
  },
  otherTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111',
    marginBottom: 6,
  },
  otherLote: {
    fontSize: 11,
    color: '#777',
  },
  confirmButton: {
    marginTop: 28,
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  successContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    gap: 18,
  },
  successIconContainer: {
    width: 98,
    height: 98,
    borderRadius: 54,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    marginTop: 8,
  },
  successCardText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  successReference: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 12,
    letterSpacing: 0.4,
  },
});
