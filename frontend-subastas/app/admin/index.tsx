import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Image,
  TouchableOpacity,
  Platform,
  Modal,
  LayoutAnimation,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const CATEGORIAS_CLIENTE = ['comun', 'especial', 'plata', 'oro', 'platino'];
const SI_NO = ['si', 'no'];
const TABS = [
  { key: 'pendientes' as const, label: 'Pendientes', icon: 'hourglass-outline' as const },
  { key: 'rechazados' as const, label: 'Rechazados', icon: 'close-circle-outline' as const },
  { key: 'productos' as const, label: 'Productos', icon: 'cube-outline' as const },
  { key: 'subastas' as const, label: 'Subastas', icon: 'hammer-outline' as const },
];

interface ClientePendiente {
  cliente_id: string | number;
  nombre?: string | null;
  documento?: string | null;
  email?: string | null;
  admitido?: string | null;
  categoria?: string | null;
  numeropais?: number | null;
}

interface ProductoPendiente {
  producto_id: string | number;
  descripcioncatalogo?: string | null;
  descripcioncompleta?: string | null;
  disponible?: string | null;
  revisor?: number | null;
  seguro?: string | null;
  duenio?: string | number | null;
  preciobase?: number | null;
  comision?: number | null;
  fotos?: string[];
}

interface Categoria {
  id?: number;
  nombre?: string;
}

interface Revisor {
  id: number;
  nombre: string;
}

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D';
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function AdminPanel() {
  const { token, removeToken } = useAuth();
  const [clientes, setClientes] = useState<ClientePendiente[]>([]);
  const [clientesRechazados, setClientesRechazados] = useState<ClientePendiente[]>([]);
  const [productos, setProductos] = useState<ProductoPendiente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [revisores, setRevisores] = useState<Revisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [categoriaPorCliente, setCategoriaPorCliente] = useState<Record<string, string>>({});
  const [revisorId, setRevisorId] = useState('');

  const [formSubasta, setFormSubasta] = useState({
    nombre: '',
    fecha: '',
    hora: '',
    ubicacion: '',
    capacidadasistentes: '',
    tienedeposito: '',
    seguridadpropia: '',
    categoria: '',
    tematica: 0,
  });
  const [guardandoSubasta, setGuardandoSubasta] = useState(false);
  const [tab, setTab] = useState<'pendientes' | 'rechazados' | 'productos' | 'subastas'>('pendientes');
  const [fechaPickerValue, setFechaPickerValue] = useState<Date | null>(null);
  const [horaPickerValue, setHoraPickerValue] = useState<Date | null>(null);
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [showHoraPicker, setShowHoraPicker] = useState(false);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenFile, setImagenFile] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [detalleProducto, setDetalleProducto] = useState<ProductoPendiente | null>(null);
  const [showDetalleProducto, setShowDetalleProducto] = useState(false);

  const switchTab = (key: typeof tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(key);
  };

  const formatFecha = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatHora = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const minFecha = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 11);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const handleFechaChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed' || !selectedDate) return;
    }
    if (!selectedDate) return;
    if (selectedDate < minFecha) {
      Alert.alert('Fecha inválida', 'La fecha debe ser al menos 11 días a partir de hoy.');
      return;
    }
    setFechaPickerValue(selectedDate);
    setFormSubasta((prev) => ({ ...prev, fecha: formatFecha(selectedDate) }));
  };

  const handleHoraChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      if (event?.type === 'dismissed' || !selectedDate) return;
    }
    if (!selectedDate) return;
    setHoraPickerValue(selectedDate);
    setFormSubasta((prev) => ({ ...prev, hora: formatHora(selectedDate) }));
  };

  const openFechaPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fechaPickerValue || minFecha,
        mode: 'date',
        minimumDate: minFecha,
        onChange: handleFechaChange,
      });
      return;
    }
    setShowFechaPicker(true);
  };

  const openHoraPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: horaPickerValue || new Date(),
        mode: 'time',
        is24Hour: true,
        onChange: handleHoraChange,
      });
      return;
    }
    setShowHoraPicker(true);
  };

  const handlePickImage = () => {
    const options: any[] = [
      {
        text: 'CÁMARA',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [16, 9],
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          setImagenUri(asset.uri);
          setImagenFile({
            uri: asset.uri,
            name: 'subasta-portada.jpg',
            type: asset.mimeType || 'image/jpeg',
          });
        },
      },
      {
        text: 'GALERÍA',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [16, 9],
          });
          if (result.canceled || !result.assets?.[0]) return;
          const asset = result.assets[0];
          setImagenUri(asset.uri);
          setImagenFile({
            uri: asset.uri,
            name: 'subasta-portada.jpg',
            type: asset.mimeType || 'image/jpeg',
          });
        },
      },
    ];
    if (imagenUri) {
      options.push({ text: 'ELIMINAR IMAGEN', onPress: () => { setImagenUri(null); setImagenFile(null); }, style: 'destructive' });
    }
    options.push({ text: 'CANCELAR', style: 'cancel' });
    Alert.alert('Imagen de portada', 'Elegí una opción', options);
  };

  const handleUnauthorized = useCallback(() => {
    removeToken();
  }, [removeToken]);

  const fetchClientes = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/clientes/pendientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { handleUnauthorized(); return [] as ClientePendiente[]; }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchProductos = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/productos/pendientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { handleUnauthorized(); return [] as ProductoPendiente[]; }
    if (!res.ok) return [] as ProductoPendiente[];
    return (await res.json()) as ProductoPendiente[];
  }, [token, handleUnauthorized]);

  const fetchClientesRechazados = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/clientes/rechazados`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { handleUnauthorized(); return [] as ClientePendiente[]; }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchCategorias = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/categorias`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) { handleUnauthorized(); return [] as Categoria[]; }
    if (!res.ok) return [] as Categoria[];
    const raw = (await res.json()) as any[];
    return raw.map((cat) => ({
      id: cat.id ?? cat.identificador ?? cat.numero ?? null,
      nombre: cat.nombre ?? cat.label ?? null,
    }));
  }, [token, handleUnauthorized]);

  const fetchRevisores = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/opciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { handleUnauthorized(); return []; }
      if (!res.ok) return [];
      const data = await res.json();
      return data.revisores || [];
    } catch {
      return [];
    }
  }, [token, handleUnauthorized]);

  const cargarDatos = useCallback(async () => {
    try {
      const [clientesData, clientesRechazadosData, productosData, categoriasData, revisoresData] = await Promise.all([
        fetchClientes(),
        fetchClientesRechazados(),
        fetchProductos(),
        fetchCategorias(),
        fetchRevisores(),
      ]);
      setClientes(clientesData);
      setClientesRechazados(clientesRechazadosData);
      setProductos(productosData);
      setCategorias(categoriasData);
      setRevisores(revisoresData);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los datos del panel admin');
    } finally {
      setLoading(false);
    }
  }, [fetchClientes, fetchClientesRechazados, fetchProductos, fetchCategorias, fetchRevisores]);

  useEffect(() => {
    if (token) cargarDatos();
  }, [token, cargarDatos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarDatos();
    setRefreshing(false);
  }, [cargarDatos]);

  const categoriasOpciones = useMemo(
    () => CATEGORIAS_CLIENTE.map((cat, index) => ({ id: index + 1, label: cat })),
    []
  );

  const handleEvaluarCliente = async (clienteId: string | number, admitido: 'si' | 'no') => {
    const categoria = categoriaPorCliente[String(clienteId)];
    if (admitido === 'si' && !categoria) {
      Alert.alert('Falta categoría', 'Seleccioná una categoría antes de aprobar.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/clientes/${clienteId}/evaluacion`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admitido, categoria: admitido === 'si' ? categoria : undefined }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { Alert.alert('Error', 'No se pudo actualizar el cliente.'); return; }
      await cargarDatos();
    } catch { Alert.alert('Error', 'No se pudo actualizar el cliente.'); }
  };

  const handleEvaluarProducto = async (productoId: string | number, disponible: 'si' | 'no') => {
    const revisor = Number(revisorId);
    if (!revisorId || Number.isNaN(revisor)) {
      Alert.alert('Falta revisor', 'Seleccioná un revisor para evaluar productos.');
      return;
    }
    const producto = productos.find((p) => String(p.producto_id) === String(productoId));
    try {
      const res = await fetch(`${API_URL}/api/admin/productos/${productoId}/evaluacion`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disponible,
          revisor,
          descripcioncatalogo: producto?.descripcioncatalogo ?? null,
          seguro: producto?.seguro ?? null,
        }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { Alert.alert('Error', 'No se pudo actualizar el producto.'); return; }
      setShowDetalleProducto(false);
      await cargarDatos();
    } catch { Alert.alert('Error', 'No se pudo actualizar el producto.'); }
  };

  const handleCrearSubasta = async () => {
    if (!formSubasta.nombre || !formSubasta.fecha || !formSubasta.hora || !formSubasta.categoria || !formSubasta.tematica) {
      Alert.alert('Faltan datos', 'Completá los campos obligatorios para crear la subasta.');
      return;
    }
    if (formSubasta.tienedeposito && !SI_NO.includes(formSubasta.tienedeposito)) {
      Alert.alert('Dato inválido', 'El campo "tienedeposito" debe ser si/no.'); return;
    }
    if (formSubasta.seguridadpropia && !SI_NO.includes(formSubasta.seguridadpropia)) {
      Alert.alert('Dato inválido', 'El campo "seguridadpropia" debe ser si/no.'); return;
    }
    setGuardandoSubasta(true);
    try {
      let imagenUrl = '';
      if (imagenFile) {
        const formData = new FormData();
        formData.append('imagen', imagenFile as any);
        const uploadRes = await fetch(`${API_URL}/api/admin/subastas/portada`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (uploadRes.status === 401) { handleUnauthorized(); return; }
        if (!uploadRes.ok) { const errData = await uploadRes.json().catch(() => ({})); throw new Error(errData.error || 'Error al subir la imagen'); }
        const uploadData = await uploadRes.json();
        imagenUrl = uploadData.url;
      }
      const res = await fetch(`${API_URL}/api/admin/subastas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formSubasta.nombre,
          fecha: formSubasta.fecha,
          hora: formSubasta.hora,
          ubicacion: formSubasta.ubicacion || undefined,
          capacidadasistentes: formSubasta.capacidadasistentes ? Number(formSubasta.capacidadasistentes) : undefined,
          tienedeposito: formSubasta.tienedeposito || undefined,
          seguridadpropia: formSubasta.seguridadpropia || undefined,
          categoria: formSubasta.categoria,
          tematica: formSubasta.tematica,
          imagen: imagenUrl || undefined,
        }),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { Alert.alert('Error', 'No se pudo crear la subasta.'); return; }
      Alert.alert('Listo', 'Subasta creada exitosamente.');
      setFormSubasta({ nombre: '', fecha: '', hora: '', ubicacion: '', capacidadasistentes: '', tienedeposito: '', seguridadpropia: '', categoria: '', tematica: 0 });
      setImagenUri(null); setImagenFile(null);
      await cargarDatos();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo crear la subasta.';
      Alert.alert('Error', message);
    } finally { setGuardandoSubasta(false); }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Iniciá sesión para ver el panel admin.</Text>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Panel Admin</Text>
        <Text style={styles.subtitle}>Validaciones y altas rápidas</Text>

        <View style={styles.tabBar}>
          {TABS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              onPress={() => switchTab(t.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={t.icon}
                size={16}
                color={tab === t.key ? '#FFF' : '#64748B'}
              />
              <Text style={[styles.tabItemText, tab === t.key && styles.tabItemTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#0F172A" />
            <Text style={styles.loadingText}>Cargando datos...</Text>
          </View>
        ) : null}

        {!loading && tab === 'pendientes' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clientes pendientes ({clientes.length})</Text>
            {clientes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>No hay clientes pendientes</Text>
              </View>
            ) : (
              clientes.map((cliente) => (
                <View key={String(cliente.cliente_id)} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(cliente.nombre)}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{cliente.nombre || 'Cliente sin nombre'}</Text>
                        <View style={[styles.badge, styles.badgePending]}>
                          <Text style={styles.badgePendingText}>PENDIENTE</Text>
                        </View>
                      </View>
                      <View style={styles.cardInfoRow}>
                        <Ionicons name="mail-outline" size={12} color="#94A3B8" />
                        <Text style={styles.cardInfoText}>{cliente.email || 'Sin email'}</Text>
                      </View>
                      <View style={styles.cardInfoRow}>
                        <Ionicons name="document-text-outline" size={12} color="#94A3B8" />
                        <Text style={styles.cardInfoText}>{cliente.documento || 'Sin documento'}</Text>
                      </View>
                    </View>
                  </View>
                  <Select
                    label="Categoría"
                    value={categoriaPorCliente[String(cliente.cliente_id)] || ''}
                    placeholder="Seleccionar categoría"
                    options={categoriasOpciones}
                    onSelect={(_, nombre) =>
                      setCategoriaPorCliente((prev) => ({ ...prev, [String(cliente.cliente_id)]: nombre }))
                    }
                  />
                  <View style={styles.actionRow}>
                    <Button title="Aceptar" onPress={() => handleEvaluarCliente(cliente.cliente_id, 'si')} style={styles.actionButton} />
                    <Button title="Rechazar" onPress={() => handleEvaluarCliente(cliente.cliente_id, 'no')} variant="secondary" style={styles.actionButton} />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {!loading && tab === 'rechazados' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clientes rechazados ({clientesRechazados.length})</Text>
            {clientesRechazados.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-done-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>No hay clientes rechazados</Text>
              </View>
            ) : (
              clientesRechazados.map((cliente) => (
                <View key={`rej-${String(cliente.cliente_id)}`} style={styles.card}>
                  <View style={styles.cardRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(cliente.nombre)}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Text style={styles.cardName}>{cliente.nombre || 'Cliente sin nombre'}</Text>
                        <View style={[styles.badge, styles.badgeRejected]}>
                          <Text style={styles.badgeRejectedText}>RECHAZADO</Text>
                        </View>
                      </View>
                      <View style={styles.cardInfoRow}>
                        <Ionicons name="mail-outline" size={12} color="#94A3B8" />
                        <Text style={styles.cardInfoText}>{cliente.email || 'Sin email'}</Text>
                      </View>
                      <View style={styles.cardInfoRow}>
                        <Ionicons name="document-text-outline" size={12} color="#94A3B8" />
                        <Text style={styles.cardInfoText}>{cliente.documento || 'Sin documento'}</Text>
                      </View>
                    </View>
                  </View>
                  <Select
                    label="Categoría"
                    value={categoriaPorCliente[String(cliente.cliente_id)] || ''}
                    placeholder="Seleccionar categoría"
                    options={categoriasOpciones}
                    onSelect={(_, nombre) =>
                      setCategoriaPorCliente((prev) => ({ ...prev, [String(cliente.cliente_id)]: nombre }))
                    }
                  />
                  <View style={styles.actionRow}>
                    <Button title="Rehabilitar" onPress={() => handleEvaluarCliente(cliente.cliente_id, 'si')} style={styles.actionButton} />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {!loading && tab === 'productos' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Productos pendientes ({productos.length})</Text>

            <View style={styles.revisorCard}>
              <View style={styles.revisorCardHeader}>
                <Ionicons name="person-outline" size={16} color="#6366F1" />
                <Text style={styles.revisorCardTitle}>Asignar revisor</Text>
              </View>
              <Select
                label="Revisor"
                value={revisores.find((r) => String(r.id) === revisorId)?.nombre || ''}
                placeholder="Seleccionar revisor"
                options={revisores.map((r) => ({ id: r.id, nombre: r.nombre }))}
                onSelect={(id) => setRevisorId(String(id))}
              />
            </View>

            {productos.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyStateText}>No hay productos pendientes</Text>
              </View>
            ) : (
              productos.map((producto) => (
                <TouchableOpacity
                  key={String(producto.producto_id)}
                  style={styles.productCard}
                  activeOpacity={0.85}
                  onPress={() => {
                    setDetalleProducto(producto);
                    setShowDetalleProducto(true);
                  }}
                >
                  <View style={styles.productImageWrap}>
                    {producto.fotos?.[0] ? (
                      <Image source={{ uri: producto.fotos[0] }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.productImagePlaceholder}>
                        <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                      </View>
                    )}
                    <View style={[styles.productBadge, styles.badgePending]}>
                      <Text style={styles.badgePendingText}>PENDIENTE</Text>
                    </View>
                  </View>
                  <View style={styles.productBody}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {producto.descripcioncatalogo || `Producto #${producto.producto_id}`}
                    </Text>
                    {producto.descripcioncompleta ? (
                      <Text style={styles.productDesc} numberOfLines={2}>{producto.descripcioncompleta}</Text>
                    ) : (
                      <Text style={styles.productDesc}>Sin descripción completa.</Text>
                    )}
                    <View style={styles.productMeta}>
                      <View style={styles.productMetaItem}>
                        <Text style={styles.productMetaLabel}>Base</Text>
                        <Text style={styles.productMetaValue}>{formatPrice(producto.preciobase)}</Text>
                      </View>
                      <View style={styles.productMetaDivider} />
                      <View style={styles.productMetaItem}>
                        <Text style={styles.productMetaLabel}>Comisión</Text>
                        <Text style={styles.productMetaValue}>
                          {producto.comision ? `${producto.comision}%` : 'N/D'}
                        </Text>
                      </View>
                      <View style={styles.productMetaDivider} />
                      <View style={styles.productMetaItem}>
                        <Text style={styles.productMetaLabel}>Dueño</Text>
                        <Text style={styles.productMetaValue}>#{producto.duenio || '?'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {!loading && tab === 'subastas' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Crear subasta</Text>

            <View style={styles.formGroup}>
              <View style={styles.formGroupHeader}>
                <Ionicons name="information-circle-outline" size={16} color="#6366F1" />
                <Text style={styles.formGroupTitle}>Datos básicos</Text>
              </View>
              <Input
                label="Nombre"
                value={formSubasta.nombre}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, nombre: value }))}
                placeholder="Ej: Subasta de Arte Contemporáneo"
              />
              <Select
                label="Temática"
                value={categorias.find((c) => c.id === formSubasta.tematica)?.nombre || ''}
                options={categorias}
                placeholder="Seleccionar temática"
                onSelect={(id) => setFormSubasta((prev) => ({ ...prev, tematica: id }))}
              />
              <Select
                label="Nivel de acceso"
                value={formSubasta.categoria}
                placeholder="Seleccionar nivel"
                options={categoriasOpciones}
                onSelect={(_, nombre) => setFormSubasta((prev) => ({ ...prev, categoria: nombre }))}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.formGroupHeader}>
                <Ionicons name="calendar-outline" size={16} color="#6366F1" />
                <Text style={styles.formGroupTitle}>Fecha y hora</Text>
              </View>
              <Text style={styles.dateHelperText}>Disponible desde {formatFecha(minFecha)}</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerField}>
                  <Text style={styles.pickerLabel}>FECHA</Text>
                  <TouchableOpacity style={styles.pickerInput} onPress={openFechaPicker}>
                    <Ionicons name="calendar-outline" size={16} color="#94A3B8" />
                    <Text style={formSubasta.fecha ? styles.pickerValue : styles.pickerPlaceholder}>
                      {formSubasta.fecha || 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={styles.pickerField}>
                  <Text style={styles.pickerLabel}>HORA</Text>
                  <TouchableOpacity style={styles.pickerInput} onPress={openHoraPicker}>
                    <Ionicons name="time-outline" size={16} color="#94A3B8" />
                    <Text style={formSubasta.hora ? styles.pickerValue : styles.pickerPlaceholder}>
                      {formSubasta.hora || 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.formGroupHeader}>
                <Ionicons name="location-outline" size={16} color="#6366F1" />
                <Text style={styles.formGroupTitle}>Logística</Text>
              </View>
              <Input
                label="Ubicación"
                value={formSubasta.ubicacion}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, ubicacion: value }))}
                placeholder="Ej: Buenos Aires"
              />
              <Input
                label="Capacidad asistentes"
                value={formSubasta.capacidadasistentes}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, capacidadasistentes: value }))}
                keyboardType="numeric"
                placeholder="Ej: 200"
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.formGroupHeader}>
                <Ionicons name="shield-outline" size={16} color="#6366F1" />
                <Text style={styles.formGroupTitle}>Condiciones</Text>
              </View>
              <Select
                label="Tiene depósito"
                value={formSubasta.tienedeposito ? (formSubasta.tienedeposito === 'si' ? 'Sí' : 'No') : ''}
                placeholder="Seleccionar"
                options={[{ id: 1, label: 'Sí' }, { id: 2, label: 'No' }]}
                onSelect={(_, nombre) => setFormSubasta((prev) => ({ ...prev, tienedeposito: nombre === 'Sí' ? 'si' : 'no' }))}
              />
              <Select
                label="Seguridad propia"
                value={formSubasta.seguridadpropia ? (formSubasta.seguridadpropia === 'si' ? 'Sí' : 'No') : ''}
                placeholder="Seleccionar"
                options={[{ id: 1, label: 'Sí' }, { id: 2, label: 'No' }]}
                onSelect={(_, nombre) => setFormSubasta((prev) => ({ ...prev, seguridadpropia: nombre === 'Sí' ? 'si' : 'no' }))}
              />
            </View>

            <View style={styles.formGroup}>
              <View style={styles.formGroupHeader}>
                <Ionicons name="image-outline" size={16} color="#6366F1" />
                <Text style={styles.formGroupTitle}>Portada</Text>
              </View>
              <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage} activeOpacity={0.85}>
                {imagenUri ? (
                  <Image source={{ uri: imagenUri }} style={styles.imagePreview} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="add" size={28} color="#6366F1" />
                    <Text style={styles.imagePlaceholderText}>Agregar imagen de portada</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Button title="Crear subasta" onPress={handleCrearSubasta} loading={guardandoSubasta} style={styles.submitButton} />
            <Modal visible={showFechaPicker} transparent animationType="slide">
              <View style={styles.pickerModalOverlay}>
                <View style={styles.pickerModalContent}>
                  <DateTimePicker
                    value={fechaPickerValue || minFecha}
                    mode="date"
                    display="spinner"
                    minimumDate={minFecha}
                    onChange={handleFechaChange}
                  />
                  <Button title="Listo" onPress={() => setShowFechaPicker(false)} variant="secondary" />
                </View>
              </View>
            </Modal>
            <Modal visible={showHoraPicker} transparent animationType="slide">
              <View style={styles.pickerModalOverlay}>
                <View style={styles.pickerModalContent}>
                  <DateTimePicker
                    value={horaPickerValue || new Date()}
                    mode="time"
                    is24Hour
                    display="spinner"
                    onChange={handleHoraChange}
                  />
                  <Button title="Listo" onPress={() => setShowHoraPicker(false)} variant="secondary" />
                </View>
              </View>
            </Modal>
          </View>
        )}

        <Modal visible={showDetalleProducto} transparent animationType="slide" onRequestClose={() => setShowDetalleProducto(false)}>
          <View style={styles.detailOverlay}>
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>Detalle del producto</Text>
                <TouchableOpacity onPress={() => setShowDetalleProducto(false)} style={styles.detailClose}>
                  <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.detailGallery}>
                  {(detalleProducto?.fotos || []).length > 0 ? (
                    detalleProducto?.fotos?.map((foto, index) => (
                      <Image key={`${foto}-${index}`} source={{ uri: foto }} style={styles.detailImage} resizeMode="cover" />
                    ))
                  ) : (
                    <View style={styles.detailImagePlaceholder}>
                      <Ionicons name="image-outline" size={40} color="#CBD5E1" />
                    </View>
                  )}
                </ScrollView>

                <Text style={styles.detailName}>
                  {detalleProducto?.descripcioncatalogo || `Producto #${detalleProducto?.producto_id}`}
                </Text>

                <View style={styles.detailBadgeRow}>
                  <View style={[styles.badge, styles.badgePending]}>
                    <Text style={styles.badgePendingText}>PENDIENTE</Text>
                  </View>
                </View>

                <Text style={styles.detailSectionLabel}>Descripción</Text>
                <Text style={styles.detailDescription}>
                  {detalleProducto?.descripcioncompleta || 'Sin descripción completa.'}
                </Text>

                <Text style={styles.detailSectionLabel}>Información de subasta</Text>
                <View style={styles.detailMetaGrid}>
                  <View style={styles.detailMetaItem}>
                    <Text style={styles.detailMetaLabel}>Precio base</Text>
                    <Text style={styles.detailMetaValue}>{formatPrice(detalleProducto?.preciobase)}</Text>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Text style={styles.detailMetaLabel}>Comisión</Text>
                    <Text style={styles.detailMetaValue}>
                      {detalleProducto?.comision ? `${detalleProducto.comision}%` : 'N/D'}
                    </Text>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Text style={styles.detailMetaLabel}>Seguro</Text>
                    <Text style={styles.detailMetaValue}>{detalleProducto?.seguro || 'Sin seguro'}</Text>
                  </View>
                  <View style={styles.detailMetaItem}>
                    <Text style={styles.detailMetaLabel}>Dueño</Text>
                    <Text style={styles.detailMetaValue}>#{detalleProducto?.duenio || 'N/D'}</Text>
                  </View>
                </View>

                <View style={styles.detailActions}>
                  <Text style={styles.detailSectionLabel}>Acción</Text>
                  <Select
                    label="Revisor"
                    value={revisores.find((r) => String(r.id) === revisorId)?.nombre || ''}
                    placeholder="Seleccionar revisor"
                    options={revisores.map((r) => ({ id: r.id, nombre: r.nombre }))}
                    onSelect={(id) => setRevisorId(String(id))}
                  />
                  <View style={styles.actionRow}>
                    <Button
                      title="Aprobar"
                      onPress={() => detalleProducto && handleEvaluarProducto(detalleProducto.producto_id, 'si')}
                      style={styles.actionButton}
                    />
                    <Button
                      title="Rechazar"
                      onPress={() => detalleProducto && handleEvaluarProducto(detalleProducto.producto_id, 'no')}
                      variant="secondary"
                      style={styles.actionButton}
                    />
                  </View>
                </View>
                <View style={{ height: 24 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerBack: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', letterSpacing: 3, color: '#000' },
  content: { padding: 16, paddingBottom: 100 },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#64748B', marginBottom: 20 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    marginBottom: 22,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 5,
  },
  tabItemActive: { backgroundColor: '#0F172A' },
  tabItemText: { fontSize: 11, fontWeight: '600', color: '#64748B', letterSpacing: 0.3 },
  tabItemTextActive: { color: '#FFFFFF' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 },

  loadingWrap: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#94A3B8' },

  emptyState: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  emptyStateText: { fontSize: 14, color: '#94A3B8' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#6366F1' },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#0F172A', flex: 1 },
  cardInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardInfoText: { fontSize: 12, color: '#64748B' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgePendingText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  badgeRejected: { backgroundColor: '#FEE2E2' },
  badgeRejectedText: { fontSize: 10, fontWeight: '700', color: '#991B1B' },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: { flex: 1, marginBottom: 0 },

  revisorCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  revisorCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  revisorCardTitle: { fontSize: 13, fontWeight: '600', color: '#6366F1' },

  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  productImageWrap: { width: '100%', height: 160, position: 'relative', backgroundColor: '#F1F5F9' },
  productImage: { width: '100%', height: '100%' },
  productImagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  productBadge: { position: 'absolute', top: 10, left: 10 },
  productBody: { padding: 14, gap: 6 },
  productName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  productDesc: { fontSize: 12, color: '#64748B', lineHeight: 17 },
  productMeta: { flexDirection: 'row', marginTop: 6, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  productMetaItem: { flex: 1, alignItems: 'center' },
  productMetaDivider: { width: 1, backgroundColor: '#E2E8F0' },
  productMetaLabel: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  productMetaValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  formGroup: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  formGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  formGroupTitle: { fontSize: 12, fontWeight: '700', color: '#6366F1', letterSpacing: 0.6, textTransform: 'uppercase' },

  dateHelperText: { fontSize: 11, color: '#94A3B8', marginBottom: 10, marginTop: -6 },
  pickerRow: { flexDirection: 'row', alignItems: 'flex-end' },
  pickerField: { flex: 1, marginBottom: 0 },
  pickerLabel: { fontSize: 10, fontWeight: 'bold', color: '#475569', letterSpacing: 1, marginBottom: 4 },
  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
  },
  pickerValue: { fontSize: 15, color: '#0F172A', flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: '#B0B0B0', flex: 1 },
  pickerModalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerModalContent: {
    backgroundColor: '#FFF',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  imagePickerButton: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 13, color: '#6366F1', fontWeight: '500' },

  submitButton: { marginTop: 4 },

  detailOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'flex-end' },
  detailCard: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  detailClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  detailGallery: { paddingHorizontal: 16, marginBottom: 12 },
  detailImage: { width: 240, height: 170, borderRadius: 12, marginRight: 10, backgroundColor: '#F1F5F9' },
  detailImagePlaceholder: {
    width: 240, height: 170, borderRadius: 12, backgroundColor: '#F1F5F9',
    alignItems: 'center', justifyContent: 'center',
  },
  detailName: { fontSize: 18, fontWeight: '700', color: '#0F172A', paddingHorizontal: 16, marginBottom: 6 },
  detailBadgeRow: { paddingHorizontal: 16, marginBottom: 14 },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  detailDescription: { fontSize: 13, color: '#475569', lineHeight: 19, paddingHorizontal: 16, marginBottom: 14 },
  detailMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  detailMetaItem: {
    width: '47%',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailMetaLabel: { fontSize: 10, color: '#64748B', letterSpacing: 0.6, textTransform: 'uppercase' },
  detailMetaValue: { marginTop: 4, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  detailActions: { paddingHorizontal: 16, marginTop: 16 },
});
