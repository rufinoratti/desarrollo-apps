import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { Skeleton, SkeletonCircle, SkeletonLine } from '@/src/components/Skeleton';
import { API_URL } from '@/src/config/env';

type MedioDetalle = {
  id: string;
  tipo_pago: string;
  descripcion_corta: string;
  estado: string;
  es_principal: boolean;
  entidad: string;
  moneda: string;
  limite_garantia: number;
};

const TIPO_LABELS: Record<string, string> = {
  CUENTA_BANCARIA: 'Cuenta Bancaria',
  TARJETA: 'Tarjeta de Crédito',
  CHEQUE: 'Cheque Certificado',
};

const TIPO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  CUENTA_BANCARIA: 'business-outline',
  TARJETA: 'card-outline',
  CHEQUE: 'document-text-outline',
};

export default function MedioPagoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [medio, setMedio] = useState<MedioDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`${API_URL}/api/billetera/medios-pago/${id}`, {
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
        if (data) setMedio(data);
      })
      .catch(() => Alert.alert('Error', 'No se pudo cargar el medio de pago'))
      .finally(() => setLoading(false));
  }, [token, id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/(tabs)/billetera')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.logo}>REMATIX</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.iconContainer}>
            <SkeletonCircle size={80} />
          </View>
          <View style={{ alignItems: 'center', marginBottom: 25, gap: 10 }}>
            <SkeletonLine width={180} height={20} />
            <Skeleton width={90} height={22} borderRadius={10} />
          </View>

          <View style={styles.detailCard}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.detailRow}>
                <SkeletonLine width={90} height={12} />
                <SkeletonLine width={120} height={14} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!medio) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={{ color: '#999' }}>Medio de pago no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(tabs)/billetera')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.logo}>REMATIX</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={styles.bigIconCircle}>
            <Ionicons name={TIPO_ICONS[medio.tipo_pago] || 'wallet-outline'} size={40} color="#000" />
          </View>
        </View>

        <Text style={styles.tipoLabel}>{TIPO_LABELS[medio.tipo_pago] || medio.tipo_pago}</Text>

        {medio.es_principal && (
          <View style={styles.principalBadge}>
            <Text style={styles.principalText}>PRINCIPAL</Text>
          </View>
        )}

        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Descripción</Text>
            <Text style={styles.detailValue}>{medio.descripcion_corta}</Text>
          </View>

          {medio.entidad ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Entidad</Text>
              <Text style={styles.detailValue}>{medio.entidad}</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Estado</Text>
            <View style={[styles.statusBadge, medio.estado === 'VERIFICADA' ? styles.statusVerified : styles.statusReview]}>
              <Text style={styles.statusText}>{medio.estado}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Moneda</Text>
            <Text style={styles.detailValue}>{medio.moneda}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Disponible</Text>
            <Text style={styles.detailValue}>
              {Number(medio.limite_garantia).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}
            </Text>
          </View>
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
  content: { padding: 20, alignItems: 'center' },
  iconContainer: { marginTop: 20, marginBottom: 15 },
  bigIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tipoLabel: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  principalBadge: {
    backgroundColor: '#000',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 25,
  },
  principalText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  detailCard: {
    width: '100%',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  detailLabel: { fontSize: 13, color: '#888', fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#222', flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  statusVerified: { backgroundColor: '#E8F5E9' },
  statusReview: { backgroundColor: '#FFF3E0' },
  statusText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
});
