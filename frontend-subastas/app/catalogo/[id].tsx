import {
  View, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Image, FlatList, TextInput, Modal, KeyboardAvoidingView, Platform, Alert, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/src/config/env';
import { PUJAS_POLLING_INTERVAL_MS } from '@/src/config/polling';
import CountdownBadge from '@/src/components/CountdownBadge';

interface ArticuloItem {
  id: string;
  numero_lote: string;
  titulo: string;
  precio_base: number;
  imagen_principal: string;
  estado: string;
}

interface CatalogoSubastaInfo {
  id: string;
  titulo: string;
  estado: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  ubicacion?: string | null;
  cantidad_articulos?: number | null;
}

function getDisplayStatus(item: CatalogoSubastaInfo): string {
  const estadoLower = String(item.estado).toLowerCase();
  if (estadoLower === 'cerrada' || estadoLower === 'finalizada') return 'FINALIZADA';
  const now = Date.now();
  const start = item.fecha_inicio ? new Date(item.fecha_inicio).getTime() : 0;
  const end = item.fecha_fin ? new Date(item.fecha_fin).getTime() : 0;
  if (start && now < start) return 'PRÓXIMAMENTE';
  if (end && now >= end) return 'FINALIZADA';
  return 'EN VIVO';
}

const BADGE_COLORS: Record<string, string> = {
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
        styles.estadoBadge,
        {
          backgroundColor: BADGE_COLORS[estado] || '#000',
          opacity: estado === 'EN VIVO' ? pulseAnim : 1,
        },
      ]}
    >
      <Text style={styles.estadoBadgeTexto}>{estado}</Text>
    </Animated.View>
  );
}

function CatalogoHeader({ subastaInfo, articulosCount }: { subastaInfo: CatalogoSubastaInfo; articulosCount: number }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const estado = getDisplayStatus(subastaInfo);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const fecha = subastaInfo.fecha_inicio
    ? new Date(subastaInfo.fecha_inicio).toLocaleDateString('es-AR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;

  return (
    <Animated.View style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <StatusBadge estado={estado} />
      <Text style={styles.headerTitulo} numberOfLines={2}>{subastaInfo.titulo}</Text>
      <View style={styles.headerMeta}>
        {articulosCount > 0 && (
          <View style={styles.headerMetaItem}>
            <Text style={styles.headerMetaNum}>{articulosCount}</Text>
            <Text style={styles.headerMetaLabel}>artículos</Text>
          </View>
        )}
        {subastaInfo.ubicacion && (
          <>
            <View style={styles.headerMetaDot} />
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>{subastaInfo.ubicacion}</Text>
            </View>
          </>
        )}
        {fecha && (
          <>
            <View style={styles.headerMetaDot} />
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>{fecha}</Text>
            </View>
          </>
        )}
      </View>
    </Animated.View>
  );
}

interface EstadoPujas {
  item_id: string;
  oferta_actual: number;
  estado_subasta: string;
  total_participantes: number;
  historial_pujas: { monto: number; fecha_hora: string | null; postor: string }[];
  es_ganadora?: boolean;
}

export default function CatalogoScreen() {
  const { id, titulo } = useLocalSearchParams<{ id: string; titulo: string }>();
  const { token, removeToken, nivel } = useAuth();

  const removeTokenRef = useRef(removeToken);
  useEffect(() => { removeTokenRef.current = removeToken; }, [removeToken]);

  const [articulos, setArticulos] = useState<ArticuloItem[]>([]);
  const [subastaInfo, setSubastaInfo] = useState<CatalogoSubastaInfo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busquedaVisible, setBusquedaVisible] = useState(false);
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [ordenSeleccionado, setOrdenSeleccionado] = useState('lote_numero');
  const [modalOrdenVisible, setModalOrdenVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const miUltimoMontoRef = useRef(0);
  // Mapa itemId → oferta actual para mostrar en las tarjetas
  const [ofertasActuales, setOfertasActuales] = useState<Record<string, number>>({});

  // --- Estado modal de puja ---
  const [modalPujaVisible, setModalPujaVisible] = useState(false);
  const [articuloSeleccionado, setArticuloSeleccionado] = useState<ArticuloItem | null>(null);
  const [estadoPujas, setEstadoPujas] = useState<EstadoPujas | null>(null);
  const [cargandoPujas, setCargandoPujas] = useState(false);
  const [montoPuja, setMontoPuja] = useState('');
  const [enviandoPuja, setEnviandoPuja] = useState(false);
  const [errorPuja, setErrorPuja] = useState<string | null>(null);
  const [pujaExitosa, setPujaExitosa] = useState(false);
  const [soyGanador, setSoyGanador] = useState(false);

  useEffect(() => {
    if (!pujaExitosa) return;
    const timer = setTimeout(() => setPujaExitosa(false), 2000);
    return () => clearTimeout(timer);
  }, [pujaExitosa]);

  const ordenes = [
    { key: 'lote_numero', label: 'N° Lote' },
    { key: 'precio_asc', label: 'Precio: menor a mayor' },
    { key: 'precio_desc', label: 'Precio: mayor a menor' },
    { key: 'tiempo_asc', label: 'Tiempo restante' },
  ];

  const fetchCatalogo = useCallback(async (q?: string, ord?: string) => {
    setCargando(true);
    try {
      let url = `${API_URL}/api/subastas/${id}/catalogo?orden=${ord || ordenSeleccionado}`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) { removeTokenRef.current?.(); return; }
      if (!res.ok) return;
      const data = await res.json();
      setSubastaInfo(data.subasta_info);
      setArticulos(data.articulos);
    } catch {
      // silencioso
    } finally {
      setCargando(false);
    }
  }, [id, ordenSeleccionado, token]);

  useEffect(() => { if (token) fetchCatalogo(); }, [token, fetchCatalogo]);

  // Helper para mapear niveles a ranking numérico
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
    switch (s) {
      case 'base':
      case 'comun':
      case '1':
        return 1;
      case 'especial':
      case '2':
        return 2;
      case 'plata':
      case '3':
        return 3;
      case 'oro':
      case '4':
        return 4;
      case 'platino':
      case '5':
        return 5;
      default:
        return 1;
    }
  };

  const nivelUsuario = rankOf(nivel || 'base');
  const rawReqSubasta = (subastaInfo as any)?.nivel_acceso ?? (subastaInfo as any)?.nivel ?? '';
  const nivelReqSubasta = rankOf(rawReqSubasta || 'comun');
  const subastaBloqueada = nivelUsuario < nivelReqSubasta;

  // Cuando cambian los artículos, trae las ofertas actuales de todos en paralelo
  useEffect(() => {
    if (!articulos.length || !token) return;
    const fetchOfertas = async () => {
      const resultados = await Promise.allSettled(
        articulos.map(art =>
          fetch(`${API_URL}/api/items/${art.id}/pujas`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then(r => r.ok ? r.json() : null)
        )
      );
      const nuevasOfertas: Record<string, number> = {};
      resultados.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value?.oferta_actual !== undefined) {
          nuevasOfertas[articulos[idx].id] = res.value.oferta_actual;
        }
      });
      setOfertasActuales(nuevasOfertas);
    };
    fetchOfertas();
  }, [articulos, token]);

  // Trae el estado actual de pujas del ítem (oferta actual, historial)
  const fetchEstadoPujas = async (itemId: string, esInicial: boolean = false) => {
    if (esInicial) {
      setCargandoPujas(true);
      setEstadoPujas(null);
    }
    try {
      const res = await fetch(`${API_URL}/api/items/${itemId}/pujas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { removeTokenRef.current?.(); return; }
      if (!res.ok) return;
      const data: EstadoPujas = await res.json();
      setEstadoPujas(data);
      setSoyGanador(data.es_ganadora === true);
    } catch {
      // silencioso
    } finally {
      if (esInicial) setCargandoPujas(false);
    }
  };

  const fetchEstadoPujasRef = useRef(fetchEstadoPujas);
  fetchEstadoPujasRef.current = fetchEstadoPujas;

  useEffect(() => {
    if (!modalPujaVisible || !articuloSeleccionado?.id || !token) return;
    const idItem = articuloSeleccionado.id;
    fetchEstadoPujasRef.current(idItem);
    const interval = setInterval(() => {
      fetchEstadoPujasRef.current(idItem);
    }, PUJAS_POLLING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [modalPujaVisible, articuloSeleccionado?.id, token]);

  const handleAbrirPuja = (articulo: ArticuloItem) => {
    if (subastaBloqueada) return; // prevenir apertura si nivel insuficiente
    setArticuloSeleccionado(articulo);
    setMontoPuja('');
    setErrorPuja(null);
    setPujaExitosa(false);
    setSoyGanador(false);
    setModalPujaVisible(true);
    fetchEstadoPujas(articulo.id, true);
  };

  const handleCerrarPuja = () => {
    setModalPujaVisible(false);
    setArticuloSeleccionado(null);
    setEstadoPujas(null);
    setMontoPuja('');
    setErrorPuja(null);
    setPujaExitosa(false);
    setSoyGanador(false);
    // Refresca el catálogo para actualizar precios
    fetchCatalogo();
  };

  const handleConfirmarPuja = async () => {
    if (!articuloSeleccionado) return;
    if (esAutoPuja) {
      setErrorPuja('Tu última puja es la ganadora. Esperá a que te superen.');
      return;
    }
    const monto = parseFloat(montoPuja.replace(/\./g, '').replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      setErrorPuja('Ingresá un monto válido.');
      return;
    }
    setEnviandoPuja(true);
    setErrorPuja(null);
    try {
      const res = await fetch(`${API_URL}/api/pujas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ item_id: articuloSeleccionado.id, monto_ofertado: monto }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mapea los códigos de error del backend a mensajes amigables
        const mensajes: Record<string, string> = {
          MONTO_INSUFICIENTE: `El monto mínimo es ${data.monto_minimo ? formatearPrecio(data.monto_minimo) : 'mayor a la oferta actual'}.`,
          MONTO_EXCEDE_LIMITE: 'El monto supera el límite máximo permitido para tu categoría.',
          USUARIO_EN_OTRA_SALA: 'Ya estás participando en otra subasta activa. Cerrá esa sesión primero.',
          AUTO_PUJA: 'Tu última puja es la ganadora. Esperá a que te superen.',
        };
        setErrorPuja(mensajes[data.codigo] || data.error || 'No se pudo registrar la puja.');
        return;
      }
      // Puja exitosa
      miUltimoMontoRef.current = monto;
      setPujaExitosa(true);
      setEstadoPujas(prev => prev ? { ...prev, oferta_actual: data.oferta_actual } : prev);
      // Actualiza la tarjeta del catálogo inmediatamente
      setOfertasActuales(prev => ({ ...prev, [articuloSeleccionado.id]: data.oferta_actual }));
      // Refresca el historial de pujas
      fetchEstadoPujas(articuloSeleccionado.id);
    } catch {
      setErrorPuja('Error de conexión. Revisá tu red e intentá de nuevo.');
    } finally {
      setEnviandoPuja(false);
    }
  };

  const handleToggleBusqueda = () => {
    setBusquedaVisible(!busquedaVisible);
    if (!busquedaVisible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setTextoBusqueda('');
      fetchCatalogo();
    }
  };

  const handleSearch = () => { fetchCatalogo(textoBusqueda); };

  const handleOrdenChange = (key: string) => {
    setOrdenSeleccionado(key);
    setModalOrdenVisible(false);
    fetchCatalogo(textoBusqueda || undefined, key);
  };

  const formatearPrecio = (monto: number) =>
    `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(monto)}`;

  const esAutoPuja = soyGanador && miUltimoMontoRef.current > 0;

  const montoMinimo = estadoPujas
    ? estadoPujas.oferta_actual + (articuloSeleccionado ? articuloSeleccionado.precio_base * 0.01 : 0)
    : articuloSeleccionado?.precio_base ?? 0;

  const renderArticulo = ({ item }: { item: ArticuloItem }) => (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => { if (!subastaBloqueada) handleAbrirPuja(item); }}
        style={styles.imageContainer}
      >
        <Image source={{ uri: item.imagen_principal }} style={styles.cardImagen} resizeMode="contain" />
        {item.estado === 'DISPONIBLE' && (
          <View style={styles.badgeEnVivo}>
            <Text style={styles.badgeEnVivoTexto}>EN VIVO</Text>
          </View>
        )}
        <CountdownBadge
          fechaInicio={subastaInfo?.fecha_inicio}
          fechaFin={subastaInfo?.fecha_fin}
        />
      </TouchableOpacity>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleContainer}>
            <Text style={styles.loteNumero}>LOTE {String(item.numero_lote).padStart(3, '0')}</Text>
            <Text style={styles.cardTitulo} numberOfLines={1}>{item.titulo}</Text>
          </View>
          <TouchableOpacity style={styles.favoritoBtn}>
            <Ionicons name="heart-outline" size={22} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.divider} />
        <View style={styles.cardFooterRow}>
          <View>
            <Text style={styles.ofertaLabel}>OFERTA ACTUAL</Text>
            <Text style={styles.ofertaMonto}>{formatearPrecio(ofertasActuales[item.id] ?? item.precio_base)}</Text>
          </View>
          <TouchableOpacity
            style={[styles.pujarBtn, subastaBloqueada && styles.pujarBtnDisabled]}
            onPress={() => { if (!subastaBloqueada) handleAbrirPuja(item); }}
            disabled={subastaBloqueada}
          >
            <Text style={[styles.pujarBtnTexto, subastaBloqueada && styles.pujarBtnTextoDisabled]}>PUJAR</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (cargando && articulos.length === 0) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <TouchableOpacity onPress={handleToggleBusqueda} style={styles.headerAction}>
          <Ionicons name={busquedaVisible ? 'close' : 'search'} size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {busquedaVisible && (
        <View style={styles.busquedaBar}>
          <TextInput
            ref={inputRef}
            style={styles.busquedaInput}
            placeholder="Buscar artículos..."
            placeholderTextColor="#999"
            value={textoBusqueda}
            onChangeText={setTextoBusqueda}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {textoBusqueda.length > 0 && (
            <TouchableOpacity onPress={() => { setTextoBusqueda(''); fetchCatalogo(); }}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {subastaInfo && <CatalogoHeader subastaInfo={subastaInfo} articulosCount={articulos.length} />}

      <FlatList
        data={articulos}
        keyExtractor={item => item.id}
        renderItem={renderArticulo}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal orden */}
      <Modal visible={modalOrdenVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalOrdenVisible(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>ORDENAR POR</Text>
            {ordenes.map((ord) => (
              <TouchableOpacity
                key={ord.key}
                style={[styles.modalOpcion, ordenSeleccionado === ord.key && styles.modalOpcionActiva]}
                onPress={() => handleOrdenChange(ord.key)}
              >
                <Text style={[styles.modalOpcionTexto, ordenSeleccionado === ord.key && styles.modalOpcionTextoActiva]}>
                  {ord.label}
                </Text>
                {ordenSeleccionado === ord.key && <Ionicons name="checkmark" size={20} color="#000" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ======================================================
          MODAL DE PUJA
      ====================================================== */}
      <Modal visible={modalPujaVisible} transparent animationType="slide" onRequestClose={handleCerrarPuja}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.pujaModalWrapper}
        >
          <TouchableOpacity style={styles.pujaModalOverlay} activeOpacity={1} onPress={handleCerrarPuja} />

          <View style={styles.pujaModalContainer}>
            {/* Handle */}
            <View style={styles.pujaHandle} />

            {/* Cabecera del modal */}
            <View style={styles.pujaHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pujaLote}>
                  LOTE {articuloSeleccionado ? String(articuloSeleccionado.numero_lote).padStart(3, '0') : ''}
                </Text>
                <Text style={styles.pujaTitulo} numberOfLines={1}>
                  {articuloSeleccionado?.titulo}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCerrarPuja} style={styles.pujaCerrarBtn}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {cargandoPujas ? (
              <View style={styles.pujaCargando}>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.pujaCargandoTexto}>Cargando información...</Text>
              </View>
            ) : (
              <>
                {/* Oferta actual */}
                <View style={styles.pujaOfertaRow}>
                  <View>
                    <Text style={styles.pujaOfertaLabel}>OFERTA ACTUAL</Text>
                    <Text style={styles.pujaOfertaMonto}>
                      {estadoPujas ? formatearPrecio(estadoPujas.oferta_actual) : formatearPrecio(articuloSeleccionado?.precio_base ?? 0)}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.pujaOfertaLabel}>POSTORES</Text>
                    <Text style={styles.pujaPostores}>{estadoPujas?.total_participantes ?? 0}</Text>
                  </View>
                </View>

                {/* Estado de la subasta */}
                {estadoPujas && (
                  <View style={[
                    styles.pujaEstadoBadge,
                    estadoPujas.estado_subasta === 'ABIERTA' ? styles.pujaEstadoAbierta : styles.pujaEstadoCerrada
                  ]}>
                    <View style={[
                      styles.pujaEstadoDot,
                      { backgroundColor: estadoPujas.estado_subasta === 'ABIERTA' ? '#22C55E' : '#EF4444' }
                    ]} />
                    <Text style={styles.pujaEstadoTexto}>
                      {estadoPujas.estado_subasta === 'ABIERTA' ? 'Subasta abierta' : 'Subasta cerrada'}
                    </Text>
                  </View>
                )}

                {/* Historial de pujas (últimas 3) */}
                {estadoPujas && estadoPujas.historial_pujas.length > 0 && (
                  <View style={styles.historialContainer}>
                    <Text style={[styles.historialTitulo, { marginBottom: 10 }]}>ÚLTIMAS PUJAS</Text>
                    {estadoPujas.historial_pujas.slice(0, 3).map((puja, idx) => (
                      <View key={idx} style={styles.historialFila}>
                        <Text style={styles.historialPostor}>{puja.postor}</Text>
                        <Text style={styles.historialMonto}>{formatearPrecio(puja.monto)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.pujaSeparador} />

                {/* Feedback de puja exitosa */}
                {pujaExitosa && (
                  <View style={styles.pujaExitosaContainer}>
                    <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                    <Text style={styles.pujaExitosaTexto}>¡Puja registrada! Estás ganando.</Text>
                  </View>
                )}

                {/* Advertencia auto-puja */}
                {esAutoPuja && (
                  <View style={styles.autoPujaWarning}>
                    <Ionicons name="information-circle-outline" size={18} color="#D97706" />
                    <Text style={styles.autoPujaWarningTexto}>Tu última puja es la ganadora. Esperá a que te superen para volver a pujar.</Text>
                  </View>
                )}

                {/* Banner persistente: estás ganando */}
                {soyGanador && !esAutoPuja && (
                  <View style={styles.bannerGanadorPersistente}>
                    <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    <Text style={styles.bannerGanadorPersistenteTexto}>Tu puja es la más alta</Text>
                  </View>
                )}

                {/* Campo de monto */}
                {estadoPujas?.estado_subasta === 'ABIERTA' && (
                  <>
                    <Text style={styles.pujaInputLabel}>TU OFERTA</Text>
                    <View style={styles.pujaInputRow}>
                      <Text style={styles.pujaCurrencySign}>$</Text>
                      <TextInput
                        style={styles.pujaInput}
                        placeholder={`Mín. ${formatearPrecio(montoMinimo)}`}
                        placeholderTextColor="#999"
                        keyboardType="numeric"
                        value={montoPuja}
                        onChangeText={(text) => {
                          setMontoPuja(text);
                          setErrorPuja(null);
                          setPujaExitosa(false);
                        }}
                        editable={!enviandoPuja}
                      />
                    </View>

                    {errorPuja && (
                      <View style={styles.pujaErrorContainer}>
                        <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                        <Text style={styles.pujaErrorTexto}>{errorPuja}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.pujaConfirmarBtn, (enviandoPuja || esAutoPuja) && styles.pujaConfirmarBtnDisabled]}
                      onPress={handleConfirmarPuja}
                      disabled={enviandoPuja || esAutoPuja}
                    >
                      {enviandoPuja ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.pujaConfirmarBtnTexto}>CONFIRMAR PUJA</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {estadoPujas?.estado_subasta === 'CERRADA' && (
                  <View style={styles.pujaCerradaContainer}>
                    <Text style={styles.pujaCerradaTexto}>Esta subasta está cerrada. No se pueden registrar nuevas pujas.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F8F9FA' },
  headerBack: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', letterSpacing: 4, color: '#000' },
  headerAction: { width: 40, alignItems: 'flex-end' },
  busquedaBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  busquedaInput: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 8, gap: 24 },
  headerSection: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  estadoBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 12,
  },
  estadoBadgeTexto: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  headerTitulo: { fontSize: 24, fontWeight: '700', color: '#000', marginBottom: 10 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  headerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerMetaNum: { fontSize: 14, fontWeight: '700', color: '#000' },
  headerMetaLabel: { fontSize: 12, color: '#888', fontWeight: '500' },
  headerMetaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#CCC', marginHorizontal: 4 },
  card: { width: '100%', backgroundColor: '#F8F9FA' },
  imageContainer: { width: '100%', height: 220, backgroundColor: '#EAEAEA', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  cardImagen: { width: '100%', height: '100%' },
  badgeEnVivo: { position: 'absolute', top: 12, left: 12, backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 2 },
  badgeEnVivoTexto: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  cardBody: { paddingHorizontal: 4 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitleContainer: { flex: 1, paddingRight: 16 },
  loteNumero: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 1, marginBottom: 4 },
  cardTitulo: { fontSize: 16, fontWeight: '700', color: '#000' },
  favoritoBtn: { padding: 4 },
  divider: { height: 1, backgroundColor: '#EEEEEE', marginBottom: 16 },
  cardFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ofertaLabel: { fontSize: 10, color: '#999', fontWeight: '600', letterSpacing: 1, marginBottom: 4 },
  ofertaMonto: { fontSize: 18, fontWeight: '700', color: '#000' },
  pujarBtn: { backgroundColor: '#000', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16 },
  pujarBtnTexto: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  pujarBtnDisabled: { opacity: 0.5 },
  pujarBtnTextoDisabled: { color: '#fff' },
  // Modal orden
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '80%' },
  modalTitulo: { fontSize: 16, fontWeight: '700', letterSpacing: 2, marginBottom: 16, textAlign: 'center' },
  modalOpcion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalOpcionActiva: {},
  modalOpcionTexto: { fontSize: 15, color: '#666' },
  modalOpcionTextoActiva: { color: '#000', fontWeight: '600' },
  // Modal puja
  pujaModalWrapper: { flex: 1, justifyContent: 'flex-end' },
  pujaModalOverlay: { flex: 1 },
  pujaModalContainer: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12 },
  pujaHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  pujaHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
  pujaLote: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 1, marginBottom: 4 },
  pujaTitulo: { fontSize: 18, fontWeight: '700', color: '#000' },
  pujaCerrarBtn: { padding: 4, marginLeft: 12 },
  pujaCargando: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  pujaCargandoTexto: { color: '#999', fontSize: 14 },
  pujaOfertaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  pujaOfertaLabel: { fontSize: 10, fontWeight: '600', color: '#999', letterSpacing: 1, marginBottom: 4 },
  pujaOfertaMonto: { fontSize: 28, fontWeight: '700', color: '#000' },
  pujaPostores: { fontSize: 22, fontWeight: '700', color: '#000' },
  pujaEstadoBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginBottom: 16 },
  pujaEstadoAbierta: { backgroundColor: '#F0FDF4' },
  pujaEstadoCerrada: { backgroundColor: '#FEF2F2' },
  pujaEstadoDot: { width: 8, height: 8, borderRadius: 4 },
  pujaEstadoTexto: { fontSize: 13, fontWeight: '600', color: '#333' },
  historialContainer: { backgroundColor: '#F8F9FA', borderRadius: 12, padding: 14, marginBottom: 16 },
  historialTitulo: { fontSize: 10, fontWeight: '700', color: '#999', letterSpacing: 1 },
  historialFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#EEEEEE' },
  historialPostor: { fontSize: 14, color: '#555' },
  historialMonto: { fontSize: 14, fontWeight: '600', color: '#000' },
  pujaSeparador: { height: 1, backgroundColor: '#EEEEEE', marginBottom: 20 },
  pujaExitosaContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, marginBottom: 16 },
  autoPujaWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', padding: 12, borderRadius: 10, marginBottom: 16 },
  autoPujaWarningTexto: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '600' },
  bannerGanadorPersistente: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, marginBottom: 16 },
  bannerGanadorPersistenteTexto: { color: '#16A34A', fontSize: 14, fontWeight: '700' },
  pujaExitosaTexto: { color: '#16A34A', fontSize: 14, fontWeight: '600' },
  pujaInputLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 8 },
  pujaInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#000', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12 },
  pujaCurrencySign: { fontSize: 20, fontWeight: '700', color: '#000', marginRight: 8 },
  pujaInput: { flex: 1, fontSize: 22, fontWeight: '700', color: '#000', padding: 0 },
  pujaErrorContainer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  pujaErrorTexto: { color: '#EF4444', fontSize: 13, flex: 1 },
  pujaConfirmarBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  pujaConfirmarBtnDisabled: { backgroundColor: '#555' },
  pujaConfirmarBtnTexto: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  pujaCerradaContainer: { backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12 },
  pujaCerradaTexto: { color: '#DC2626', fontSize: 14, textAlign: 'center' },
});
