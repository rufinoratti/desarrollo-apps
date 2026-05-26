import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, FlatList, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';

interface ArticuloItem {
  id: string;
  numero_lote: string;
  titulo: string;
  precio_base: number;
  imagen_principal: string;
  estado: string;
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
      let url = `${API_URL}/api/subastas/${id}/catalogo?orden=${ord || ordenSeleccionado}`;
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
    return `$ ${new Intl.NumberFormat('es-AR', {
      maximumFractionDigits: 0,
    }).format(monto)}`;
  };

  const calcularTiempoRestante = (fechaFin: string | undefined) => {
    if (!fechaFin) return '00h 00m';
    
    // Si no hay fecha en el backend para artículos, ponemos un mock para mostrar algo dinámico
    const ahora = new Date().getTime();
    const fin = new Date(ahora + 12 * 60 * 60 * 1000 + 15 * 60 * 1000).getTime(); // Mock +12h 15m
    
    const diferencia = fin - ahora;
    if (diferencia <= 0) return '00h 00m';

    const horas = Math.floor((diferencia % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));

    return `${horas.toString().padStart(2, '0')}h ${minutos.toString().padStart(2, '0')}m`;
  };

  const renderArticulo = ({ item }: { item: ArticuloItem }) => (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          // Futuro: navegar a detalle del artículo
        }}
        style={styles.imageContainer}
      >
        <Image source={{ uri: item.imagen_principal }} style={styles.cardImagen} resizeMode="contain" />
        
        {item.estado === 'DISPONIBLE' && (
          <View style={styles.badgeEnVivo}>
            <Text style={styles.badgeEnVivoTexto}>EN VIVO</Text>
          </View>
        )}

        <View style={styles.badgeRestan}>
          <Text style={styles.badgeRestanLabel}>RESTAN</Text>
          <Text style={styles.badgeRestanTexto}>{calcularTiempoRestante(undefined)}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.loteNumero}>LOTE {String(item.numero_lote).padStart(3, '0')}</Text>
            <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
          </View>
          <TouchableOpacity style={styles.favoritoBtn}>
            <Ionicons name="heart-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.ofertaLabel}>OFERTA ACTUAL</Text>
            <Text style={styles.ofertaMonto}>{formatearPrecio(item.precio_base)}</Text>
          </View>
          <TouchableOpacity style={styles.pujarBtn}>
            <Text style={styles.pujarBtnTexto}>PUJAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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

      <FlatList
        data={articulos}
        keyExtractor={item => item.id}
        renderItem={renderArticulo}
        contentContainerStyle={styles.listContent}
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
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, gap: 24 },
  card: {
    width: '100%',
    backgroundColor: '#F8F9FA',
  },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#EAEAEA',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardImagen: { width: '100%', height: '100%' },
  badgeEnVivo: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 2,
  },
  badgeEnVivoTexto: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  badgeRestan: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(230, 230, 230, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    minWidth: 90,
  },
  badgeRestanLabel: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 1,
  },
  badgeRestanTexto: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    textAlign: 'center',
  },
  cardBody: { paddingHorizontal: 4 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  cardTitleContainer: {
    flex: 1,
    paddingRight: 16,
  },
  loteNumero: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 1, marginBottom: 4 },
  cardTitulo: { fontSize: 16, fontWeight: '700', color: '#000' },
  favoritoBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginBottom: 16 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ofertaLabel: { fontSize: 10, color: '#999', fontWeight: '600', letterSpacing: 1, marginBottom: 4, textTransform: 'uppercase' },
  ofertaMonto: { fontSize: 18, fontWeight: '700', color: '#000' },
  pujarBtn: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16 },
  pujarBtnTexto: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
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
