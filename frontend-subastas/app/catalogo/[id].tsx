import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, FlatList, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';

interface ArticuloItem {
  item_id: string;
  numero_lote: string;
  titulo: string;
  imagen_principal: string;
  estado: string;
  tiempo_restante: string;
  oferta_actual: number;
  es_favorito: boolean;
}

interface CatalogoSubastaInfo {
  id: string;   
  titulo: string;
  estado: string;
}

export default function CatalogoScreen() {
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo: string }>();
  const { token, removeToken } = useAuth();

  // `removeToken` might not be referentially stable (eg. in tests).
  // Keep the latest function without forcing `fetchCatalogo` recreation.
  const removeTokenRef = useRef(removeToken);
  useEffect(() => {
    removeTokenRef.current = removeToken;
  }, [removeToken]);

  const [articulos, setArticulos] = useState<ArticuloItem[]>([]);
  const [subastaInfo, setSubastaInfo] = useState<CatalogoSubastaInfo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [ordenSeleccionado, setOrdenSeleccionado] = useState('lote_numero');
  const [modalOrdenVisible, setModalOrdenVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const ordenes = [
    { key: 'lote_numero', label: 'N° Lote' },
    { key: 'precio_asc', label: 'Precio: menor a mayor' },
    { key: 'precio_desc', label: 'Precio: mayor a menor' },
    { key: 'tiempo_asc', label: 'Tiempo restante' },
  ];

  const fetchCatalogo = useCallback(async (q?: string, ord?: string) => {
    setCargando(true);
    try {
      let url = `${API_URL}/subastas/${id}/catalogo?orden=${ord || ordenSeleccionado}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        removeTokenRef.current?.();
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setSubastaInfo(data.subasta_info);
      setArticulos(data.articulos);
    } catch {
      // Silencioso
    } finally {
      setCargando(false);
    }
  }, [id, ordenSeleccionado, token]);

  useEffect(() => {
    if (token) fetchCatalogo();
  }, [token, fetchCatalogo]);

  const handleToggleBusqueda = () => {
    setBusquedaVisible(!busquedaVisible);
    if (!busquedaVisible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTextoBusqueda('');
      fetchCatalogo();
    }
  };

  const handleSearch = () => {
    fetchCatalogo(textoBusqueda);
  };

  const handleOrdenChange = (key: string) => {
    setOrdenSeleccionado(key);
    setModalOrdenVisible(false);
    fetchCatalogo(textoBusqueda || undefined, key);
  };

  const formatearPrecio = (monto: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(monto);
  };

  const renderArticulo = ({ item }: { item: ArticuloItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => {
        // Futuro: navegar a detalle del artículo
      }}
    >
      <Image source={{ uri: item.imagen_principal }} style={styles.cardImagen} resizeMode="cover" />
      <TouchableOpacity style={styles.favoritoBtn} onPress={() => {}}>
        <Ionicons
          name={item.es_favorito ? 'heart' : 'heart-outline'}
          size={20}
          color={item.es_favorito ? '#D32F2F' : '#fff'}
        />
      </TouchableOpacity>
      <View style={styles.cardBody}>
        <Text style={styles.loteNumero}>{item.numero_lote}</Text>
        <Text style={styles.cardTitulo} numberOfLines={2}>{item.titulo}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.ofertaLabel}>OFERTA ACTUAL</Text>
            <Text style={styles.ofertaMonto}>{formatearPrecio(item.oferta_actual)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.tiempoLabel}>⏱ {item.tiempo_restante}</Text>
            <Text style={styles.estadoTexto}>{item.estado}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (cargando && articulos.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <TouchableOpacity onPress={handleToggleBusqueda} style={styles.headerAction}>
          <Ionicons name={busquedaVisible ? 'close' : 'search'} size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {busquedaVisible && (
        <View style={styles.busquedaBar}>
          <TextInput
            ref={inputRef}
            style={styles.busquedaInput}
            placeholder="Buscar artículos..."
            placeholderTextColor="#999"
            value={textoBusqueda}
            onChangeText={setTextoBusqueda}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {textoBusqueda.length > 0 && (
            <TouchableOpacity onPress={() => { setTextoBusqueda(''); fetchCatalogo(); }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <Text style={styles.subastaTitulo}>{subastaInfo?.titulo || titulo || 'Catálogo'}</Text>

      <View style={styles.subheader}>
        <Text style={styles.totalArticulos}>
          {articulos.length} artículo{articulos.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.ordenBtn}
          onPress={() => setModalOrdenVisible(true)}
        >
          <Ionicons name="funnel-outline" size={16} color="#000" />
          <Text style={styles.ordenTexto}>{ordenes.find(o => o.key === ordenSeleccionado)?.label}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={articulos}
        keyExtractor={item => item.item_id}
        renderItem={renderArticulo}
        contentContainerStyle={styles.listContent}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        showsVerticalScrollIndicator={false}
      />

      <Modal visible={modalOrdenVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalOrdenVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>ORDENAR POR</Text>
            {ordenes.map((ord) => (
              <TouchableOpacity
                key={ord.key}
                style={[styles.modalOpcion, ordenSeleccionado === ord.key && styles.modalOpcionActiva]}
                onPress={() => handleOrdenChange(ord.key)}
              >
                <Text style={[styles.modalOpcionTexto, ordenSeleccionado === ord.key && styles.modalOpcionTextoActiva]}>
                  {ord.label}
                </Text>
                {ordenSeleccionado === ord.key && (
                  <Ionicons name="checkmark" size={20} color="#000" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerBack: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#000',
  },
  headerAction: {
    width: 40,
    alignItems: 'flex-end',
  },
  busquedaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 8,
  },
  busquedaInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 4,
  },
  subastaTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  subheader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  totalArticulos: { fontSize: 13, color: '#666' },
  ordenBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ordenTexto: { fontSize: 13, fontWeight: '600', color: '#000' },
  listContent: { padding: 16, gap: 16 },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: '48%',
  },
  cardImagen: { width: '100%', height: 160, backgroundColor: '#EAEAEA' },
  favoritoBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 6,
  },
  cardBody: { padding: 12, gap: 6 },
  loteNumero: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1 },
  cardTitulo: { fontSize: 14, fontWeight: '700', color: '#000' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 },
  ofertaLabel: { fontSize: 10, color: '#999', letterSpacing: 1 },
  ofertaMonto: { fontSize: 15, fontWeight: '700', color: '#000' },
  tiempoLabel: { fontSize: 12, color: '#666' },
  estadoTexto: { fontSize: 11, fontWeight: '700', color: '#000', letterSpacing: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
  },
  modalTitulo: { fontSize: 16, fontWeight: '700', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },
  modalOpcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOpcionActiva: {},
  modalOpcionTexto: { fontSize: 15, color: '#666' },
  modalOpcionTextoActiva: { color: '#000', fontWeight: '600' },
});
