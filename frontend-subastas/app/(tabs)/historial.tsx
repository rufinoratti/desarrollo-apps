import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { Skeleton, SkeletonCircle, SkeletonLine } from '@/src/components/Skeleton';
import { API_URL } from '@/src/config/env';

type EstadoItem = 'OK' | 'PENDIENTE' | 'ADVERTENCIA';

type EstadoCuentaItem = {
  id: string;
  label: string;
  status: EstadoItem;
  detalle: string;
};

type EstadoCuentaData = {
  estado_general: 'CORRECTO' | 'CON_OBSERVACIONES' | 'CON_DEUDA' | 'BLOQUEADO' | 'EN_REVISION';
  mensaje_principal: string;
  timestamp_verificacion: string;
  usuario: {
    id: string;
    nombre_completo: string | null;
    email: string | null;
    categoria: string | null;
    foto_url: string | null;
  };
  verificacion: {
    admitido: 'si' | 'no' | null;
    categoria: string | null;
    bloqueado: boolean;
  };
  cuenta_cobro: {
    entidad_bancaria: string | null;
    numero_cbu: string | null;
    estado_verificacion: 'VERIFICADA' | 'EN_REVISION';
    es_principal: boolean;
  } | null;
  es_duenio: boolean;
  items: EstadoCuentaItem[];
  resumen: {
    puntos_ok: number;
    puntos_pendientes: number;
    puntos_advertencia: number;
    total_puntos: number;
  };
};

const STATUS_META: Record<EstadoItem, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  OK: { color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-circle' },
  PENDIENTE: { color: '#8D6E63', bg: '#FFF8E1', icon: 'ellipse-outline' },
  ADVERTENCIA: { color: '#D32F2F', bg: '#FFEBEE', icon: 'alert-circle' },
};

const ESTADO_GENERAL_META: Record<
  EstadoCuentaData['estado_general'],
  { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; titulo: string }
> = {
  CORRECTO: { color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-circle', titulo: 'VERIFICADA' },
  CON_OBSERVACIONES: { color: '#2E7D32', bg: '#E8F5E9', icon: 'checkmark-circle', titulo: 'VERIFICADA' },
  CON_DEUDA: { color: '#D32F2F', bg: '#FFEBEE', icon: 'alert-circle', titulo: 'CON DEUDA' },
  BLOQUEADO: { color: '#D32F2F', bg: '#FFEBEE', icon: 'lock-closed', titulo: 'CUENTA BLOQUEADA' },
  EN_REVISION: { color: '#8D6E63', bg: '#FFF8E1', icon: 'hourglass-outline', titulo: 'EN REVISIÓN' },
};

export default function EstadoCuentaScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<EstadoCuentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const circleScale = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;
  const messageOpacity = useRef(new Animated.Value(0)).current;
  const messageTranslate = useRef(new Animated.Value(12)).current;
  const itemsOpacity = useRef(new Animated.Value(0)).current;
  const itemsTranslate = useRef(new Animated.Value(20)).current;

  const fetchData = async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`${API_URL}/api/perfil/estado-cuenta`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        setError('Sesión expirada');
        return;
      }
      if (!res.ok) {
        setError('No se pudo cargar el estado de cuenta');
        return;
      }
      const json: EstadoCuentaData = await res.json();
      setData(json);
      setError(null);
      runEntranceAnimation();
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runEntranceAnimation = () => {
    circleScale.setValue(0);
    circleOpacity.setValue(0);
    ringScale.setValue(0.6);
    ringOpacity.setValue(0.6);
    checkProgress.setValue(0);
    messageOpacity.setValue(0);
    messageTranslate.setValue(12);
    itemsOpacity.setValue(0);
    itemsTranslate.setValue(20);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(circleScale, {
          toValue: 1,
          friction: 5,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(circleOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(checkProgress, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(messageOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(messageTranslate, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.parallel([
          Animated.timing(ringScale, {
            toValue: 1.5,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(ringOpacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
      Animated.parallel([
        Animated.timing(itemsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(itemsTranslate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (!token) return;
    fetchData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onRefresh = () => {
    fetchData(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.content}>
          <Text style={styles.subtitle}>ESTADO DE CUENTA</Text>
          <Text style={styles.title}>Verificación de cuenta</Text>

          <View style={styles.heroContainer}>
            <SkeletonCircle size={120} style={{ marginBottom: 20 }} />
            <Skeleton width={140} height={28} borderRadius={14} style={{ marginBottom: 12 }} />
            <SkeletonLine width={260} height={16} style={{ marginBottom: 8 }} />
            <SkeletonLine width={140} height={12} />
          </View>

          <View style={styles.scoreRow}>
            <Skeleton width={70} height={28} borderRadius={14} />
            <Skeleton width={110} height={28} borderRadius={14} />
          </View>

          <Text style={styles.sectionTitle}>DETALLE DE VERIFICACIÓN</Text>
          <View style={{ gap: 8, marginBottom: 25 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.itemRow}>
                <Skeleton width={36} height={36} borderRadius={18} style={{ marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <SkeletonLine width="50%" height={13} style={{ marginBottom: 6 }} />
                  <SkeletonLine width="80%" height={11} />
                </View>
                <Skeleton width={50} height={20} borderRadius={10} />
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header />
        <View style={styles.centered}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="cloud-offline-outline" size={40} color="#999" />
          </View>
          <Text style={styles.errorTitle}>No se pudo cargar</Text>
          <Text style={styles.errorText}>{error || 'Error desconocido'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(false)}>
            <Text style={styles.retryButtonText}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const generalMeta = ESTADO_GENERAL_META[data.estado_general];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />
        }
      >
        <Text style={styles.subtitle}>ESTADO DE CUENTA</Text>
        <Text style={styles.title}>Verificación de cuenta</Text>

        <View style={styles.heroContainer}>
          <Animated.View
            style={[
              styles.ring,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
                backgroundColor: generalMeta.bg,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.checkCircle,
              {
                backgroundColor: generalMeta.bg,
                borderColor: generalMeta.color,
                transform: [{ scale: circleScale }],
                opacity: circleOpacity,
              },
            ]}
          >
            <Animated.View
              style={{
                opacity: checkProgress,
                transform: [
                  {
                    scale: checkProgress.interpolate({
                      inputRange: [0, 0.6, 1],
                      outputRange: [0.4, 1.15, 1],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name={generalMeta.icon} size={64} color={generalMeta.color} />
            </Animated.View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: messageOpacity,
              transform: [{ translateY: messageTranslate }],
              alignItems: 'center',
            }}
          >
            <View style={[styles.statusPill, { backgroundColor: generalMeta.bg, borderColor: generalMeta.color }]}>
              <Text style={[styles.statusPillText, { color: generalMeta.color }]}>{generalMeta.titulo}</Text>
            </View>
            <Text style={styles.mensajePrincipal}>{data.mensaje_principal}</Text>
          </Animated.View>
        </View>

        <View style={styles.scoreRow}>
          <View style={[styles.scorePill, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#2E7D32" />
            <Text style={[styles.scorePillText, { color: '#2E7D32' }]}>
              {data.resumen.puntos_ok} OK
            </Text>
          </View>
          {data.resumen.puntos_pendientes > 0 && (
            <View style={[styles.scorePill, { backgroundColor: '#FFF8E1' }]}>
              <Ionicons name="ellipse-outline" size={16} color="#8D6E63" />
              <Text style={[styles.scorePillText, { color: '#8D6E63' }]}>
                {data.resumen.puntos_pendientes} pendiente
              </Text>
            </View>
          )}
          {data.resumen.puntos_advertencia > 0 && (
            <View style={[styles.scorePill, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="alert-circle" size={16} color="#D32F2F" />
              <Text style={[styles.scorePillText, { color: '#D32F2F' }]}>
                {data.resumen.puntos_advertencia} advertencia
              </Text>
            </View>
          )}
        </View>

        <Animated.View
          style={{
            opacity: itemsOpacity,
            transform: [{ translateY: itemsTranslate }],
          }}
        >
          <Text style={styles.sectionTitle}>DETALLE DE VERIFICACIÓN</Text>

          {data.items.map((item) => {
            const meta = STATUS_META[item.status];
            return (
              <View key={item.id} style={styles.itemRow}>
                <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={20} color={meta.color} />
                </View>
                <View style={styles.itemTextContainer}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <Text style={styles.itemDetalle} numberOfLines={2}>
                    {item.detalle}
                  </Text>
                </View>
                <View style={[styles.itemStatusBadge, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.itemStatusText, { color: meta.color }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
            );
          })}

          {data.cuenta_cobro && (
            <>
              <Text style={styles.sectionTitle}>CUENTA DE COBRO</Text>
              <View style={styles.bankCard}>
                <View style={styles.bankRow}>
                  <Ionicons name="business-outline" size={18} color="#666" />
                  <Text style={styles.bankLabel}>Banco</Text>
                  <Text style={styles.bankValue}>{data.cuenta_cobro.entidad_bancaria || '—'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Ionicons name="card-outline" size={18} color="#666" />
                  <Text style={styles.bankLabel}>CBU/Alias</Text>
                  <Text style={styles.bankValue} numberOfLines={1}>
                    {data.cuenta_cobro.numero_cbu || '—'}
                  </Text>
                </View>
                <View style={styles.bankRow}>
                  <Ionicons
                    name={
                      data.cuenta_cobro.estado_verificacion === 'VERIFICADA'
                        ? 'shield-checkmark'
                        : 'hourglass-outline'
                    }
                    size={18}
                    color={data.cuenta_cobro.estado_verificacion === 'VERIFICADA' ? '#2E7D32' : '#8D6E63'}
                  />
                  <Text style={styles.bankLabel}>Estado</Text>
                  <Text
                    style={[
                      styles.bankValue,
                      {
                        color:
                          data.cuenta_cobro.estado_verificacion === 'VERIFICADA' ? '#2E7D32' : '#8D6E63',
                      },
                    ]}
                  >
                    {data.cuenta_cobro.estado_verificacion === 'VERIFICADA' ? 'Verificada' : 'En revisión'}
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>INFORMACIÓN DE LA CUENTA</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="person-outline" label="Titular" value={data.usuario.nombre_completo || '—'} />
            <InfoRow icon="mail-outline" label="Email" value={data.usuario.email || '—'} />
            <InfoRow
              icon="ribbon-outline"
              label="Categoría"
              value={data.verificacion.categoria || 'Sin categoría'}
            />
            <InfoRow
              icon="shield-checkmark-outline"
              label="Validación"
              value={
                data.verificacion.admitido === 'si'
                  ? 'Aprobada'
                  : data.verificacion.admitido === 'no'
                    ? 'Rechazada'
                    : 'En revisión'
              }
            />
          </View>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => router.push('/(tabs)/perfil')}
          >
            <Ionicons name="settings-outline" size={18} color="#000" />
            <Text style={styles.ctaButtonText}>IR A MI PERFIL</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>
      <Text style={styles.logo}>REMATIX</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#666" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
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
    fontSize: 16,
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
  heroContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  ring: {
    position: 'absolute',
    top: 10,
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  mensajePrincipal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 30,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  scorePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 15,
    marginTop: 5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 2,
  },
  itemDetalle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  itemStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 8,
  },
  itemStatusText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bankCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bankLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    width: 80,
  },
  bankValue: {
    flex: 1,
    fontSize: 13,
    color: '#000',
    fontWeight: '700',
  },
  infoCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 25,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '700',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 10,
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1.5,
  },
});
