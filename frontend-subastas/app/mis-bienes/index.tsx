import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';

interface ProductoItem {
  producto_id: string | number;
  descripcioncatalogo: string | null;
  descripcioncompleta: string | null;
  status: 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';
  fotos: string[];
}

export default function MisBienesScreen() {
  const { token, removeToken } = useAuth();
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProductos();
    setRefreshing(false);
  }, [fetchProductos]);

  const renderBadge = (status: ProductoItem['status']) => {
    if (status === 'APROBADO') return { label: 'APROBADO', style: styles.badgeApproved };
    if (status === 'RECHAZADO') return { label: 'RECHAZADO', style: styles.badgeRejected };
    return { label: 'EN REVISION', style: styles.badgePending };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MIS BIENES</Text>
        <View style={styles.headerBack} />
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/mis-bienes/agregar-producto')}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addButtonText}>AGREGAR PRODUCTO</Text>
        </TouchableOpacity>

        {productos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Todavía no cargaste productos</Text>
            <Text style={styles.emptyText}>Usá el botón de arriba para publicar un artículo.</Text>
          </View>
        ) : (
          productos.map((producto) => {
            const badge = renderBadge(producto.status);
            const foto = producto.fotos?.[0] || null;
            return (
              <View key={String(producto.producto_id)} style={styles.card}>
                <View style={styles.cardImageWrap}>
                  {foto ? (
                    <Image source={{ uri: foto }} style={styles.cardImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.cardImagePlaceholder}>
                      <Ionicons name="image-outline" size={28} color="#CCC" />
                    </View>
                  )}
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {producto.descripcioncatalogo || 'Producto sin nombre'}
                    </Text>
                    <Text style={[styles.badge, badge.style]}>{badge.label}</Text>
                  </View>
                  {producto.descripcioncompleta ? (
                    <Text style={styles.cardSubtitle} numberOfLines={2}>
                      {producto.descripcioncompleta}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerBack: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', letterSpacing: 2 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
  },
  addButtonText: { color: '#FFF', fontWeight: '700', letterSpacing: 1, fontSize: 12 },
  emptyState: { paddingVertical: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#111' },
  emptyText: { marginTop: 8, color: '#777', textAlign: 'center' },
  card: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginBottom: 12, gap: 12 },
  cardImageWrap: { width: 70, height: 70, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F1F1' },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', flex: 1 },
  cardSubtitle: { marginTop: 6, color: '#666', fontSize: 12 },
  badge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badgeApproved: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  badgePending: { backgroundColor: '#FFF8E1', color: '#C57B00' },
  badgeRejected: { backgroundColor: '#FFEBEE', color: '#C62828' },
  rejectReason: { marginTop: 6, color: '#C62828', fontSize: 12 },
});
