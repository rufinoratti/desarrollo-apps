import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Image, FlatList, ScrollView, Share, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';
import { PUJAS_POLLING_INTERVAL_MS } from '@/src/config/polling';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PujaEntry {
  monto: number;
  fecha_hora: string | null;
  postor: string;
}

interface PujasState {
  item_id: string;
  oferta_actual: number;
  estado_subasta: string;
  tiempo_restante_segundos: number | null;
  total_participantes: number;
  historial_pujas: PujaEntry[];
}

interface ItemDetail {
  id: string;
  numero_pieza: string;
  descripcion: string;
  descripcion_detallada: string | null;
  precio_base: number;
  ultima_oferta: number;
  estado: string;
  imagenes: string[];
  ficha_tecnica: Record<string, string> | null;
  duenio_nombre: string | null;
  subasta: {
    id: string;
    titulo?: string;
    estado?: string;
    fecha_fin?: string | null;
    fecha_cierre?: string | null;
  } | null;
  tiempo_restante_segundos: number | null;
}

const formatearPrecio = (monto: number) => {
  return `$ ${new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  }).format(monto)}`;
};

const formatearTiempo = (segundos: number | null): string => {
  if (segundos === null || segundos <= 0) return '00h 00m';
  const d = Math.floor(segundos / 86400);
  const h = Math.floor((segundos % 86400) / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export default function ProductoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();

  const [item, setItem] = useState<ItemDetail | null>(null);
  const [pujas, setPujas] = useState<PujasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [imagenActiva, setImagenActiva] = useState(0);
  const [esFavorito, setEsFavorito] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const fetchDetalle = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_URL}/api/items/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: ItemDetail = await res.json();
      setItem(data);
      setCountdown(data.tiempo_restante_segundos);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  const fetchPujas = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_URL}/api/items/${id}/pujas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data: PujasState = await res.json();
      setPujas(data);
      if (data.tiempo_restante_segundos !== null) {
        setCountdown(data.tiempo_restante_segundos);
      }
    } catch {
      // Silencioso
    }
  }, [id, token]);

  useEffect(() => {
    if (token) fetchDetalle();
  }, [token, fetchDetalle]);
  

  // Polling para actualizar las pujas en este caso 1000ms o 1seg
  useEffect(() => {
    if (!token || !id) return;
    fetchPujas();
    const interval = setInterval(fetchPujas, PUJAS_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, id, fetchPujas]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Mirá este lote en REMATIX: ${item?.descripcion || ''}`,
      });
    } catch {
      // Silencioso
    }
  };

  const ofertaActual = pujas?.oferta_actual ?? item?.ultima_oferta ?? item?.precio_base ?? 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorTexto}>Producto no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.errorBoton}>
          <Text style={styles.errorBotonTexto}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const imagenes = item.imagenes.length > 0 ? item.imagenes : [null];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <TouchableOpacity onPress={handleShare} style={styles.headerAction}>
          <Ionicons name="share-outline" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.galeria}>
          <FlatList
            data={imagenes}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(_, i) => String(i)}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
              setImagenActiva(index);
            }}
            renderItem={({ item: imgUrl }) => (
              <View style={styles.galeriaItem}>
                {imgUrl ? (
                  <Image
                    source={{ uri: imgUrl }}
                    style={styles.galeriaImagen}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.galeriaPlaceholder}>
                    <Ionicons name="image-outline" size={48} color="#CCC" />
                  </View>
                )}
              </View>
            )}
          />
          {imagenes.length > 1 && (
            <View style={styles.dotsContainer}>
              {imagenes.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === imagenActiva && styles.dotActivo,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.loteNumero}>LOTE #{String(item.numero_pieza).padStart(3, '0')}</Text>
          <Text style={styles.tituloProducto}>{item.descripcion}</Text>
          {item.duenio_nombre && (
            <Text style={styles.propietario}>
              <Ionicons name="person-outline" size={14} color="#999" /> {item.duenio_nombre}
            </Text>
          )}
        </View>

        <View style={styles.biddingBox}>
          <View style={styles.biddingHeader}>
            <View>
              <Text style={styles.ofertaLabel}>OFERTA ACTUAL</Text>
              <Text style={styles.ofertaMonto}>{formatearPrecio(ofertaActual)}</Text>
            </View>
            <View style={styles.countdownContainer}>
              <Ionicons name="time-outline" size={16} color="#D32F2F" />
              <Text style={styles.countdownTexto}>{formatearTiempo(countdown)}</Text>
            </View>
          </View>

          <View style={styles.biddingActions}>
            <TouchableOpacity style={styles.pujarBtn}>
              <Text style={styles.pujarBtnTexto}>OFERTAR AHORA</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.biddingStats}>
            <Text style={styles.statTexto}>
              {pujas?.total_participantes ?? 0} pujas registradas
            </Text>
          </View>
        </View>

        {item.descripcion_detallada && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>DESCRIPCIÓN</Text>
            <Text style={styles.seccionTexto}>{item.descripcion_detallada}</Text>
          </View>
        )}

        {item.ficha_tecnica && Object.keys(item.ficha_tecnica).length > 0 && (
          <View style={styles.seccion}>
            <Text style={styles.seccionTitulo}>FICHA TÉCNICA</Text>
            <View style={styles.fichaGrid}>
              {Object.entries(item.ficha_tecnica).map(([key, value]) => (
                <View key={key} style={styles.fichaRow}>
                  <Text style={styles.fichaLabel}>{key}</Text>
                  <Text style={styles.fichaValor}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.seccion}>
          <Text style={styles.seccionTitulo}>HISTORIAL DE PUJAS</Text>
          {pujas && pujas.historial_pujas.length > 0 ? (
            pujas.historial_pujas.map((puja, i) => (
              <View key={i} style={styles.pujaRow}>
                <View style={styles.pujaInfo}>
                  <Ionicons name="person-circle-outline" size={20} color="#666" />
                  <Text style={styles.pujaPostor}>{puja.postor}</Text>
                </View>
                <Text style={styles.pujaMonto}>{formatearPrecio(puja.monto)}</Text>
              </View>
            ))
          ) : (
            <View style={styles.pujaVacia}>
              <Ionicons name="trending-up-outline" size={32} color="#DDD" />
              <Text style={styles.pujaVaciaTexto}>Sin pujas aún</Text>
              <Text style={styles.pujaVaciaSub}>Sé el primero en ofertar</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  errorTexto: { fontSize: 16, color: '#666', marginBottom: 16 },
  errorBoton: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16 },
  errorBotonTexto: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerBack: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#000',
  },
  headerAction: { width: 40, alignItems: 'flex-end' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  galeria: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.2,
    backgroundColor: '#EAEAEA',
  },
  galeriaItem: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 },
  galeriaImagen: { width: '100%', height: '100%' },
  galeriaPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EAEAEA',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActivo: { backgroundColor: '#FFF', width: 24, borderRadius: 4 },
  infoSection: { padding: 20, backgroundColor: '#FFF', marginBottom: 8 },
  loteNumero: { fontSize: 12, fontWeight: '600', color: '#999', letterSpacing: 1, marginBottom: 6 },
  tituloProducto: { fontSize: 22, fontWeight: '700', color: '#000', marginBottom: 8 },
  propietario: { fontSize: 14, color: '#666' },
  biddingBox: {
    backgroundColor: '#FFF',
    padding: 20,
    marginBottom: 8,
  },
  biddingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  ofertaLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  ofertaMonto: { fontSize: 28, fontWeight: '700', color: '#000' },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  countdownTexto: { fontSize: 16, fontWeight: '700', color: '#D32F2F', fontVariant: ['tabular-nums'] },
  biddingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  pujarBtn: {
    flex: 1,
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  pujarBtnTexto: { color: '#FFF', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  seguirBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  biddingStats: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statTexto: { fontSize: 13, color: '#999' },
  seccion: { backgroundColor: '#FFF', padding: 20, marginBottom: 8 },
  seccionTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 2,
    marginBottom: 14,
  },
  seccionTexto: { fontSize: 15, color: '#444', lineHeight: 24 },
  fichaGrid: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  fichaRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fichaLabel: {
    width: '40%',
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  fichaValor: {
    flex: 1,
    fontSize: 13,
    color: '#000',
  },
  pujaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pujaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pujaPostor: { fontSize: 14, color: '#333' },
  pujaMonto: { fontSize: 14, fontWeight: '600', color: '#000' },
  pujaVacia: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  pujaVaciaTexto: { fontSize: 16, color: '#BBB', marginTop: 8, fontWeight: '600' },
  pujaVaciaSub: { fontSize: 13, color: '#CCC', marginTop: 4 },
});
