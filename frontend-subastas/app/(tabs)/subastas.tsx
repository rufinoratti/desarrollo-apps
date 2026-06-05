import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, FlatList, TextInput, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';
import CountdownBadge from '@/src/components/CountdownBadge';
import { Skeleton, SkeletonList } from '@/src/components/Skeleton';

interface Categoria {
  id: number;
  nombre: string;
}

// No hard-coded small map here — convert any known level string to a numeric rank for comparisons
const rankOf = (lvl?: string | number) => {
  if (!lvl && lvl !== 0) return 1;
  const s = String(lvl)
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
  const digits = s.match(/\d+/);
  if (digits?.[0]) {
    const num = Number(digits[0]);
    if (num >= 1 && num <= 5) return num;
  }
  if (s.includes('platino') || s.includes('platinum')) return 5;
  if (s.includes('oro')) return 4;
  if (s.includes('plata')) return 3;
  if (s.includes('especial')) return 2;
  if (s.includes('comun') || s.includes('base')) return 1;
  switch (s) {
    case 'base':
    case 'comun':
    case '1':
      return 1;
    case 'especial':
    case '2':
      return 2;
    case 'plata':
    case '3':
      return 3;
    case 'oro':
    case '4':
      return 4;
    case 'platino':
    case '5':
      return 5;
    case 'base'.toUpperCase():
    case 'oro'.toUpperCase():
    case 'platino'.toUpperCase():
      return rankOf(s.toLowerCase());
    default:
      return 1;
  }
};

interface SubastaItem {
  id?: string | number;
  subasta_id?: string;
  titulo: string;
  imagen_portada: string;
  cantidad_articulos: number;
  ubicacion: string;
  estado: string;
  nivel_requerido: string;
  categoria_id: number;
  fecha_inicio?: string;
  fecha_fin?: string;
}

function getDisplayStatus(item: SubastaItem): string {
  const estadoLower = String(item.estado).toLowerCase();
  if (estadoLower === 'cerrada' || estadoLower === 'finalizada') return 'FINALIZADA';
  const now = Date.now();
  const start = item.fecha_inicio ? new Date(item.fecha_inicio).getTime() : 0;
  const end = item.fecha_fin ? new Date(item.fecha_fin).getTime() : 0;
  if (start && now < start) return 'PRÓXIMAMENTE';
  if (end && now >= end) return 'FINALIZADA';
  return 'EN VIVO';
}

const STATUS_ORDER: Record<string, number> = { 'EN VIVO': 0, 'PRÓXIMAMENTE': 1, 'FINALIZADA': 2 };

function sortSubastas(list: SubastaItem[]): SubastaItem[] {
  return [...list].sort((a, b) => {
    const orderA = STATUS_ORDER[getDisplayStatus(a)] ?? 2;
    const orderB = STATUS_ORDER[getDisplayStatus(b)] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    const startA = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
    const startB = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
    return startA - startB;
  });
}

const BADGE_COLORS: Record<string, string> = {
  'EN VIVO': '#059669',
  'PRÓXIMAMENTE': '#2563EB',
  'FINALIZADA': '#6B7280',
};

function StatusBadge({ estado }: { estado: string }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (estado !== 'EN VIVO') return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.55, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [estado, pulseAnim]);

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: BADGE_COLORS[estado] || '#000',
          opacity: estado === 'EN VIVO' ? pulseAnim : 1,
        },
      ]}
    >
      <Text style={styles.badgeTexto}>{estado}</Text>
    </Animated.View>
  );
}

export default function SubastasScreen() {
  const { token, nivel, removeToken } = useAuth();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subastas, setSubastas] = useState<SubastaItem[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const inputRef = useRef<TextInput>(null);

  const fetchCategorias = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categorias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setCategorias(data);
    } catch {
      // Silencioso
    }
  };

  const fetchSubastas = async (pag: number, catId: number | null, append: boolean) => {
    if (pag === 1) setCargando(true); else setCargandoMas(true);
    try {
      let url = `${API_URL}/api/subastas?pagina=${pag}&limite=100`;
      if (catId) url += `&tematica=${catId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setTotalPaginas(data.total_paginas);
      setSubastas(prev => append ? sortSubastas([...prev, ...data.subastas]) : sortSubastas(data.subastas));
    } catch {
      // Silencioso
    } finally {
      setCargando(false);
      setCargandoMas(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCategorias();
      fetchSubastas(1, null, false);
    }
    // fetchCategorias/fetchSubastas intentionally not in deps to avoid ref churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleCategoriaPress = (catId: number | null) => {
    setCategoriaSeleccionada(catId);
    setPagina(1);
    fetchSubastas(1, catId, false);
  };

  const handleLoadMore = () => {
    if (cargandoMas || pagina >= totalPaginas) return;
    const nextPage = pagina + 1;
    setPagina(nextPage);
    fetchSubastas(nextPage, categoriaSeleccionada, true);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setPagina(1);
    fetchSubastas(1, categoriaSeleccionada, false);
  };

  const handleToggleBusqueda = () => {
    setBusquedaVisible(!busquedaVisible);
    if (!busquedaVisible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTextoBusqueda('');
    }
  };

  const nivelActual = rankOf(nivel || 'base');

  function SubastaCard({ item, index }: { item: SubastaItem; index: number }) {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(24)).current;
    const estado = getDisplayStatus(item);

    useEffect(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 450, delay: Math.min(index * 70, 350), useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 450, delay: Math.min(index * 70, 350), useNativeDriver: true,
        }),
      ]).start();
    }, []);

    const rawReq = (item as any).nivel_requerido ?? (item as any).nivel_acceso ?? (item as any).nivel ?? '';
    const nivelRequerido = rankOf(rawReq);
    const bloqueada = nivelActual < nivelRequerido && estado === 'EN VIVO';

    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            if (!bloqueada) {
              router.push({
                pathname: '/catalogo/[id]',
                params: { id: String(item.subasta_id ?? item.id), titulo: item.titulo },
              });
            }
          }}
          style={styles.imagenContainer}
        >
          <Image
            source={{ uri: item.imagen_portada }}
            style={styles.imagen}
            resizeMode="cover"
            blurRadius={bloqueada ? 6 : 0}
          />
          {bloqueada && (
            <View style={styles.overlayBloqueada}>
              <Ionicons name="lock-closed" size={32} color="#fff" />
              <Text style={styles.textoAcceso}>ACCESO {String(rawReq || 'COMUN').toUpperCase()} REQUERIDO</Text>
            </View>
          )}
          {!bloqueada && <StatusBadge estado={estado} />}
          {!bloqueada && (estado === 'EN VIVO' || estado === 'PRÓXIMAMENTE') && (
            <CountdownBadge
              fechaInicio={(item as any).fecha_inicio}
              fechaFin={(item as any).fecha_fin}
            />
          )}
        </TouchableOpacity>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
          <Text style={styles.cardSubtitulo}>
            {item.cantidad_articulos} artículos — {item.ubicacion}
          </Text>
          <TouchableOpacity
            style={[styles.botonCatalogo, bloqueada && styles.botonCatalogoDisabled]}
            onPress={() => {
              if (bloqueada) return;
              router.push({
                pathname: '/catalogo/[id]',
                params: { id: String(item.subasta_id ?? item.id), titulo: item.titulo },
              });
            }}
            disabled={bloqueada}
          >
            <Text style={[styles.botonCatalogoTexto, bloqueada && styles.botonCatalogoTextoDisabled]}>
              {estado === 'FINALIZADA' ? 'VER SUBASTA' : 'VER CATÁLOGO'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  const renderFooter = () => {
    if (!cargandoMas) return null;
    return <ActivityIndicator size="small" color="#000" style={{ paddingVertical: 16 }} />;
  };

  if (cargando && subastas.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitulo}>SUBASTAS</Text>
        </View>
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <Skeleton width="100%" height={40} borderRadius={8} style={{ marginBottom: 12 }} />
        </View>
        <View style={{ paddingHorizontal: 20 }}>
          <SkeletonList rows={5} gap={14} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {busquedaVisible ? (
          <View style={styles.busquedaContainer}>
            <TouchableOpacity onPress={handleToggleBusqueda}>
              <Ionicons name="arrow-back" size={22} color="#000" />
            </TouchableOpacity>
            <TextInput
              ref={inputRef}
              style={styles.busquedaInput}
              placeholder="Buscar subastas..."
              placeholderTextColor="#999"
              value={textoBusqueda}
              onChangeText={setTextoBusqueda}
              returnKeyType="search"
            />
            {textoBusqueda.length > 0 && (
              <TouchableOpacity onPress={() => setTextoBusqueda('')}>
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.headerSpacer}>
              <Ionicons name="menu" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.headerTitulo}>REMATIX</Text>
            <TouchableOpacity onPress={handleToggleBusqueda}>
              <Ionicons name="search" size={22} color="#000" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.sectionHeaderTitle}>CATEGORÍAS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriasScroll}
        contentContainerStyle={styles.categoriasContent}
      >
        <TouchableOpacity
          style={[styles.pildora, !categoriaSeleccionada && styles.pildoraActiva]}
          onPress={() => handleCategoriaPress(null)}
        >
          <Text style={[styles.pildoraTexto, !categoriaSeleccionada && styles.pildoraTextoActivo]}>Todas</Text>
        </TouchableOpacity>
        {categorias.map((cat: any, index: number) => {
          const catId = cat?.identificador ?? cat?.id;
          return (
            <TouchableOpacity
              key={String(catId ?? index)}
              style={[styles.pildora, categoriaSeleccionada === catId && styles.pildoraActiva]}
              onPress={() => handleCategoriaPress(catId)}
            >
              <Text style={[styles.pildoraTexto, categoriaSeleccionada === catId && styles.pildoraTextoActivo]}>
                {cat?.nombre ?? ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.sectionTitle}>SUBASTAS ACTIVAS</Text>

      <FlatList
        data={subastas}
        keyExtractor={(item, index) => String(item?.subasta_id ?? item?.id ?? index)}
        renderItem={({ item, index }) => <SubastaCard item={item} index={index} />}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerSpacer: { width: 30 },
  headerTitulo: { fontSize: 18, fontWeight: '700', letterSpacing: 4 },
  busquedaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  busquedaInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 2,
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 2,
    marginLeft: 16,
    marginTop: 24,
    marginBottom: 12,
  },
  categoriasScroll: { flexGrow: 0, minHeight: 45, backgroundColor: '#F8F9FA' },
  categoriasContent: { paddingHorizontal: 16, paddingVertical: 4 },
  pildora: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#EEE',
    marginRight: 10,
  },
  pildoraActiva: { backgroundColor: '#000' },
  pildoraTexto: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  pildoraTextoActivo: { color: '#FFF' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 24 },
  card: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 24,
  },
  imagenContainer: {
    height: 220,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagen: {
    width: '100%',
    height: '100%',
  },
  overlayBloqueada: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  textoAcceso: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  cardBody: { paddingTop: 12, gap: 4 },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#000' },
  cardSubtitulo: { fontSize: 11, color: '#666', marginBottom: 8 },
  botonCatalogo: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  botonCatalogoTexto: { fontSize: 11, fontWeight: '700', color: '#000', letterSpacing: 2 },
  botonCatalogoDisabled: { opacity: 0.5 },
  botonCatalogoTextoDisabled: { color: '#000' },
});
