import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Alert,
  Image, TouchableOpacity, Platform, Modal, LayoutAnimation, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';
import { Button } from '@/src/components/Button';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import { SkeletonList } from '@/src/components/Skeleton';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

const CATEGORIAS_CLIENTE = ['Común', 'Especial', 'Plata', 'Oro', 'Platino'];
const SI_NO = ['Sí', 'No'];
const TABS = [
  { key: 'pendientes' as const, label: 'PENDIENTES' },
  { key: 'rechazados' as const, label: 'RECHAZADOS' },
  { key: 'productos' as const, label: 'PRODUCTOS' },
  { key: 'subastas' as const, label: 'SUBASTAS' },
];

interface ClientePendiente {
  cliente_id: string | number;
  nombre?: string | null;
  documento?: string | null;
  email?: string | null;
  admitido?: string | null;
  categoria?: string | null;
}

interface ProductoPendiente {
  producto_id: string | number;
  descripcioncatalogo?: string | null;
  descripcioncompleta?: string | null;
  disponible?: string | null;
  revisor?: number | null;
  seguro?: string | null;
  duenio?: string | number | null;
  preciosugerido?: number | null;
  preciobase?: number | null;
  comision?: number | null;
  fotos?: string[];
}

interface Categoria { id?: number; nombre?: string; }
interface Revisor { id: number; nombre: string; }

function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D';
  return `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AdminPanel() {
  const { token, removeToken } = useAuth();
  const [clientes, setClientes] = useState<ClientePendiente[]>([]);
  const [clientesRechazados, setClientesRechazados] = useState<ClientePendiente[]>([]);
  const [productos, setProductos] = useState<ProductoPendiente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [revisores, setRevisores] = useState<Revisor[]>([]);
  const [subastasLista, setSubastasLista] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'pendientes' | 'rechazados' | 'productos' | 'subastas'>('pendientes');

  const [categoriaPorCliente, setCategoriaPorCliente] = useState<Record<string, string>>({});
  const [revisorId, setRevisorId] = useState('');

  const [formSubasta, setFormSubasta] = useState({
    nombre: '', fecha: '', hora: '', ubicacion: '',
    capacidadasistentes: '', tienedeposito: '', seguridadpropia: '',
    categoria: '', tematica: 0,
  });
  const [guardandoSubasta, setGuardandoSubasta] = useState(false);
  const [fechaPickerValue, setFechaPickerValue] = useState<Date | null>(null);
  const [horaPickerValue, setHoraPickerValue] = useState<Date | null>(null);
  const [showFechaPicker, setShowFechaPicker] = useState(false);
  const [showHoraPicker, setShowHoraPicker] = useState(false);
  const [imagenUri, setImagenUri] = useState<string | null>(null);
  const [imagenFile, setImagenFile] = useState<{ uri: string; name: string; type: string } | null>(null);

  const [detalleProducto, setDetalleProducto] = useState<ProductoPendiente | null>(null);
  const [showDetalleProducto, setShowDetalleProducto] = useState(false);
  const [precioBaseAprobar, setPrecioBaseAprobar] = useState('');
  const [comisionAprobar, setComisionAprobar] = useState('');
  const [subastaIdAprobar, setSubastaIdAprobar] = useState<number | null>(null);
  const [subastaLabelAprobar, setSubastaLabelAprobar] = useState('');
  const [cerrandoSubasta, setCerrandoSubasta] = useState<string | null>(null);

  const minFecha = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const formatFecha = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  };
  const formatHora = (date: Date) =>
    `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

  const handleFechaChange = (_: any, sel?: Date) => {
    if (!sel) return;
    setFechaPickerValue(sel);
    setFormSubasta(p => ({ ...p, fecha: formatFecha(sel) }));
  };
  const handleHoraChange = (_: any, sel?: Date) => {
    if (!sel) return;
    setHoraPickerValue(sel);
    setFormSubasta(p => ({ ...p, hora: formatHora(sel) }));
  };

  const openFechaPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: fechaPickerValue || minFecha, mode: 'date', minimumDate: minFecha, onChange: handleFechaChange });
      return;
    }
    setShowFechaPicker(true);
  };
  const openHoraPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: horaPickerValue || new Date(), mode: 'time', is24Hour: true, onChange: handleHoraChange });
      return;
    }
    setShowHoraPicker(true);
  };

  const handlePickImage = () => {
    const opts: any[] = [
      { text: 'CÁMARA', onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso denegado','Necesitamos acceso a la cámara.'); return; }
        const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [16,9] });
        if (r.canceled || !r.assets?.[0]) return;
        setImagenUri(r.assets[0].uri);
        setImagenFile({ uri: r.assets[0].uri, name: 'subasta-portada.jpg', type: r.assets[0].mimeType || 'image/jpeg' });
      }},
      { text: 'GALERÍA', onPress: async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permiso denegado','Necesitamos acceso a la galería.'); return; }
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [16,9] });
        if (r.canceled || !r.assets?.[0]) return;
        setImagenUri(r.assets[0].uri);
        setImagenFile({ uri: r.assets[0].uri, name: 'subasta-portada.jpg', type: r.assets[0].mimeType || 'image/jpeg' });
      }},
    ];
    if (imagenUri) opts.push({ text: 'ELIMINAR IMAGEN', onPress: () => { setImagenUri(null); setImagenFile(null); }, style: 'destructive' });
    opts.push({ text: 'CANCELAR', style: 'cancel' });
    Alert.alert('Imagen de portada', 'Elegí una opción', opts);
  };

  const handleUnauthorized = useCallback(() => { removeToken(); }, [removeToken]);

  const fetchClientes = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/clientes/pendientes`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { handleUnauthorized(); return [] as ClientePendiente[]; }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchClientesRechazados = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/clientes/rechazados`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { handleUnauthorized(); return [] as ClientePendiente[]; }
    if (!res.ok) return [] as ClientePendiente[];
    return (await res.json()) as ClientePendiente[];
  }, [token, handleUnauthorized]);

  const fetchProductos = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/admin/productos/pendientes`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { handleUnauthorized(); return [] as ProductoPendiente[]; }
    if (!res.ok) return [] as ProductoPendiente[];
    return (await res.json()) as ProductoPendiente[];
  }, [token, handleUnauthorized]);

  const fetchCategorias = useCallback(async () => {
    const res = await fetch(`${API_URL}/api/categorias`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) { handleUnauthorized(); return [] as Categoria[]; }
    if (!res.ok) return [] as Categoria[];
    const raw = (await res.json()) as any[];
    return raw.map(c => ({ id: c.id ?? c.identificador ?? null, nombre: c.nombre ?? null }));
  }, [token, handleUnauthorized]);

  const fetchSubastas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/subastas`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { handleUnauthorized(); return []; }
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }, [token, handleUnauthorized]);

  const fetchRevisores = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/opciones`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { handleUnauthorized(); return []; }
      if (!res.ok) return [];
      const data = await res.json();
      return data.revisores || [];
    } catch { return []; }
  }, [token, handleUnauthorized]);

  const cargarDatos = useCallback(async () => {
    try {
      const [c, cr, p, cats, revs, subs] = await Promise.all([
        fetchClientes(), fetchClientesRechazados(), fetchProductos(),
        fetchCategorias(), fetchRevisores(), fetchSubastas(),
      ]);
      setClientes(c); setClientesRechazados(cr); setProductos(p);
      setCategorias(cats); setRevisores(revs); setSubastasLista(subs);
    } catch { Alert.alert('Error', 'No se pudieron cargar los datos'); }
    finally { setLoading(false); }
  }, [fetchClientes, fetchClientesRechazados, fetchProductos, fetchCategorias, fetchRevisores, fetchSubastas]);

  useEffect(() => { if (token) cargarDatos(); }, [token, cargarDatos]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await cargarDatos(); setRefreshing(false); }, [cargarDatos]);

  const categoriasOpciones = useMemo(() => CATEGORIAS_CLIENTE.map((c, i) => ({ id: i+1, label: c })), []);

  const handleEvaluarCliente = async (clienteId: string | number, admitido: 'si' | 'no') => {
    const categoria = categoriaPorCliente[String(clienteId)];
    if (admitido === 'si' && !categoria) { Alert.alert('Falta categoría', 'Seleccioná una categoría antes de aprobar.'); return; }
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
    if (!revisorId || Number.isNaN(revisor)) { Alert.alert('Falta revisor', 'Seleccioná un revisor.'); return; }
    if (disponible === 'si') {
      if (!precioBaseAprobar.trim() || Number(precioBaseAprobar) <= 0) { Alert.alert('Falta precio base', 'Ingresá un precio base mayor a 0.'); return; }
      if (!comisionAprobar.trim() || Number(comisionAprobar) <= 0) { Alert.alert('Falta comisión', 'Ingresá una comisión mayor a 0.'); return; }
      if (!subastaIdAprobar) { Alert.alert('Falta subasta', 'Seleccioná una subasta.'); return; }
    }
    const producto = productos.find(p => String(p.producto_id) === String(productoId));
    const body: Record<string, any> = { disponible, revisor, descripcioncatalogo: producto?.descripcioncatalogo ?? null, seguro: producto?.seguro ?? null };
    if (disponible === 'si') { body.preciobase = Number(precioBaseAprobar); body.comision = Number(comisionAprobar); body.subasta_id = subastaIdAprobar; }
    try {
      const res = await fetch(`${API_URL}/api/admin/productos/${productoId}/evaluacion`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (!res.ok) { Alert.alert('Error', 'No se pudo actualizar el producto.'); return; }
      setShowDetalleProducto(false);
      setPrecioBaseAprobar(''); setComisionAprobar(''); setSubastaIdAprobar(null); setSubastaLabelAprobar('');
      await cargarDatos();
    } catch { Alert.alert('Error', 'No se pudo actualizar el producto.'); }
  };

  const handleCrearSubasta = async () => {
    if (!formSubasta.nombre || !formSubasta.fecha || !formSubasta.hora || !formSubasta.categoria || !formSubasta.tematica) {
      Alert.alert('Faltan datos', 'Completá los campos obligatorios.'); return;
    }
    setGuardandoSubasta(true);
    try {
      let imagenUrl = '';
      if (imagenFile) {
        const fd = new FormData();
        fd.append('imagen', imagenFile as any);
        const upRes = await fetch(`${API_URL}/api/admin/subastas/portada`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
        if (!upRes.ok) throw new Error('Error al subir imagen');
        imagenUrl = (await upRes.json()).url;
      }
      const res = await fetch(`${API_URL}/api/admin/subastas`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formSubasta, capacidadasistentes: formSubasta.capacidadasistentes ? Number(formSubasta.capacidadasistentes) : undefined, imagen: imagenUrl || undefined }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); Alert.alert('Error', e.error || 'No se pudo crear la subasta.'); return; }
      Alert.alert('Listo', 'Subasta creada exitosamente.');
      setFormSubasta({ nombre:'',fecha:'',hora:'',ubicacion:'',capacidadasistentes:'',tienedeposito:'',seguridadpropia:'',categoria:'',tematica:0 });
      setImagenUri(null); setImagenFile(null);
      await cargarDatos();
    } catch (e: any) { Alert.alert('Error', e?.message || 'No se pudo crear la subasta.'); }
    finally { setGuardandoSubasta(false); }
  };

  const handleCerrarSubasta = async (id: string | number) => {
    Alert.alert('Cerrar subasta', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar', style: 'destructive', onPress: async () => {
        setCerrandoSubasta(String(id));
        try {
          const res = await fetch(`${API_URL}/api/admin/subastas/${id}/cerrar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) { const e = await res.json().catch(()=>({})); Alert.alert('Error', e.error || 'No se pudo cerrar.'); return; }
          Alert.alert('Listo', 'Subasta cerrada correctamente.');
          await cargarDatos();
        } catch { Alert.alert('Error', 'No se pudo cerrar la subasta.'); }
        finally { setCerrandoSubasta(null); }
      }},
    ]);
  };

  const switchTab = (key: typeof tab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(key);
  };

  const counts = { pendientes: clientes.length, rechazados: clientesRechazados.length, productos: productos.length, subastas: subastasLista.length };

  if (!token) return (
    <SafeAreaView style={s.container}>
      <Text style={s.emptyText}>Iniciá sesión para ver el panel admin.</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>REMATIX</Text>
        <View style={s.headerBack} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.content}>

          {/* Título */}
          <View style={s.titleSection}>
            <Text style={s.pageLabel}>PANEL ADMINISTRATIVO</Text>
            <Text style={s.pageTitle}>Gestión{'\n'}y validaciones</Text>
          </View>

          {/* Métricas */}
          {!loading && (
            <View style={s.metricsGrid}>
              {[
                { label: 'PENDIENTES', value: counts.pendientes },
                { label: 'RECHAZADOS', value: counts.rechazados },
                { label: 'PRODUCTOS', value: counts.productos },
                { label: 'SUBASTAS', value: counts.subastas },
              ].map(m => (
                <View key={m.label} style={s.metricCard}>
                  <Text style={s.metricLabel}>{m.label}</Text>
                  <Text style={s.metricValue}>{m.value}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Tab bar */}
          <View style={s.tabBar}>
            {TABS.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.tabItem, tab === t.key && s.tabItemActive]}
                onPress={() => switchTab(t.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Contenido */}
          {loading ? (
            <SkeletonList rows={4} gap={12} />
          ) : (
            <>
              {/* PENDIENTES */}
              {tab === 'pendientes' && (
                <>
                  <Text style={s.sectionLabel}>CLIENTES PENDIENTES ({clientes.length})</Text>
                  {clientes.length === 0 ? (
                    <View style={s.emptyState}>
                      <Ionicons name="checkmark-circle-outline" size={40} color="#CCC" />
                      <Text style={s.emptyText}>Sin clientes pendientes</Text>
                    </View>
                  ) : clientes.map(c => (
                    <View key={String(c.cliente_id)} style={s.card}>
                      <View style={s.cardHeader}>
                        <View>
                          <Text style={s.cardName}>{c.nombre || 'Sin nombre'}</Text>
                          <Text style={s.cardMeta}>{c.email || '—'}</Text>
                          <Text style={s.cardMeta}>{c.documento || '—'}</Text>
                        </View>
                        <View style={s.badgePending}><Text style={s.badgePendingText}>PENDIENTE</Text></View>
                      </View>
                      <View style={s.cardDivider} />
                      <Select
                        label="Categoría"
                        value={categoriaPorCliente[String(c.cliente_id)] || ''}
                        placeholder="Seleccionar categoría"
                        options={categoriasOpciones}
                        onSelect={(_, nombre) => setCategoriaPorCliente(prev => ({ ...prev, [String(c.cliente_id)]: nombre }))}
                      />
                      <View style={s.actionRow}>
                        <TouchableOpacity style={s.btnPrimary} onPress={() => handleEvaluarCliente(c.cliente_id, 'si')}>
                          <Text style={s.btnPrimaryText}>ACEPTAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btnSecondary} onPress={() => handleEvaluarCliente(c.cliente_id, 'no')}>
                          <Text style={s.btnSecondaryText}>RECHAZAR</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </>
              )}

              {/* RECHAZADOS */}
              {tab === 'rechazados' && (
                <>
                  <Text style={s.sectionLabel}>CLIENTES RECHAZADOS ({clientesRechazados.length})</Text>
                  {clientesRechazados.length === 0 ? (
                    <View style={s.emptyState}>
                      <Ionicons name="checkmark-done-outline" size={40} color="#CCC" />
                      <Text style={s.emptyText}>Sin clientes rechazados</Text>
                    </View>
                  ) : clientesRechazados.map(c => (
                    <View key={`rej-${c.cliente_id}`} style={s.card}>
                      <View style={s.cardHeader}>
                        <View>
                          <Text style={s.cardName}>{c.nombre || 'Sin nombre'}</Text>
                          <Text style={s.cardMeta}>{c.email || '—'}</Text>
                        </View>
                        <View style={s.badgeRejected}><Text style={s.badgeRejectedText}>RECHAZADO</Text></View>
                      </View>
                      <View style={s.cardDivider} />
                      <Select
                        label="Categoría"
                        value={categoriaPorCliente[String(c.cliente_id)] || ''}
                        placeholder="Seleccionar categoría"
                        options={categoriasOpciones}
                        onSelect={(_, nombre) => setCategoriaPorCliente(prev => ({ ...prev, [String(c.cliente_id)]: nombre }))}
                      />
                      <TouchableOpacity style={s.btnPrimary} onPress={() => handleEvaluarCliente(c.cliente_id, 'si')}>
                        <Text style={s.btnPrimaryText}>REHABILITAR</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </>
              )}

              {/* PRODUCTOS */}
              {tab === 'productos' && (
                <>
                  <Text style={s.sectionLabel}>PRODUCTOS PENDIENTES ({productos.length})</Text>
                  <View style={s.card}>
                    <Select
                      label="Revisor asignado"
                      value={revisores.find(r => String(r.id) === revisorId)?.nombre || ''}
                      placeholder="Seleccionar revisor"
                      options={revisores.map(r => ({ id: r.id, nombre: r.nombre }))}
                      onSelect={id => setRevisorId(String(id))}
                    />
                  </View>
                  {productos.length === 0 ? (
                    <View style={s.emptyState}>
                      <Ionicons name="cube-outline" size={40} color="#CCC" />
                      <Text style={s.emptyText}>Sin productos pendientes</Text>
                    </View>
                  ) : productos.map(p => (
                    <TouchableOpacity
                      key={String(p.producto_id)}
                      style={s.productCard}
                      activeOpacity={0.85}
                      onPress={() => { setDetalleProducto(p); setShowDetalleProducto(true); }}
                    >
                      <View style={s.productImageWrap}>
                        {p.fotos?.[0] ? (
                          <Image source={{ uri: p.fotos[0] }} style={s.productImage} resizeMode="cover" />
                        ) : (
                          <View style={s.productImagePlaceholder}>
                            <Ionicons name="image-outline" size={32} color="#CCC" />
                          </View>
                        )}
                        <View style={s.badgePending}><Text style={s.badgePendingText}>PENDIENTE</Text></View>
                      </View>
                      <View style={s.productBody}>
                        <Text style={s.cardName} numberOfLines={1}>{p.descripcioncatalogo || `Producto #${p.producto_id}`}</Text>
                        <Text style={s.cardMeta} numberOfLines={2}>{p.descripcioncompleta || 'Sin descripción.'}</Text>
                        <View style={s.productMeta}>
                          <View>
                            <Text style={s.metricLabel}>SUGERIDO</Text>
                            <Text style={s.metricValue}>{formatPrice(p.preciosugerido)}</Text>
                          </View>
                          <View>
                            <Text style={s.metricLabel}>DUEÑO</Text>
                            <Text style={s.metricValue}>#{p.duenio || '?'}</Text>
                          </View>
                          <View>
                            <Text style={s.metricLabel}>SEGURO</Text>
                            <Text style={s.metricValue}>{p.seguro || '—'}</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* SUBASTAS */}
              {tab === 'subastas' && (
                <>
                  <Text style={s.sectionLabel}>NUEVA SUBASTA</Text>
                  <View style={s.card}>
                    <Input label="Nombre" value={formSubasta.nombre} onChangeText={v => setFormSubasta(p=>({...p,nombre:v}))} placeholder="Ej: Subasta de Arte" />
                    <Select label="Temática" value={categorias.find(c=>c.id===formSubasta.tematica)?.nombre||''} options={categorias} placeholder="Seleccionar temática" onSelect={id=>setFormSubasta(p=>({...p,tematica:id}))} />
                    <Select label="Nivel de acceso" value={formSubasta.categoria} placeholder="Seleccionar nivel" options={categoriasOpciones} onSelect={(_,nombre)=>setFormSubasta(p=>({...p,categoria:nombre}))} />

                    <View style={s.rowFields}>
                      <TouchableOpacity style={s.fieldHalf} onPress={openFechaPicker}>
                        <Text style={s.fieldLabel}>FECHA</Text>
                        <Text style={formSubasta.fecha ? s.fieldValue : s.fieldPlaceholder}>{formSubasta.fecha || 'Seleccionar'}</Text>
                        <View style={s.fieldUnderline} />
                      </TouchableOpacity>
                      <TouchableOpacity style={s.fieldHalf} onPress={openHoraPicker}>
                        <Text style={s.fieldLabel}>HORA</Text>
                        <Text style={formSubasta.hora ? s.fieldValue : s.fieldPlaceholder}>{formSubasta.hora || 'Seleccionar'}</Text>
                        <View style={s.fieldUnderline} />
                      </TouchableOpacity>
                    </View>

                    <Input label="Ubicación" value={formSubasta.ubicacion} onChangeText={v=>setFormSubasta(p=>({...p,ubicacion:v}))} placeholder="Ej: Buenos Aires" />
                    <Input label="Capacidad asistentes" value={formSubasta.capacidadasistentes} onChangeText={v=>setFormSubasta(p=>({...p,capacidadasistentes:v}))} keyboardType="numeric" placeholder="Ej: 200" />
                    <Select label="Tiene depósito" value={formSubasta.tienedeposito?(formSubasta.tienedeposito==='si'?'Sí':'No'):''} placeholder="Seleccionar" options={[{id:1,label:'Sí'},{id:2,label:'No'}]} onSelect={(_,nombre)=>setFormSubasta(p=>({...p,tienedeposito:nombre==='Sí'?'si':'no'}))} />
                    <Select label="Seguridad propia" value={formSubasta.seguridadpropia?(formSubasta.seguridadpropia==='si'?'Sí':'No'):''} placeholder="Seleccionar" options={[{id:1,label:'Sí'},{id:2,label:'No'}]} onSelect={(_,nombre)=>setFormSubasta(p=>({...p,seguridadpropia:nombre==='Sí'?'si':'no'}))} />

                    <Text style={s.fieldLabel}>IMAGEN DE PORTADA</Text>
                    <TouchableOpacity style={s.imagePicker} onPress={handlePickImage} activeOpacity={0.85}>
                      {imagenUri ? (
                        <Image source={{ uri: imagenUri }} style={s.imagePreview} resizeMode="cover" />
                      ) : (
                        <View style={s.imagePlaceholder}>
                          <Ionicons name="add" size={24} color="#888" />
                          <Text style={s.imagePlaceholderText}>Agregar imagen</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={[s.btnPrimary, guardandoSubasta && s.btnDisabled]} onPress={handleCrearSubasta} disabled={guardandoSubasta}>
                    <Text style={s.btnPrimaryText}>{guardandoSubasta ? 'CREANDO...' : 'CREAR SUBASTA'}</Text>
                  </TouchableOpacity>

                  <Text style={[s.sectionLabel, { marginTop: 24 }]}>SUBASTAS EXISTENTES ({subastasLista.length})</Text>
                  {subastasLista.length === 0 ? (
                    <View style={s.emptyState}>
                      <Ionicons name="hammer-outline" size={40} color="#CCC" />
                      <Text style={s.emptyText}>Sin subastas</Text>
                    </View>
                  ) : subastasLista.map(sub => {
                    const abierta = sub.estado?.toLowerCase() === 'abierta';
                    return (
                      <View key={String(sub.id)} style={s.card}>
                        <View style={s.cardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.cardName}>{sub.nombre || `Subasta #${sub.id}`}</Text>
                            {sub.fecha ? <Text style={s.cardMeta}>{sub.fecha}{sub.hora ? ` · ${sub.hora}` : ''}</Text> : null}
                          </View>
                          <View style={abierta ? s.badgePending : s.badgeRejected}>
                            <Text style={abierta ? s.badgePendingText : s.badgeRejectedText}>{abierta ? 'ABIERTA' : 'CERRADA'}</Text>
                          </View>
                        </View>
                        {abierta && (
                          <>
                            <View style={s.cardDivider} />
                            <TouchableOpacity
                              style={[s.btnSecondary, cerrandoSubasta === String(sub.id) && s.btnDisabled]}
                              onPress={() => handleCerrarSubasta(sub.id)}
                              disabled={cerrandoSubasta === String(sub.id)}
                            >
                              <Text style={s.btnSecondaryText}>{cerrandoSubasta === String(sub.id) ? 'CERRANDO...' : 'CERRAR SUBASTA'}</Text>
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Pickers iOS */}
      <Modal visible={showFechaPicker} transparent animationType="slide">
        <View style={s.pickerOverlay}>
          <View style={s.pickerContent}>
            <DateTimePicker value={fechaPickerValue||minFecha} mode="date" display="spinner" minimumDate={minFecha} onChange={handleFechaChange} />
            <TouchableOpacity style={s.btnPrimary} onPress={() => setShowFechaPicker(false)}>
              <Text style={s.btnPrimaryText}>LISTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showHoraPicker} transparent animationType="slide">
        <View style={s.pickerOverlay}>
          <View style={s.pickerContent}>
            <DateTimePicker value={horaPickerValue||new Date()} mode="time" is24Hour display="spinner" onChange={handleHoraChange} />
            <TouchableOpacity style={s.btnPrimary} onPress={() => setShowHoraPicker(false)}>
              <Text style={s.btnPrimaryText}>LISTO</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal detalle producto */}
      <Modal visible={showDetalleProducto} transparent animationType="slide" onRequestClose={() => setShowDetalleProducto(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>DETALLE DEL PRODUCTO</Text>
              <TouchableOpacity onPress={() => { setShowDetalleProducto(false); setPrecioBaseAprobar(''); setComisionAprobar(''); setSubastaIdAprobar(null); setSubastaLabelAprobar(''); }}>
                <Ionicons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {(detalleProducto?.fotos || []).length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  {detalleProducto?.fotos?.map((f, i) => (
                    <Image key={i} source={{ uri: f }} style={s.modalImage} resizeMode="cover" />
                  ))}
                </ScrollView>
              ) : (
                <View style={s.modalImagePlaceholder}>
                  <Ionicons name="image-outline" size={40} color="#CCC" />
                </View>
              )}

              <View style={{ paddingHorizontal: 20 }}>
                <Text style={s.cardName}>{detalleProducto?.descripcioncatalogo || `Producto #${detalleProducto?.producto_id}`}</Text>
                <Text style={[s.cardMeta, { marginBottom: 16 }]}>{detalleProducto?.descripcioncompleta || 'Sin descripción.'}</Text>

                <View style={s.productMeta}>
                  <View><Text style={s.metricLabel}>SUGERIDO</Text><Text style={s.metricValue}>{formatPrice(detalleProducto?.preciosugerido)}</Text></View>
                  <View><Text style={s.metricLabel}>SEGURO</Text><Text style={s.metricValue}>{detalleProducto?.seguro || '—'}</Text></View>
                  <View><Text style={s.metricLabel}>DUEÑO</Text><Text style={s.metricValue}>#{detalleProducto?.duenio || '?'}</Text></View>
                </View>

                <View style={s.cardDivider} />
                <Text style={[s.sectionLabel, { marginBottom: 12 }]}>CONFIGURACIÓN DE APROBACIÓN</Text>

                <Select label="Revisor" value={revisores.find(r=>String(r.id)===revisorId)?.nombre||''} placeholder="Seleccionar revisor" options={revisores.map(r=>({id:r.id,nombre:r.nombre}))} onSelect={id=>setRevisorId(String(id))} />
                <Input label="Precio base" value={precioBaseAprobar} onChangeText={setPrecioBaseAprobar} placeholder="Ej: 150000" keyboardType="numeric" />
                <Input label="Comisión (%)" value={comisionAprobar} onChangeText={setComisionAprobar} placeholder="Ej: 10" keyboardType="numeric" />
                <Select label="Subasta" value={subastaLabelAprobar} options={subastasLista} placeholder="Seleccionar subasta" onSelect={(id,label)=>{setSubastaIdAprobar(id);setSubastaLabelAprobar(label);}} />

                <View style={s.actionRow}>
                  <TouchableOpacity style={s.btnPrimary} onPress={() => detalleProducto && handleEvaluarProducto(detalleProducto.producto_id, 'si')}>
                    <Text style={s.btnPrimaryText}>APROBAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.btnSecondary} onPress={() => detalleProducto && handleEvaluarProducto(detalleProducto.producto_id, 'no')}>
                    <Text style={s.btnSecondaryText}>RECHAZAR</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 24 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerBack: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', letterSpacing: 3, color: '#000' },
  content: { paddingHorizontal: 20, paddingBottom: 60 },

  titleSection: { paddingTop: 8, paddingBottom: 24 },
  pageLabel: { fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 6 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: '#000', lineHeight: 32 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  metricCard: { width: '48%', backgroundColor: '#FFF', padding: 14, borderWidth: 0.5, borderColor: '#E0E0E0',borderRadius: 12 },
  metricLabel: { fontSize: 9, color: '#888', letterSpacing: 1.5, marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: '900', color: '#000' },

  tabBar: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0', marginBottom: 24 },
  tabItem: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#000' },
  tabText: { fontSize: 9, letterSpacing: 1, color: '#888', fontWeight: '700' },
  tabTextActive: { color: '#000' },

  sectionLabel: { fontSize: 10, color: '#888', letterSpacing: 2, marginBottom: 14 },

  card: {borderRadius: 12, backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E0E0E0', padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardDivider: { height: 0.5, backgroundColor: '#E0E0E0', marginBottom: 14 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#666', lineHeight: 18 },

  badgePending: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4 },
  badgePendingText: { fontSize: 9, fontWeight: '700', color: '#92400E', letterSpacing: 1 },
  badgeRejected: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4 },
  badgeRejectedText: { fontSize: 9, fontWeight: '700', color: '#991B1B', letterSpacing: 1 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnPrimary: { borderRadius: 8, flex: 1, backgroundColor: '#000', paddingVertical: 12, alignItems: 'center' },
  btnPrimaryText: { color: '#FFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  btnSecondary: { borderRadius: 8, flex: 1, borderWidth: 0.5, borderColor: '#000', paddingVertical: 10, alignItems: 'center' },
  btnSecondaryText: { color: '#000', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  btnDisabled: { opacity: 0.5 },

  productCard: { borderRadius: 12, backgroundColor: '#FFF', borderWidth: 0.5, borderColor: '#E0E0E0', marginBottom: 12, overflow: 'hidden' },
  productImageWrap: { width: '100%', height: 160, backgroundColor: '#F0F0F0', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  productImage: { width: '100%', height: '100%', position: 'absolute' },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  productBody: { padding: 14, gap: 4 },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: '#E0E0E0' },

  rowFields: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  fieldHalf: { flex: 1 },
  fieldLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', letterSpacing: 1, marginBottom: 4 },
  fieldValue: { fontSize: 16, color: '#000', paddingVertical: 8 },
  fieldPlaceholder: { fontSize: 16, color: '#B0B0B0', paddingVertical: 8 },
  fieldUnderline: { height: 1, backgroundColor: '#D0D0D0' },

  imagePicker: { borderRadius: 8, width: '100%', height: 140, borderWidth: 0.5, borderColor: '#E0E0E0', backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginTop: 8, marginBottom: 20, overflow: 'hidden' },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 12, color: '#888' },

  emptyState: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: '#888' },

  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerContent: { backgroundColor: '#FFF', padding: 16, paddingBottom: 32 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { borderRadius: 12, backgroundColor: '#FFF', maxHeight: '92%', paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  modalTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 2, color: '#000' },
  modalImage: { width: 240, height: 170, marginLeft: 20, marginRight: 8, backgroundColor: '#F0F0F0' },
  modalImagePlaceholder: { height: 170, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F0F0', marginBottom: 16 },
});
