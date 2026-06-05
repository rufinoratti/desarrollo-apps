import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { Skeleton } from '@/src/components/Skeleton';
import { API_URL } from '@/src/config/env';

type Estadisticas = {
  subastas_participadas: number;
  lotes_ganados: number;
  total_pujas: number;
  inversion_total: number;
};

export default function MetricasHistorial() {
  const { token } = useAuth();
  const [estadisticas, setEstadisticas] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/perfil/estadisticas`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.status === 401) {
          Alert.alert('Sesión expirada', 'Inicia sesión nuevamente.');
          router.back();
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setEstadisticas(data);
      })
      .catch(() => Alert.alert('Error', 'No se pudieron cargar las estadísticas'))
      .finally(() => setLoading(false));
  }, [token]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

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

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>MÉTRICAS E HISTORIAL</Text>
          <Text style={styles.title}>Estadísticas del Usuario</Text>

          <View style={styles.grid}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.statCard}>
                <Skeleton width={44} height={44} borderRadius={22} style={{ marginBottom: 12 }} />
                <Skeleton width="60%" height={22} style={{ marginBottom: 8 }} />
                <Skeleton width="80%" height={10} />
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>HISTORIAL DE PUJAS</Text>
          <View style={{ gap: 10 }}>
            <Skeleton width="100%" height={70} borderRadius={12} />
            <Skeleton width="100%" height={70} borderRadius={12} />
            <Skeleton width="100%" height={70} borderRadius={12} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const stats = [
    { label: 'Subastas\nParticipadas', value: String(estadisticas?.subastas_participadas ?? 0), icon: 'hammer-outline' as const },
    { label: 'Lotes\nGanados', value: String(estadisticas?.lotes_ganados ?? 0), icon: 'trophy-outline' as const },
    { label: 'Total\nPujas', value: String(estadisticas?.total_pujas ?? 0), icon: 'trending-up-outline' as const },
    { label: 'Inversión\nTotal', value: formatCurrency(estadisticas?.inversion_total ?? 0), icon: 'cash-outline' as const },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.logo}>REMATIX</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>MÉTRICAS E HISTORIAL</Text>
        <Text style={styles.title}>Estadísticas del Usuario</Text>

        <View style={styles.grid}>
          {stats.map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <View style={styles.statIconCircle}>
                <Ionicons name={stat.icon} size={22} color="#000" />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>HISTORIAL DE PUJAS</Text>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="time-outline" size={40} color="#CCC" />
          </View>
          <Text style={styles.emptyText}>No hay historial de pujas disponible aún</Text>
        </View>
      </ScrollView>
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
  logo: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  content: { padding: 20, paddingTop: 10 },
  subtitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 5,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 25,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 35,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    textAlign: 'center',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
    textAlign: 'center',
  },
});
