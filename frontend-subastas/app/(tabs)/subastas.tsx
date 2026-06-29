// subastas.tsx — Pantalla de listado de subastas (Tab "Subastas")
// - Endpoints:
// - GET /api/categorias → lista de categorías para los chips de filtro
// - GET /api/subastas?pagina=&limite=&tematica= → subastas paginadas con filtro
// - Funcionalidad general: Muestra un FlatList con cards de subastas, 
// ordenadas por estado (EN VIVO primero). Cada card tiene imagen, 
// título, cantidad de artículos, ubicación, badge de estado con animación, countdown,
//  y verificación de nivel de acceso. Tiene filtro por categoría (chips horizontales), búsqueda por texto, pull-to-refresh y scroll infinito.
//  Las subastas bloqueadas por nivel se ven borrosas con candado.
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, FlatList, TextInput, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';
import CountdownBadge from '@/src/components/CountdownBadge';
import { Skeleton, SkeletonList } from '@/src/components/Skeleton';
import { rankOf } from '@/src/utils/rankCategory';


interface Categoria {
  id: number;
  nombre: string;
}

interface SubastaItem {
  id?: string | number;
  subasta_id?: string;
  titulo: string;
  imagen_portada: string;       // URL de la imagen de portada
  cantidad_articulos: number;   // Cantidad de lotes/artículos
  ubicacion: string;            // Ubicación física de la subasta
  estado: string;               // Estado crudo desde backend
  nivel_requerido: string;      // Nivel mínimo para acceder (ej: "Plata")
  categoria_id: number;         // FK a categoría
  fecha_inicio?: string;        // Fecha ISO de inicio
  fecha_fin?: string;           // Fecha ISO de fin
}

// Función: calcular estado visual de la subasta
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

// ───────────────────────────────────────────────────────────
// Ordenamiento de subastas
// ───────────────────────────────────────────────────────────
// Prioridad: EN VIVO (0) > PRÓXIMAMENTE (1) > FINALIZADA (2)
// Dentro del mismo estado, ordena por fecha_inicio ascendente
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

// ───────────────────────────────────────────────────────────
// Componente principal: Pantalla de listado de subastas
// ───────────────────────────────────────────────────────────
export default function SubastasScreen() {
  const { token, nivel, removeToken } = useAuth();

  const [categorias, setCategorias] = useState<Categoria[]>([]);       // Lista de categorías para el filtro
  const [subastas, setSubastas] = useState<SubastaItem[]>([]);        // Lista de subastas a mostrar
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<number | null>(null); // Filtro activo
  const [pagina, setPagina] = useState(1);                             // Página actual (paginación)
  const [cargando, setCargando] = useState(true);                     // Loading inicial
  const [cargandoMas, setCargandoMas] = useState(false);              // Loading de más páginas
  const [refreshing, setRefreshing] = useState(false);                // Pull-to-refresh
  const [totalPaginas, setTotalPaginas] = useState(1);                // Total de páginas disponibles
  const [busquedaVisible, setBusquedaVisible] = useState(false);      // Toggle barra de búsqueda
  const [textoBusqueda, setTextoBusqueda] = useState('');             // Texto de búsqueda
  const inputRef = useRef<TextInput>(null);                           // Ref para auto-focus del input

  // fetchCategorias: GET /api/categorias
  const fetchCategorias = async () => {
    try {
      const res = await fetch(`${API_URL}/api/categorias`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }  // Token expirado → logout
      if (!res.ok) return;
      const data = await res.json();
      setCategorias(data);
    } catch {
      // Silencioso - error de red
    }
  };

  // fetchSubastas: GET /api/subastas?pagina=&limite=&tematica=
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
      setTotalPaginas(data.total_paginas);        // Guarda total para saber si hay más
      setSubastas(prev => append
        ? sortSubastas([...prev, ...data.subastas])  // Agrega al final (scroll infinito)
        : sortSubastas(data.subastas)                 // Reemplaza (filtro/refresh)
      );
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

  // ─────────────────────────────────────────────────────
  // handleRefresh: Pull-to-refresh
  // Recarga desde página 1 manteniendo el filtro actual
  // ─────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────
  // SubastaCard: Componente que renderiza cada card de subasta
  // - Animación de entrada: fade-in + slide-up escalonada
  // - Verifica si el usuario tiene nivel suficiente
  // - Si está bloqueada: imagen borrosa + candado + overlay
  // - Si no: muestra StatusBadge + CountdownBadge
  // ─────────────────────────────────────────────────────
  function SubastaCard({ item, index }: { item: SubastaItem; index: number }) {
    // Animaciones: fade desde 0→1, slide desde 24→0
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
    }, );

    // Obtiene nivel requerido del item (varios nombres posibles)
    const rawReq = (item as any).nivel_requerido ?? (item as any).nivel_acceso ?? (item as any).nivel ?? '';
    const nivelRequerido = rankOf(rawReq);
    const bloqueada = nivelActual < nivelRequerido;  // True si el usuario no tiene acceso

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
            style={[styles.imagen, bloqueada && styles.imagenBloqueada]}
            resizeMode="cover"
            blurRadius={bloqueada ? 6 : 0} 
          />

          {bloqueada && (
            <View style={styles.overlayBloqueada}>
              <Ionicons name="lock-closed" size={32} color="#fff" />
              <Text style={styles.textoAcceso}>ACCESO {String(rawReq || 'COMUN').toUpperCase()} REQUERIDO</Text>
            </View>
          )}
          {/* Badge de estado + countdown (solo si no está bloqueada) */}
          {!bloqueada && <StatusBadge estado={estado} />}
          {!bloqueada && (estado === 'EN VIVO' || estado === 'PRÓXIMAMENTE') && (
            <CountdownBadge
              fechaInicio={(item as any).fecha_inicio}
              fechaFin={(item as any).fecha_fin}
            />
          )}
        </TouchableOpacity>

        {/* Cuerpo de la card: título, subtítulo, botón */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
          <Text style={styles.cardSubtitulo}>
            {item.cantidad_articulos} artículos — {item.ubicacion}
          </Text>
          {/* Botón "VER CATÁLOGO" o "VER SUBASTA" si finalizó */}
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

  // ─────────────────────────────────────────────────────
  // Estado de carga inicial (skeleton)
  // Mientras carga la primera página, muestra placeholders
  // ─────────────────────────────────────────────────────
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

      {/* ─── Filtro de categorías (chips horizontales) ─── */}
      <Text style={styles.sectionHeaderTitle}>CATEGORÍAS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriasScroll}
        contentContainerStyle={styles.categoriasContent}
      >
        {/* Chip "Todas" - activo cuando no hay filtro */}
        <TouchableOpacity
          style={[styles.pildora, !categoriaSeleccionada && styles.pildoraActiva]}
          onPress={() => handleCategoriaPress(null)}
        >
          <Text style={[styles.pildoraTexto, !categoriaSeleccionada && styles.pildoraTextoActivo]}>Todas</Text>
        </TouchableOpacity>
        {/* Chips dinámicos desde GET /api/categorias */}
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

      {/* ─── Lista de subastas (FlatList) ─── */}
      <Text style={styles.sectionTitle}>SUBASTAS ACTIVAS</Text>

      <FlatList
        data={subastas}
        keyExtractor={(item, index) => String(item?.subasta_id ?? item?.id ?? index)}
        renderItem={({ item, index }) => <SubastaCard item={item} index={index} />}
        contentContainerStyle={styles.listContent}
        onEndReached={handleLoadMore}         // Scroll infinito
        onEndReachedThreshold={0.3}           // Se activa al 30% del final
        ListFooterComponent={renderFooter}     // Spinner al cargar más
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
    fontSize: 16,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 2,
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
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
  imagenBloqueada: { opacity: 0.7 },
  overlayBloqueada: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
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
  badgeTexto: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  cardBody: { paddingTop: 12, gap: 4 },
  cardTitulo: { fontSize: 20, fontWeight: '700', color: '#000' },
  cardSubtitulo: { fontSize: 16, color: '#666', marginBottom: 8 },
  botonCatalogo: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  botonCatalogoTexto: { fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 2 },
  botonCatalogoDisabled: { opacity: 0.5 },
  botonCatalogoTextoDisabled: { color: '#000' },
});
