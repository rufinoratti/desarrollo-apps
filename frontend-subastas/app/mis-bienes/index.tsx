import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, ScrollView, RefreshControl, Alert, Modal, Dimensions, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductoItem {
  producto_id: string | number;
  descripcioncatalogo: string | null;
  descripcioncompleta: string | null;
  status: 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'RETIRADO';
  preciobase: number | null;
  comision: number | null;
  fotos: string[];
}

const STATUS_CONFIG = {
  APROBADO: { label: 'APROBADO', color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-circle' as const },
  RECHAZADO: { label: 'RECHAZADO', color: '#C62828', bg: '#FFEBEE', icon: 'close-circle' as const },
  EN_REVISION: { label: 'EN REVISION', color: '#C57B00', bg: '#FFF8E1', icon: 'time' as const },
  RETIRADO: { label: 'RETIRADO', color: '#78909C', bg: '#ECEFF1', icon: 'return-up-back-outline' as const },
};

function formatPrice(value: number | null): string {
  if (value === null || value === undefined) return '';
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MisBienesScreen() {
  const { token, removeToken } = useAuth();
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [retiredIds, setRetiredIds] = useState<(string | number)[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<ProductoItem | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const fetchProductos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/mis-bienes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await removeToken();
        return;
      }
      if (!res.ok) {
        setProductos([]);
        return;
      }
      const data = await res.json();
      setProductos(data.productos || []);
    } catch {
      setProductos([]);
    } finally {
      setLoading(false);
    }
  }, [token, removeToken]);

  useFocusEffect(
    useCallback(() => {
      fetchProductos();
    }, [fetchProductos])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProductos();
    setRefreshing(false);
  }, [fetchProductos]);

  const handleDeleteProducto = useCallback(
    (productoId: string | number) => {
      if (!token) return;

      const alreadyRetired = retiredIds.includes(productoId);

      if (alreadyRetired) {
        Alert.alert('Eliminar de la lista', '¿Eliminar este producto de la lista? (ya fue retirado de la subasta)', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => {
              setSelectedProducto(null);
              setProductos((prev) => prev.filter((p) => p.producto_id !== productoId));
              setRetiredIds((prev) => prev.filter((id) => id !== productoId));
            },
          },
        ]);
        return;
      }

      Alert.alert('Retirar artículo', '¿Estás seguro de que deseas retirar este artículo de la subasta?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(productoId);
            try {
              const res = await fetch(`${API_URL}/api/mis-bienes/productos/${productoId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (res.status === 401) {
                await removeToken();
                return;
              }

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || errData.mensaje || 'No se pudo retirar el artículo');
              }

              setSelectedProducto(null);
              setRetiredIds((prev) => [...prev, productoId]);
              setProductos((prev) =>
                prev.map((p) =>
                  p.producto_id === productoId ? { ...p, status: 'RECHAZADO' as const } : p
                )
              );
            } catch (error) {
              const message = error instanceof Error ? error.message : 'No se pudo retirar el artículo';
              Alert.alert('Error', message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]);
    },
    [token, removeToken, retiredIds]
  );

  const openDetail = useCallback((producto: ProductoItem) => {
    setGalleryIndex(0);
    setSelectedProducto(producto);
  }, []);

  const closeDetail = useCallback(() => {
    setSelectedProducto(null);
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      setGalleryIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <View style={styles.headerBack} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />}
      >
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/mis-bienes/agregar-producto')} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>PUBLICAR NUEVO PRODUCTO</Text>
        </TouchableOpacity>

        {productos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={64} color="#CCC" />
            <Text style={styles.emptyTitle}>Todavía no cargaste productos</Text>
            <Text style={styles.emptyText}>Usá el botón de arriba para publicar tu primer artículo en subasta.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Tus productos ({productos.length})
            </Text>
            {productos.map((producto) => {
              const isRetired = retiredIds.includes(producto.producto_id);
              const displayStatus = isRetired ? 'RETIRADO' : producto.status;
              const statusCfg = STATUS_CONFIG[displayStatus];
              const foto = producto.fotos?.[0] || null;
              const fotosCount = producto.fotos?.length || 0;
              return (
                <TouchableOpacity
                  key={String(producto.producto_id)}
                  style={[styles.card, isRetired && styles.cardRetired]}
                  activeOpacity={0.92}
                  onPress={() => openDetail(producto)}
                >
                  <View style={styles.cardImageWrap}>
                    {foto ? (
                      <Image source={{ uri: foto }} style={styles.cardImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.cardImagePlaceholder}>
                        <Ionicons name="image-outline" size={40} color="#DDD" />
                      </View>
                    )}
                    <View style={[styles.cardBadge, { backgroundColor: statusCfg.bg }]}>
                      <Ionicons name={statusCfg.icon} size={12} color={statusCfg.color} />
                      <Text style={[styles.cardBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                    {fotosCount > 1 && (
                      <View style={styles.photoCount}>
                        <Ionicons name="images" size={12} color="#FFF" />
                        <Text style={styles.photoCountText}>{fotosCount}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {producto.descripcioncatalogo || 'Producto sin nombre'}
                    </Text>
                    {producto.descripcioncompleta ? (
                      <Text style={styles.cardSubtitle} numberOfLines={2}>
                        {producto.descripcioncompleta}
                      </Text>
                    ) : null}
                    <View style={styles.cardFooter}>
                      <View style={{ flex: 1 }} />
                      <TouchableOpacity
                        style={[styles.deleteButton, isRetired && styles.deleteButtonRetired]}
                        onPress={() => handleDeleteProducto(producto.producto_id)}
                        disabled={deletingId === producto.producto_id}
                      >
                        {deletingId === producto.producto_id ? (
                          <ActivityIndicator size="small" color="#C62828" />
                        ) : isRetired ? (
                          <Ionicons name="close-outline" size={18} color="#78909C" />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color="#C62828" />
                        )}
                      </TouchableOpacity>
                    </View>
                    {isRetired && (
                      <Text style={styles.retiredHint}>Toca para eliminar de la lista</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={!!selectedProducto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        {selectedProducto && (
          <DetailView
            producto={selectedProducto}
            onClose={closeDetail}
            onDelete={handleDeleteProducto}
            deletingId={deletingId}
            token={token}
            isRetired={retiredIds.includes(selectedProducto.producto_id)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function DetailView({
  producto,
  onClose,
  onDelete,
  deletingId,
  token,
  isRetired,
}: {
  producto: ProductoItem;
  onClose: () => void;
  onDelete: (id: string | number) => void;
  deletingId: string | number | null;
  token: string | null;
  isRetired?: boolean;
}) {
  const displayStatus = isRetired ? 'RETIRADO' : producto.status;
  const statusCfg = STATUS_CONFIG[displayStatus as keyof typeof STATUS_CONFIG];
  const fotos = producto.fotos?.length ? producto.fotos : [null];
  const [galleryIndex, setGalleryIndex] = useState(0);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems?.length) {
      setGalleryIndex(viewableItems[0].index ?? 0);
    }
  }, []);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  return (
    <SafeAreaView style={styles.modalContainer} edges={['top']}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose} style={styles.modalClose}>
          <Ionicons name="close" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Detalle del producto</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.galleryWrap}>
          <FlatList
            data={fotos}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            keyExtractor={(_, i) => String(i)}
            renderItem={({ item }) =>
              item ? (
                <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="cover" />
              ) : (
                <View style={[styles.galleryImage, styles.galleryPlaceholder]}>
                  <Ionicons name="image-outline" size={60} color="#DDD" />
                </View>
              )
            }
          />
          {fotos.length > 1 && (
            <View style={styles.galleryDots}>
              {fotos.map((_, i) => (
                <View key={i} style={[styles.dot, i === galleryIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.detailBody}>
          <View style={styles.detailTitleRow}>
            <Text style={styles.detailTitle}>
              {producto.descripcioncatalogo || 'Producto sin nombre'}
            </Text>
            <View style={[styles.detailBadge, { backgroundColor: statusCfg.bg }]}>
              <Ionicons name={statusCfg.icon} size={14} color={statusCfg.color} />
              <Text style={[styles.detailBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>
          </View>

          {producto.descripcioncompleta ? (
            <>
              <Text style={styles.detailSectionTitle}>Descripción</Text>
              <Text style={styles.detailDescription}>{producto.descripcioncompleta}</Text>
            </>
          ) : null}

          {(producto.preciobase || producto.comision) ? (
            <>
              <Text style={styles.detailSectionTitle}>Información de subasta</Text>
              <View style={styles.infoRow}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Precio base</Text>
                  <Text style={styles.infoValue}>{formatPrice(producto.preciobase)}</Text>
                </View>
                {producto.comision ? (
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Comisión</Text>
                    <Text style={styles.infoValue}>{producto.comision}%</Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : null}

          <TouchableOpacity
            style={[styles.modalDeleteButton, isRetired && styles.modalDeleteButtonMild]}
            onPress={() => onDelete(producto.producto_id)}
            disabled={deletingId === producto.producto_id}
            activeOpacity={0.8}
          >
            {deletingId === producto.producto_id ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : isRetired ? (
              <>
                <Ionicons name="close-outline" size={18} color="#FFF" />
                <Text style={styles.modalDeleteText}>ELIMINAR DE LA LISTA</Text>
              </>
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#FFF" />
                <Text style={styles.modalDeleteText}>RETIRAR DE LA SUBASTA</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBack: { width: 40 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#000',
  },
  scroll: { flex: 1, paddingHorizontal: 16 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  addButtonText: { color: '#FFF', fontWeight: '700', letterSpacing: 1, fontSize: 13 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyState: { paddingVertical: 60, alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#333' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', paddingHorizontal: 40, lineHeight: 20 },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardImageWrap: { width: '100%', height: 200, position: 'relative', backgroundColor: '#F5F5F5' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  cardBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  photoCount: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoCountText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111' },
  cardSubtitle: { fontSize: 13, color: '#888', lineHeight: 18 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardPrice: { fontSize: 17, fontWeight: '700', color: '#111' },
  cardRetired: { opacity: 0.75 },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonRetired: { backgroundColor: '#ECEFF1' },
  retiredHint: { fontSize: 11, color: '#999', fontStyle: 'italic', marginTop: 2 },

  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '600', color: '#111' },
  modalScroll: { flex: 1 },

  galleryWrap: { width: '100%', height: 320, position: 'relative', backgroundColor: '#F5F5F5' },
  galleryImage: { width: SCREEN_WIDTH, height: 320 },
  galleryPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  galleryDots: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  dotActive: { backgroundColor: '#FFF', width: 20 },

  detailBody: { padding: 20, gap: 16 },
  detailTitleRow: { gap: 10 },
  detailTitle: { fontSize: 22, fontWeight: '700', color: '#111', lineHeight: 28 },
  detailBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detailBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  detailSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: -4,
  },
  detailDescription: { fontSize: 15, color: '#333', lineHeight: 22 },
  infoRow: { flexDirection: 'row', gap: 20 },
  infoItem: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#999', marginBottom: 2 },
  infoValue: { fontSize: 18, fontWeight: '700', color: '#111' },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C62828',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  modalDeleteButtonMild: { backgroundColor: '#78909C' },
  modalDeleteText: { color: '#FFF', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
});
