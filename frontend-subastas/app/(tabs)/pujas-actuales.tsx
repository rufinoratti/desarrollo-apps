import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  RefreshControl,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '@/src/config/env';

interface PujaActual {
  puja_id: string;
  item_id: string;
  subasta_id: string;
  numero_lote: string;
  titulo: string;
  imagen: string;
  monto_ofertado: number;
  monto_actual: number;
  es_ganadora: boolean;
  tiempo_restante: string;
  estado_subasta: string;
}

interface Notificacion {
  id_evento: string;
  tipo_evento: 'ADJUDICADO' | 'PUJA_ACTIVA' | 'PUJA_SUPERADA' | 'PAGO_PENDIENTE' | 'ENTREGA_COORDINADA';
  item_id: string | null;
  titulo_lote: string;
  fecha_texto: string;
  monto: number | null;
  etiqueta_monto: string | null;
  leida: boolean;
}

const TIPO_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  ADJUDICADO: { label: 'GANASTE', color: '#1B5E20', bg: '#E8F5E9', icon: 'trophy-outline' },
  PUJA_ACTIVA: { label: 'GANANDO', color: '#2E7D32', bg: '#E8F5E9', icon: 'trending-up-outline' },
  PUJA_SUPERADA: { label: 'SUPERADA', color: '#C62828', bg: '#FFEBEE', icon: 'arrow-down-outline' },
  PAGO_PENDIENTE: { label: 'PAGO', color: '#E65100', bg: '#FFF3E0', icon: 'card-outline' },
  ENTREGA_COORDINADA: { label: 'ENTREGA', color: '#1565C0', bg: '#E3F2FD', icon: 'cube-outline' },
};

export default function PujasActuales() {
  const { token, removeToken } = useAuth();
  const [pujas, setPujas] = useState<PujaActual[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDatos = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resPujas, resNotif] = await Promise.all([
        fetch(`${API_URL}/api/pujas/actuales`, { headers }),
        fetch(`${API_URL}/api/notificaciones`, { headers }),
      ]);

      if (resPujas.status === 401 || resNotif.status === 401) {
        removeToken();
        return;
      }

      if (resPujas.ok) {
        const dataPujas = await resPujas.json();
        setPujas(dataPujas.pujas || []);
      }

      if (resNotif.ok) {
        const dataNotif = await resNotif.json();
        setNotificaciones(dataNotif.notificaciones || []);
        setTotalNoLeidas(dataNotif.total_no_leidas ?? 0);
      }
    } catch {
      // Silencioso
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [token, removeToken]);

  useEffect(() => {
    if (token) fetchDatos();
  }, [token, fetchDatos]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDatos();
  };

  const marcarLeida = async (notif: Notificacion) => {
    if (notif.leida) return;
    try {
      await fetch(`${API_URL}/api/notificaciones/${notif.id_evento}/leer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotificaciones((prev) =>
        prev.map((n) =>
          n.id_evento === notif.id_evento ? { ...n, leida: true } : n
        )
      );
      setTotalNoLeidas((c) => Math.max(0, c - 1));
    } catch {
      // Silencioso
    }
  };

  const handleNotificacionPress = async (notif: Notificacion) => {
    await marcarLeida(notif);

    if (notif.tipo_evento === 'ADJUDICADO' && notif.item_id) {
      router.push({
        pathname: '/adjudicacion/[id]',
        params: { id: notif.item_id },
      });
      return;
    }

    if (notif.item_id) {
      router.push({
        pathname: '/producto/[id]',
        params: { id: notif.item_id },
      });
    }
  };

  const formatearPrecio = (monto: number) =>
    new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(monto);

  const renderNotificacion = ({ item }: { item: Notificacion }) => {
    const config = TIPO_CONFIG[item.tipo_evento] || TIPO_CONFIG.PUJA_ACTIVA;

    return (
      <TouchableOpacity
        style={[styles.notifCard, !item.leida && styles.notifCardUnread]}
        activeOpacity={0.9}
        onPress={() => handleNotificacionPress(item)}
      >
        <View style={[styles.notifIconBox, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>
        <View style={styles.notifBody}>
          <View style={styles.notifHeader}>
            <View style={[styles.estadoBadge, { backgroundColor: config.bg }]}>
              <Text style={[styles.estadoBadgeText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
            <Text style={styles.notifFecha}>{item.fecha_texto}</Text>
          </View>
          <Text style={styles.notifTitulo} numberOfLines={2}>
            {item.titulo_lote}
          </Text>
          {item.monto != null && item.etiqueta_monto && (
            <Text style={styles.notifMonto}>
              {item.etiqueta_monto}: {formatearPrecio(item.monto)}
            </Text>
          )}
          {item.tipo_evento === 'ADJUDICADO' && (
            <Text style={styles.notifCta}>Tocá para ver liquidación y pagar →</Text>
          )}
        </View>
        {!item.leida && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const renderPuja = ({ item }: { item: PujaActual }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        router.push({
          pathname: '/catalogo/[id]',
          params: { id: item.subasta_id, titulo: item.titulo },
        });
      }}
    >
      <Image source={{ uri: item.imagen }} style={styles.cardImagen} resizeMode="cover" />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.loteNumero}>{item.numero_lote}</Text>
          <View style={[styles.estadoBadge, item.es_ganadora ? styles.ganadoraBadge : styles.perdiendoBadge]}>
            <Text style={[styles.estadoBadgeText, item.es_ganadora ? styles.ganadoraText : styles.perdiendoText]}>
              {item.es_ganadora ? 'GANANDO' : 'SUPERADA'}
            </Text>
          </View>
        </View>
        <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.ofertaLabel}>MI OFERTA</Text>
            <Text style={styles.ofertaMonto}>{formatearPrecio(item.monto_ofertado)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.actualLabel}>OFERTA ACTUAL</Text>
            <Text style={styles.actualMonto}>{formatearPrecio(item.monto_actual)}</Text>
          </View>
        </View>
        <View style={styles.tiempoRow}>
          <Ionicons name="time-outline" size={14} color="#666" />
          <Text style={styles.tiempoTexto}>{item.tiempo_restante}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const sections = [
    ...(notificaciones.length
      ? [{ title: 'NOTIFICACIONES', data: notificaciones as (Notificacion | PujaActual)[] }]
      : []),
    { title: 'PUJAS ACTIVAS', data: pujas as (Notificacion | PujaActual)[] },
  ];

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  const hayContenido = notificaciones.length > 0 || pujas.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>REMATIX</Text>
        <View style={styles.headerSpacer}>
          {totalNoLeidas > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalNoLeidas > 9 ? '9+' : totalNoLeidas}</Text>
            </View>
          )}
          <Ionicons name="notifications-outline" size={22} color="#000" />
        </View>
      </View>

      {!hayContenido ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="hammer-outline" size={48} color="#CCC" />
          <Text style={styles.emptyTitle}>Sin pujas activas</Text>
          <Text style={styles.emptySubtitle}>Explorá las subastas y hacé tu primera oferta</Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/subastas')}
          >
            <Text style={styles.emptyButtonText}>VER SUBASTAS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => {
            if ('id_evento' in item) return item.id_evento;
            return (item as PujaActual).puja_id || String(index);
          }}
          renderSectionHeader={({ section: { title } }) => (
            <Text style={styles.sectionTitle}>{title}</Text>
          )}
          renderItem={({ item, section }) => {
            if (section.title === 'NOTIFICACIONES') {
              return renderNotificacion({ item: item as Notificacion });
            }
            return renderPuja({ item: item as PujaActual });
          }}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />
          }
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={null}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerSpacer: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#000',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#000',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    zIndex: 1,
  },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  listContent: { padding: 16, paddingBottom: 32 },
  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  notifCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#000',
  },
  notifIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBody: { flex: 1 },
  notifHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notifFecha: { fontSize: 11, color: '#999' },
  notifTitulo: { fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 4 },
  notifMonto: { fontSize: 13, fontWeight: '600', color: '#333' },
  notifCta: { fontSize: 11, color: '#666', marginTop: 6, fontStyle: 'italic' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 12,
  },
  cardImagen: { width: 120, height: '100%', backgroundColor: '#EAEAEA', minHeight: 120 },
  cardBody: { flex: 1, padding: 12, gap: 6 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loteNumero: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1 },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  ganadoraBadge: { backgroundColor: '#E8F5E9' },
  perdiendoBadge: { backgroundColor: '#FFEBEE' },
  estadoBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ganadoraText: { color: '#2E7D32' },
  perdiendoText: { color: '#C62828' },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: '#000' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  ofertaLabel: { fontSize: 9, color: '#999', letterSpacing: 1 },
  ofertaMonto: { fontSize: 16, fontWeight: '700', color: '#000' },
  actualLabel: { fontSize: 9, color: '#999', letterSpacing: 1 },
  actualMonto: { fontSize: 14, fontWeight: '600', color: '#666' },
  tiempoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tiempoTexto: { fontSize: 12, color: '#666' },
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
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1,
  },
});
