import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image, FlatList, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';

interface Categoria {
  id: number;
  nombre: string;
}

const NIVELES: Record<string, number> = { BASE: 0, ORO: 1, PLATINO: 2 };

interface SubastaItem {
  subasta_id: string;
  titulo: string;
  imagen_portada: string;
  cantidad_articulos: number;
  ubicacion: string;
  estado: string;
  nivel_requerido: string;
  categoria_id: number;
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
      const res = await fetch(`${API_URL}/categorias`, {
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
      let url = `${API_URL}/subastas?pagina=${pag}&limite=10`;
      if (catId) url += `&categoria_id=${catId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeToken(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setTotalPaginas(data.total_paginas);
      setSubastas(prev => append ? [...prev, ...data.subastas] : data.subastas);
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

  const nivelActual = NIVELES[nivel || 'BASE'] || 0;

  const renderSubastaCard = ({ item }: { item: SubastaItem }) => {
    const nivelRequerido = NIVELES[item.nivel_requerido] || 0;
    const bloqueada = nivelActual < nivelRequerido;
    const esEnVivo = item.estado === 'EN_VIVO';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          if (!bloqueada) {
            router.push({
              pathname: '/catalogo/[id]',
              params: { id: item.subasta_id, titulo: item.titulo },
            });
          }
        }}
      >
        <View style={styles.imagenContainer}>
          {bloqueada ? (
            <View style={styles.imagenBloqueada}>
              <Ionicons name="lock-closed" size={32} color="#fff" />
              <Text style={styles.textoAcceso}>ACCESO {item.nivel_requerido} REQUERIDO</Text>
            </View>
          ) : (
            <Image source={{ uri: item.imagen_portada }} style={styles.imagen} resizeMode="cover" />
          )}
          {esEnVivo ? (
            <View style={styles.badgeVivo}>
              <Text style={styles.badgeVivoTexto}>EN VIVO</Text>
            </View>
          ) : (
            <View style={styles.badgeProximamente}>
              <Text style={styles.badgeProximamenteTexto}>PRÓXIMAMENTE</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
          <Text style={styles.cardSubtitulo}>
            {item.cantidad_articulos} artículo{item.cantidad_articulos !== 1 ? 's' : ''} — {item.ubicacion}
          </Text>
          {bloqueada ? (
            <TouchableOpacity
              style={styles.botonMejorar}
              onPress={() => router.push('/(tabs)/perfil')}
            >
              <Text style={styles.botonMejorarTexto}>MEJORAR MEMBRESÍA</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.botonCatalogo}
              onPress={() => router.push({
                pathname: '/catalogo/[id]',
                params: { id: item.subasta_id, titulo: item.titulo },
              })}
            >
              <Text style={styles.botonCatalogoTexto}>VER CATÁLOGO</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!cargandoMas) return null;
    return <ActivityIndicator size="small" color="#000" style={{ paddingVertical: 16 }} />;
  };

  if (cargando && subastas.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
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
            <View style={styles.headerSpacer} />
            <Text style={styles.headerTitulo}>REMATIX</Text>
            <TouchableOpacity onPress={handleToggleBusqueda}>
              <Ionicons name="search" size={22} color="#000" />
            </TouchableOpacity>
          </>
        )}
      </View>

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
          <Text style={[styles.pildoraTexto, !categoriaSeleccionada && styles.pildoraTextoActivo]}>TODAS</Text>
        </TouchableOpacity>
        {categorias.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.pildora, categoriaSeleccionada === cat.id && styles.pildoraActiva]}
            onPress={() => handleCategoriaPress(cat.id)}
          >
            <Text style={[styles.pildoraTexto, categoriaSeleccionada === cat.id && styles.pildoraTextoActivo]}>
              {cat.nombre}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={subastas}
        keyExtractor={item => item.subasta_id}
        renderItem={renderSubastaCard}
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerSpacer: { width: 22 },
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
  categoriasScroll: { maxHeight: 50, backgroundColor: '#fff' },
  categoriasContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pildora: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EAEAEA',
  },
  pildoraActiva: { backgroundColor: '#000' },
  pildoraTexto: { fontSize: 13, fontWeight: '600', color: '#000', letterSpacing: 1 },
  pildoraTextoActivo: { color: '#fff' },
  listContent: { padding: 16, paddingTop: 12, gap: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imagenContainer: {
    height: 180,
    backgroundColor: '#EAEAEA',
  },
  imagen: {
    width: '100%',
    height: '100%',
  },
  imagenBloqueada: {
    flex: 1,
    backgroundColor: '#555',
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
  badgeVivo: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#000',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeVivoTexto: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  badgeProximamente: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeProximamenteTexto: { color: '#000', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  cardBody: { padding: 14, gap: 8 },
  cardTitulo: { fontSize: 18, fontWeight: '700', color: '#000' },
  cardSubtitulo: { fontSize: 13, color: '#666' },
  botonCatalogo: {
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  botonCatalogoTexto: { fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1 },
  botonMejorar: {
    backgroundColor: '#000',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  botonMejorarTexto: { fontSize: 13, fontWeight: '700', color: '#fff', letterSpacing: 1 },
});
