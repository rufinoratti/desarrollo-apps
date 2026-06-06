import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, RefreshControl, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Skeleton } from '@/src/components/Skeleton';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/config/env';
import CountdownBadge from '@/src/components/CountdownBadge';

type Categoria = {
  id?: number;
  nombre?: string;
};

type Subasta = {
  id?: string | number; 
  subasta_id?: string;
  titulo?: string;
  imagen?: string;
  imagen_portada?: string;
  articulos?: number;
  cantidad_articulos?: number;
  ubicacion?: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
};

function getDisplayStatus(item: Subasta): string {
  const estadoLower = String(item.estado).toLowerCase();
  if (estadoLower === 'cerrada' || estadoLower === 'finalizada') return 'FINALIZADA';

  const now = Date.now();
  const start = item.fecha_inicio ? new Date(item.fecha_inicio as string).getTime() : 0;
  const end = item.fecha_fin ? new Date(item.fecha_fin as string).getTime() : 0;

  if (start && now < start) return 'PRÓXIMAMENTE';
  if (end && now >= end) return 'FINALIZADA';
  return 'EN VIVO';
}

const STATUS_ORDER = { 'EN VIVO': 0, 'PRÓXIMAMENTE': 1, 'FINALIZADA': 2 };

function sortSubastas(list: Subasta[]): Subasta[] {
  return [...list].sort((a, b) => {
    const orderA = STATUS_ORDER[getDisplayStatus(a) as keyof typeof STATUS_ORDER] ?? 2;
    const orderB = STATUS_ORDER[getDisplayStatus(b) as keyof typeof STATUS_ORDER] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    const startA = a.fecha_inicio ? new Date(a.fecha_inicio).getTime() : 0;
    const startB = b.fecha_inicio ? new Date(b.fecha_inicio).getTime() : 0;
    return startA - startB;
  });
}

const BADGE_COLORS = {
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
          backgroundColor: (BADGE_COLORS as any)[estado] || '#000',
          opacity: estado === 'EN VIVO' ? pulseAnim : 1,
        },
      ]}
    >
      <Text style={styles.badgeText}>{estado}</Text>
    </Animated.View>
  );
}

function SubastaCard({ item, index }: { item: Subasta; index: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const estado = getDisplayStatus(item);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        delay: Math.min(index * 70, 350),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        delay: Math.min(index * 70, 350),
        useNativeDriver: true,
      }),
    ]).start();
  });

  const rankOf = (lvl?: string | number) => {
    if (!lvl && lvl !== 0) return 1;
    const s = String(lvl)
      .trim()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    const digits = s.match(/\d+/);
    if (digits?.[0]) {
      const num = Number(digits[0]);
      if (num >= 1 && num <= 5) return num;
    }
    if (s.includes('platino') || s.includes('platinum')) return 5;
    if (s.includes('oro')) return 4;
    if (s.includes('plata')) return 3;
    if (s.includes('especial')) return 2;
    if (s.includes('comun') || s.includes('base')) return 1;
    return 1;
  };

  const { nivel } = useAuth();
  const nivelUsuario = rankOf(nivel || 'base');
  const rawReq = (item as any).nivel_requerido ?? (item as any).nivel_acceso ?? (item as any).nivel ?? '';
  const nivelReq = rankOf(rawReq);
  const bloqueada = nivelUsuario < nivelReq && estado === 'EN VIVO';

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.imagen_portada || item.imagen }}
          style={styles.cardImage}
          blurRadius={bloqueada ? 6 : 0}
        />
        {bloqueada && (
          <View style={styles.overlayBloqueada}>
            <Ionicons name="lock-closed" size={28} color="#fff" />
            <Text style={styles.textoAcceso}>ACCESO {String(rawReq || 'COMUN').toUpperCase()} REQUERIDO</Text>
          </View>
        )}
        {!bloqueada && <StatusBadge estado={estado} />}
        {!bloqueada && estado === 'EN VIVO' && (
          <CountdownBadge
            fechaInicio={(item as any).fecha_inicio}
            fechaFin={(item as any).fecha_fin}
          />
        )}
        {!bloqueada && estado === 'PRÓXIMAMENTE' && (
          <CountdownBadge
            fechaInicio={(item as any).fecha_inicio}
            fechaFin={(item as any).fecha_fin}
          />
        )}
      </View>

      <Text style={styles.cardTitle}>{item.titulo ?? ''}</Text>
      <Text style={styles.cardSubtitle}>{item.cantidad_articulos ?? item.articulos ?? 0} artículos — {item.ubicacion ?? ''}</Text>

      <TouchableOpacity
        style={[styles.cardButton, bloqueada && styles.cardButtonDisabled]}
        onPress={() => {
          if (bloqueada) return;
          const subastaId = item.subasta_id ?? item.id;
          if (!subastaId) return;
          router.push({ pathname: '/catalogo/[id]', params: { id: String(subastaId), titulo: item.titulo ?? '' } } as any);
        }}
        disabled={bloqueada}
      >
        <Text style={[styles.cardButtonText, bloqueada && styles.cardButtonTextDisabled]}>
          {estado === 'FINALIZADA' ? 'VER SUBASTA' : 'VER CATÁLOGO'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Home() {
  const { nombre, email, token, removeToken, isLoading } = useAuth();
  
  const isAdmin = String(email || '').toLowerCase() === 'admin@rematix.com';
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [loadingSubastas, setLoadingSubastas] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [hasMore, setHasMore] = useState(true);

const fetchCategorias = async () => {
    try {
      // Le agregamos /api acá 👇
      const res = await fetch(`${API_URL}/api/categorias`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      if (res.status === 401) return handleUnauthorized();
      
      const data = await res.json();
      setCategorias(data);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoadingCategorias(false); 
    }
  };

  const fetchSubastas = async (page = 1, catId = categoriaActiva, shouldRefresh = false) => {
    if (!shouldRefresh) setLoadingSubastas(true);
    try {
      if (!token) return;
      const url = `${API_URL}/api/subastas?pagina=${page}&limite=100${catId ? `&tematica=${catId}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      
      if (shouldRefresh || page === 1) {
        setSubastas(sortSubastas(data.subastas));
      } else {
        setSubastas(prev => sortSubastas([...prev, ...data.subastas]));
      }
      setHasMore(data.pagina_actual < data.total_paginas);
      setPagina(data.pagina_actual);
    } catch (e) { console.error(e); } finally { 
      setLoadingSubastas(false); 
      setRefreshing(false);
    }
  };

  const handleUnauthorized = () => {
    removeToken();
  };

  useEffect(() => {
    if (isLoading) return;
    if (!token) return;
    fetchCategorias();
    fetchSubastas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isLoading]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSubastas(1, categoriaActiva, true);
  };

  const onSelectCategory = (id: number) => {
    const newCat = categoriaActiva === id ? null : id;
    setCategoriaActiva(newCat);
    fetchSubastas(1, newCat);
  };

  const renderCategoria = ({ item }: any) => {
    const catId = item?.identificador ?? item?.id;
    const isActive = categoriaActiva === catId;
    return (
      <TouchableOpacity 
        style={[styles.catChip, isActive && styles.catChipActive]}
        onPress={() => typeof catId === 'number' && onSelectCategory(catId)}
      >
        <Text style={[styles.catText, isActive && styles.catTextActive]}>{item?.nombre ?? ''}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bienvenido/a</Text>
          <Text style={styles.headerName}>{nombre || 'Usuario'}</Text>
        </View>
        <TouchableOpacity style={styles.profileIcon} onPress={() => router.push('/(tabs)/pujas-actuales')}>
          <Ionicons name="notifications-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={subastas}
        keyExtractor={(item, index) => String(item?.subasta_id ?? item?.id ?? index)}
        renderItem={({ item, index }) => <SubastaCard item={item} index={index} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={() => {
          if (hasMore && !loadingSubastas) fetchSubastas(pagina + 1, categoriaActiva);
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>CATEGORÍAS</Text>
              <Text style={styles.linkText}>VER TODO</Text>
            </View>

            <View style={{ marginLeft: 20, marginBottom: 30 }}>
              {loadingCategorias ? (
                <View style={{ flexDirection: 'row' }}>
                  <Skeleton width={80} height={35} borderRadius={20} style={{ marginRight: 10 }} />
                  <Skeleton width={80} height={35} borderRadius={20} style={{ marginRight: 10 }} />
                  <Skeleton width={80} height={35} borderRadius={20} />
                </View>
              ) : (
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={categorias}
                  keyExtractor={(i, index) => String(i?.id ?? index)}
                  renderItem={renderCategoria}
                  contentContainerStyle={{ paddingRight: 20 }}
                />
              )}
            </View>

            {!isAdmin && (
              <>
                <Text style={[styles.sectionTitle, { marginLeft: 20, marginBottom: 16 }]}>GESTIÓN DE FONDOS</Text>
                <TouchableOpacity style={styles.walletBanner} onPress={() => router.push('/(tabs)/billetera')}>
                  <Text style={styles.walletText}>BILLETERA</Text>
                  <Ionicons name="wallet-outline" size={32} color="#FFF" />
                </TouchableOpacity>
              </>
            )}

            <Text style={[styles.sectionTitle, { marginLeft: 20, marginBottom: 16}]}>SUBASTAS ACTIVAS</Text>

            {loadingSubastas && subastas.length === 0 && (
              <View style={{ paddingHorizontal: 20 }}>
                <Skeleton width="100%" height={200} borderRadius={16} style={{ marginBottom: 15 }} />
                <Skeleton width="60%" height={24} borderRadius={4} style={{ marginBottom: 8 }} />
                <Skeleton width="40%" height={16} borderRadius={4} style={{ marginBottom: 20 }} />
              </View>
            )}
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 10 },
  headerTitle: { fontSize: 27, fontWeight: 'bold' },
  headerName: { fontSize: 23, fontWeight: '900' },
  profileIcon: { padding: 5 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#888', letterSpacing: 1 },
  sectionTitle2: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 15 },
  linkText: { fontSize: 10, fontWeight: 'bold', color: '#000', letterSpacing: 1, textDecorationLine: 'underline' },
  catChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#EEE', marginRight: 10 },
  catChipActive: { backgroundColor: '#000' },
  catText: { fontSize: 15, fontWeight: 'bold', color: '#555' },
  catTextActive: { color: '#FFF' },
  walletBanner: { backgroundColor: '#0A0A0A', marginHorizontal: 20, borderRadius: 16, padding: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  walletText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
  listContent: { paddingBottom: 40 },
  card: { marginHorizontal: 20, marginBottom: 30 },
  imageContainer: { width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', marginBottom: 15 },
  cardImage: { width: '100%', height: '100%' },
  badge: { position: 'absolute', top: 15, right: 15, backgroundColor: '#000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  badgeText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: '#666', marginBottom: 15 },
  cardButton: { borderWidth: 1, borderColor: '#000', borderRadius: 25, paddingVertical: 10, alignItems: 'center' },
  cardButtonText: { fontSize: 14, fontWeight: 'bold', color: '#000', letterSpacing: 1 },
  cardButtonDisabled: { opacity: 0.5 },
  cardButtonTextDisabled: { color: '#000' },
  overlayBloqueada: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(120, 120, 120, 0.45)',
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
});
