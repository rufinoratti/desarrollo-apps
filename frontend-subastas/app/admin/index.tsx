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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const CATEGORIAS_CLIENTE = ['comun', 'especial', 'plata', 'oro', 'platino'];
const SI_NO = ['si', 'no'];

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
  disponible?: string | null;
  revisor?: number | null;
  seguro?: string | null;
  duenio?: string | number | null;
}

interface Categoria {
  id?: number;
  nombre?: string;
}

export default function AdminPanel() {
  const { token, removeToken } = useAuth();
  const [clientes, setClientes] = useState<ClientePendiente[]>([]);
  const [clientesRechazados, setClientesRechazados] = useState<ClientePendiente[]>([]);
  const [productos, setProductos] = useState<ProductoPendiente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
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
    if (res.status === 401) {
      handleUnauthorized();
      return [] as ClientePendiente[];
    }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchProductos = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/productos/pendientes`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleUnauthorized();
      return [] as ProductoPendiente[];
    }
    if (!res.ok) return [] as ProductoPendiente[];
    return (await res.json()) as ProductoPendiente[];
  }, [token, handleUnauthorized]);

  const fetchClientesRechazados = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/clientes/rechazados`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleUnauthorized();
      return [] as ClientePendiente[];
    }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchCategorias = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/categorias`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handleUnauthorized();
      return [] as Categoria[];
    }
    if (!res.ok) return [] as Categoria[];
    const raw = (await res.json()) as any[];
    return raw.map((cat) => ({
      id: cat.id ?? cat.identificador ?? cat.numero ?? null,
      nombre: cat.nombre ?? cat.label ?? null,
    }));
  }, [token, handleUnauthorized]);

  const cargarDatos = useCallback(async () => {
    try {
      const [clientesData, clientesRechazadosData, productosData, categoriasData] = await Promise.all([
        fetchClientes(),
        fetchClientesRechazados(),
        fetchProductos(),
        fetchCategorias(),
      ]);
      setClientes(clientesData);
      setClientesRechazados(clientesRechazadosData);
      setProductos(productosData);
      setCategorias(categoriasData);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los datos del panel admin');
    } finally {
      setLoading(false);
    }
  }, [fetchClientes, fetchClientesRechazados, fetchProductos, fetchCategorias]);

  useEffect(() => {
    if (token) {
      cargarDatos();
    }
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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admitido, categoria: admitido === 'si' ? categoria : undefined }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        Alert.alert('Error', 'No se pudo actualizar el cliente.');
        return;
      }
      await cargarDatos();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el cliente.');
    }
  };

  const handleEvaluarProducto = async (productoId: string | number, disponible: 'si' | 'no') => {
    const revisor = Number(revisorId);
    if (!revisorId || Number.isNaN(revisor)) {
      Alert.alert('Falta revisor', 'Ingresá un ID de revisor para evaluar productos.');
      return;
    }

    const producto = productos.find((p) => String(p.producto_id) === String(productoId));

    try {
      const res = await fetch(`${API_URL}/api/admin/productos/${productoId}/evaluacion`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disponible,
          revisor,
          descripcioncatalogo: producto?.descripcioncatalogo ?? null,
          seguro: producto?.seguro ?? null,
        }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        Alert.alert('Error', 'No se pudo actualizar el producto.');
        return;
      }
      await cargarDatos();
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el producto.');
    }
  };

  const handleCrearSubasta = async () => {
    if (!formSubasta.nombre || !formSubasta.fecha || !formSubasta.hora || !formSubasta.categoria || !formSubasta.tematica) {
      Alert.alert('Faltan datos', 'Completá los campos obligatorios para crear la subasta.');
      return;
    }

    if (formSubasta.tienedeposito && !SI_NO.includes(formSubasta.tienedeposito)) {
      Alert.alert('Dato inválido', 'El campo "tienedeposito" debe ser si/no.');
      return;
    }

    if (formSubasta.seguridadpropia && !SI_NO.includes(formSubasta.seguridadpropia)) {
      Alert.alert('Dato inválido', 'El campo "seguridadpropia" debe ser si/no.');
      return;
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

        if (uploadRes.status === 401) {
          handleUnauthorized();
          return;
        }

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir la imagen');
        }

        const uploadData = await uploadRes.json();
        imagenUrl = uploadData.url;
      }

      const res = await fetch(`${API_URL}/api/admin/subastas`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!res.ok) {
        Alert.alert('Error', 'No se pudo crear la subasta.');
        return;
      }

      Alert.alert('Listo', 'Subasta creada exitosamente.');
      setFormSubasta({
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
      setImagenUri(null);
      setImagenFile(null);
      await cargarDatos();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo crear la subasta.';
      Alert.alert('Error', message);
    } finally {
      setGuardandoSubasta(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyText}>Iniciá sesión para ver el panel admin.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <Text style={styles.title}>Panel Admin</Text>
        <Text style={styles.subtitle}>Validaciones y altas rápidas</Text>

        <View style={styles.tabBar}>
          {([
            { key: 'pendientes' as const, label: 'Pendientes' },
            { key: 'rechazados' as const, label: 'Rechazados' },
            { key: 'productos' as const, label: 'Productos' },
            { key: 'subastas' as const, label: 'Subastas' },
          ]).map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabItem, tab === t.key && styles.tabItemActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabItemText, tab === t.key && styles.tabItemTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <Text style={styles.loadingText}>Cargando datos...</Text>
        ) : null}

        {tab === 'pendientes' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clientes pendientes</Text>
            {clientes.length === 0 ? (
              <Text style={styles.emptyText}>No hay clientes pendientes.</Text>
            ) : (
              clientes.map((cliente) => (
                <View key={String(cliente.cliente_id)} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{cliente.nombre || 'Cliente sin nombre'}</Text>
                    <Text style={[styles.badge, styles.badgePending]}>PENDIENTE</Text>
                  </View>
                  <Text style={styles.cardText}>Email: {cliente.email || 'Sin email'}</Text>
                  <Text style={styles.cardText}>Documento: {cliente.documento || 'Sin documento'}</Text>

                  <Select
                    label="Categoría"
                    value={categoriaPorCliente[String(cliente.cliente_id)] || ''}
                    placeholder="Seleccionar categoría"
                    options={categoriasOpciones}
                    onSelect={(_, nombre) =>
                      setCategoriaPorCliente((prev) => ({
                        ...prev,
                        [String(cliente.cliente_id)]: nombre,
                      }))
                    }
                  />

                  <View style={styles.actionRow}>
                    <Button
                      title="Aceptar"
                      onPress={() => handleEvaluarCliente(cliente.cliente_id, 'si')}
                      style={styles.actionButton}
                    />
                    <Button
                      title="Rechazar"
                      onPress={() => handleEvaluarCliente(cliente.cliente_id, 'no')}
                      variant="secondary"
                      style={styles.actionButton}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'rechazados' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Clientes rechazados</Text>
            {clientesRechazados.length === 0 ? (
              <Text style={styles.emptyText}>No hay clientes rechazados.</Text>
            ) : (
              clientesRechazados.map((cliente) => (
                <View key={`rej-${String(cliente.cliente_id)}`} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>{cliente.nombre || 'Cliente sin nombre'}</Text>
                    <Text style={[styles.badge, styles.badgeRejected]}>RECHAZADO</Text>
                  </View>
                  <Text style={styles.cardText}>Email: {cliente.email || 'Sin email'}</Text>
                  <Text style={styles.cardText}>Documento: {cliente.documento || 'Sin documento'}</Text>

                  <Select
                    label="Categoría"
                    value={categoriaPorCliente[String(cliente.cliente_id)] || ''}
                    placeholder="Seleccionar categoría"
                    options={categoriasOpciones}
                    onSelect={(_, nombre) =>
                      setCategoriaPorCliente((prev) => ({
                        ...prev,
                        [String(cliente.cliente_id)]: nombre,
                      }))
                    }
                  />

                  <View style={styles.actionRow}>
                    <Button
                      title="Rehabilitar"
                      onPress={() => handleEvaluarCliente(cliente.cliente_id, 'si')}
                      style={styles.actionButton}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'productos' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Productos pendientes</Text>
            <Input
              label="ID Revisor"
              value={revisorId}
              onChangeText={setRevisorId}
              placeholder="Ej: 1"
              keyboardType="numeric"
            />
            {productos.length === 0 ? (
              <Text style={styles.emptyText}>No hay productos pendientes.</Text>
            ) : (
              productos.map((producto) => (
                <View key={String(producto.producto_id)} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.cardTitle}>Producto #{producto.producto_id}</Text>
                    <Text style={[styles.badge, styles.badgePending]}>PENDIENTE</Text>
                  </View>
                  <Text style={styles.cardText}>Descripción: {producto.descripcioncatalogo || 'Sin descripción'}</Text>
                  <Text style={styles.cardText}>Disponible: {producto.disponible ?? 'no'}</Text>

                  <View style={styles.actionRow}>
                    <Button
                      title="Aprobar"
                      onPress={() => handleEvaluarProducto(producto.producto_id, 'si')}
                      style={styles.actionButton}
                    />
                    <Button
                      title="Rechazar"
                      onPress={() => handleEvaluarProducto(producto.producto_id, 'no')}
                      variant="secondary"
                      style={styles.actionButton}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {tab === 'subastas' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Crear subasta</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Datos básicos</Text>
              <Input
                label="Nombre"
                value={formSubasta.nombre}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, nombre: value }))}
                placeholder="Subasta especial"
              />
              <Select
                label="Temática"
                value={categorias.find((c) => c.id === formSubasta.tematica)?.nombre || ''}
                options={categorias}
                placeholder="Seleccionar temática"
                onSelect={(id) => setFormSubasta((prev) => ({ ...prev, tematica: id }))}
              />
              <Select
                label="Categoría (nivel acceso)"
                value={formSubasta.categoria}
                placeholder="Seleccionar categoría"
                options={categoriasOpciones}
                onSelect={(_, nombre) => setFormSubasta((prev) => ({ ...prev, categoria: nombre }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Fecha y hora</Text>
              <Text style={styles.dateHelperText}>Disponible desde {formatFecha(minFecha)}</Text>
              <View style={styles.pickerRow}>
                <View style={styles.pickerField}>
                  <Text style={styles.pickerLabel}>FECHA</Text>
                  <TouchableOpacity style={styles.pickerInput} onPress={openFechaPicker}>
                    <Text style={formSubasta.fecha ? styles.pickerValue : styles.pickerPlaceholder}>
                      {formSubasta.fecha || 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 12 }} />
                <View style={styles.pickerField}>
                  <Text style={styles.pickerLabel}>HORA</Text>
                  <TouchableOpacity style={styles.pickerInput} onPress={openHoraPicker}>
                    <Text style={formSubasta.hora ? styles.pickerValue : styles.pickerPlaceholder}>
                      {formSubasta.hora || 'Seleccionar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Logística</Text>
              <Input
                label="Ubicación"
                value={formSubasta.ubicacion}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, ubicacion: value }))}
                placeholder="Buenos Aires"
              />
              <Input
                label="Capacidad asistentes"
                value={formSubasta.capacidadasistentes}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, capacidadasistentes: value }))}
                keyboardType="numeric"
                placeholder="200"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Condiciones</Text>
              <Input
                label="Tiene depósito (si/no)"
                value={formSubasta.tienedeposito}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, tienedeposito: value }))}
                placeholder="si"
              />
              <Input
                label="Seguridad propia (si/no)"
                value={formSubasta.seguridadpropia}
                onChangeText={(value) => setFormSubasta((prev) => ({ ...prev, seguridadpropia: value }))}
                placeholder="no"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formGroupTitle}>Portada</Text>
              <TouchableOpacity style={styles.imagePickerButton} onPress={handlePickImage}>
                {imagenUri ? (
                  <Image source={{ uri: imagenUri }} style={styles.imagePreview} resizeMode="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Text style={styles.imagePlaceholderText}>+ Agregar imagen de portada</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Button title="Crear subasta" onPress={handleCrearSubasta} loading={guardandoSubasta} />
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 80 },
  title: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 2 },
  subtitle: { fontSize: 13, color: '#64748B', marginBottom: 20 },
  loadingText: { color: '#64748B', fontSize: 13, textAlign: 'center', marginVertical: 16 },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  tabItemTextActive: {
    color: '#6366F1',
  },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#0F172A', marginBottom: 16 },

  formGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  formGroupTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    letterSpacing: 0.8,
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  dateHelperText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    marginTop: -4,
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  pickerField: {
    flex: 1,
    marginBottom: 0,
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#475569',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pickerInput: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
  },
  pickerValue: {
    fontSize: 16,
    color: '#0F172A',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  pickerModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerModalContent: {
    backgroundColor: '#FFF',
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  cardText: { fontSize: 13, color: '#64748B', marginBottom: 3, lineHeight: 18 },
  badge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  badgeRejected: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },

  emptyText: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginVertical: 20 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: { flex: 1, marginBottom: 0 },

  imagePickerButton: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    backgroundColor: '#FAFAFA',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: '500',
  },
});
