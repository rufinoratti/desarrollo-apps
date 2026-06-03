import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback } from 'react';
import { API_URL } from '@/src/config/env';
import { PUJAS_POLLING_INTERVAL_MS } from '@/src/config/polling';

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

interface ItemGanado {
  puja_id: string;
  item_id: string;
  titulo: string;
  imagen: string;
  monto_ganador: number;
}

export default function PujasActuales() {
  const { token, removeToken } = useAuth();
  const [pujas, setPujas] = useState<PujaActual[]>([]);
  const [ganados, setGanados] = useState<ItemGanado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPujas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/pujas/actuales`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setPujas(data.pujas || []);
    } catch {
      // Silencioso
    } finally {
      setCargando(false);
      setRefreshing(false);
    }
  }, [token, removeToken]);

  const fetchGanados = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/pujas/ganadas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setGanados(data.items || []);
    } catch {
      // Silencioso
    }
  }, [token, removeToken]);

  useEffect(() => {
    if (token) {
      fetchPujas();
      fetchGanados();
    }
  }, [token, fetchPujas, fetchGanados]);


  // Polling para actualizar las pujas cada cierto tiempo
  useEffect(() => {
    if (!token) return;
    fetchPujas();
    const interval = setInterval(fetchPujas, PUJAS_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, fetchPujas]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPujas();
    fetchGanados();
  };

  const formatearPrecio = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(monto);
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
      {item.imagen ? (
        <Image source={{ uri: item.imagen }} style={styles.cardImagen} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImagen, styles.cardImagenPlaceholder]}>
          <Ionicons name="image-outline" size={32} color="#CCC" />
        </View>
      )}
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

  const renderGanado = ({ item }: { item: ItemGanado }) => (
    <View style={styles.ganadoCard}>
      <View style={styles.ganadoHeader}>
        <Ionicons name="trophy" size={20} color="#DAA520" />
        <Text style={styles.ganadoTitle}>¡GANASTE!</Text>
      </View>
      <View style={styles.ganadoBody}>
        {item.imagen ? (
          <Image source={{ uri: item.imagen }} style={styles.ganadoImagen} resizeMode="cover" />
        ) : (
          <View style={styles.ganadoImagenPlaceholder}>
            <Ionicons name="image-outline" size={24} color="#CCC" />
          </View>
        )}
        <View style={styles.ganadoInfo}>
          <Text style={styles.ganadoProducto} numberOfLines={2}>{item.titulo}</Text>
          <Text style={styles.ganadoPrecio}>{formatearPrecio(item.monto_ganador)}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.contactarBtn} activeOpacity={0.7}>
        <Text style={styles.contactarBtnTexto}>CONTACTARSE</Text>
      </TouchableOpacity>
    </View>
  );

  const ListHeader = () => {
    if (!ganados.length) return null;
    return (
      <View style={styles.ganadosSection}>
        <Text style={styles.ganadosSectionTitle}>TUS GANADOS</Text>
        <FlatList
          data={ganados}
          keyExtractor={item => item.puja_id}
          renderItem={renderGanado}
          scrollEnabled={false}
          contentContainerStyle={{ gap: 12 }}
        />
        <View style={styles.ganadosDivider} />
      </View>
    );
  };

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>REMATIX</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={pujas}
        keyExtractor={item => item.puja_id}
        renderItem={renderPuja}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeader}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />
        }
        ListEmptyComponent={
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
        }
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerSpacer: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#000',
  },
  listContent: { padding: 16, gap: 16, flexGrow: 1 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  cardImagen: { width: 120, height: '100%', backgroundColor: '#EAEAEA' },
  cardImagenPlaceholder: { justifyContent: 'center', alignItems: 'center' },
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
  // Winners section
  ganadosSection: {
    marginBottom: 8,
  },
  ganadosSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DAA520',
    letterSpacing: 2,
    marginBottom: 12,
  },
  ganadoCard: {
    backgroundColor: '#FFFDE7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F9E076',
  },
  ganadoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  ganadoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B8860B',
    letterSpacing: 1,
  },
  ganadoBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  ganadoImagen: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#EAEAEA',
  },
  ganadoImagenPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ganadoInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  ganadoProducto: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  ganadoPrecio: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  contactarBtn: {
    borderWidth: 1.5,
    borderColor: '#B8860B',
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  contactarBtnTexto: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B8860B',
    letterSpacing: 1,
  },
  ganadosDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 16,
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
