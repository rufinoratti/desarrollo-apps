import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { SkeletonList } from '@/src/components/Skeleton';
import { API_URL } from '@/src/config/env';

type MedioPago = {
  id: string;
  tipo_pago: string;
  descripcion_corta: string;
  estado: string;
  es_principal: boolean;
};

export default function Billetera() {
  const { token } = useAuth();
  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchMedios = useCallback(async (isRefresh = false) => {
    if (!token) return;
    try {
      if (!isRefresh) setLoading(true);
      const res = await fetch(`${API_URL}/api/billetera/medios-pago`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        Alert.alert('Sesión expirada', 'Inicia sesión nuevamente.');
        return;
      }
      const data = await res.json();
      setMedios(data);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los medios de pago');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchMedios();
    }, [fetchMedios])
  );

  const handleDelete = (id: string) => {
    Alert.alert(
      'Eliminar medio de pago',
      '¿Estás seguro de que deseas eliminar este medio de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setDeletingId(id);
            try {
              const res = await fetch(`${API_URL}/api/billetera/medios-pago/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                setMedios((prev) => prev.filter((m) => m.id !== id));
              } else {
                Alert.alert('Error', data.error || 'No se pudo eliminar');
              }
            } catch {
              Alert.alert('Error', 'Error de conexión');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const getIconName = (tipo: string) => {
    switch (tipo) {
      case 'CUENTA_BANCARIA':
        return 'business-outline';
      case 'TARJETA':
        return 'card-outline';
      case 'CHEQUE':
        return 'document-text-outline';
      default:
        return 'wallet-outline';
    }
  };

  const renderMedio = ({ item }: { item: MedioPago }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(tabs)/medio-pago-detalle?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={styles.iconCircle}>
          <Ionicons name={getIconName(item.tipo_pago)} size={22} color="#000" />
        </View>
      </View>
      <View style={styles.cardCenter}>
        <Text style={styles.cardDescription}>{item.descripcion_corta}</Text>
      </View>
      <View style={styles.cardRight}>
        {item.es_principal && (
          <View style={styles.principalBadge}>
            <Text style={styles.principalText}>PRINCIPAL</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.logo}>REMATIX</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.subtitle}>GESTIÓN DE FONDOS</Text>
        <Text style={styles.title}>Administrar Medios de Pago</Text>

        <View style={styles.list}>
          <SkeletonList rows={4} gap={12} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.logo}>REMATIX</Text>
        <View style={{ width: 24 }} />
      </View>

      <Text style={styles.subtitle}>GESTIÓN DE FONDOS</Text>
      <Text style={styles.title}>Administrar Medios de Pago</Text>

      {medios.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="wallet-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No tienes medios de pago registrados</Text>
        </View>
      ) : (
        <FlatList
          data={medios}
          keyExtractor={(item) => item.id}
          renderItem={renderMedio}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchMedios(true);
              }}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(auth)/registro/paso4-pago?addOnly=true')}
        >
          <Text style={styles.addButtonText}>AGREGAR MEDIO DE PAGO +</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 5,
  },
  backButton: { padding: 5 },
  logo: { fontSize: 23, fontWeight: '900', letterSpacing: 1 },
  subtitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 5,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 25,
    paddingHorizontal: 20,
    marginTop: 5,
  },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardLeft: { marginRight: 14 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCenter: { flex: 1 },
  cardDescription: { fontSize: 17, fontWeight: '600', color: '#222' },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  principalBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  principalText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  deleteButton: { padding: 4 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyText: { marginTop: 15, fontSize: 14, color: '#999', fontWeight: '500' },
  footer: { padding: 20, paddingBottom: 30 },
  addButton: {
    backgroundColor: '#000',
    borderRadius: 25,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});
