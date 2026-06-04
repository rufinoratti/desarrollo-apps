import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '@/src/config/env';

interface LiquidacionAdjudicacion {
  item_id: string;
  numero_lote: string;
  titulo: string;
  descripcion: string;
  imagen: string | null;
  subasta: {
    id: string;
    titulo: string | null;
    ubicacion: string | null;
    estado: string | null;
  } | null;
  precio_final: number;
  comision: number;
  comision_porcentaje: number;
  iva_sobre_comision: number;
  iva_porcentaje: number;
  total_a_pagar: number;
  estado_pago: string;
}

type MetodoEntrega = 'sucursal' | 'envio';

const formatearPrecio = (monto: number) =>
  `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(monto)}`;

export default function AdjudicacionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token, removeToken } = useAuth();
  const [datos, setDatos] = useState<LiquidacionAdjudicacion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [metodoEntrega, setMetodoEntrega] = useState<MetodoEntrega>('sucursal');

  const fetchLiquidacion = useCallback(async () => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${API_URL}/api/checkout/lotes/${id}/liquidacion`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        removeToken();
        return;
      }
      if (!res.ok) {
        setDatos(null);
        return;
      }
      const data: LiquidacionAdjudicacion = await res.json();
      setDatos(data);
    } catch {
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, [id, token, removeToken]);

  useEffect(() => {
    fetchLiquidacion();
  }, [fetchLiquidacion]);

  const handleConfirmarPago = () => {
    Alert.alert(
      'Próximamente',
      'El pago y la coordinación de entrega estarán disponibles en una próxima versión.',
      [{ text: 'Entendido' }]
    );
  };

  const ubicacionRetiro =
    datos?.subasta?.ubicacion || 'Buenos Aires, Recoleta (CABA)';

  if (cargando) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
      </SafeAreaView>
    );
  }

  if (!datos) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={22} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REMATIX</Text>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#CCC" />
          <Text style={styles.errorTitle}>No se pudo cargar la adjudicación</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>VOLVER</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={() => {}}>
          <Ionicons name="notifications-outline" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>ESTADO DE LA SUBASTA</Text>
        <Text style={styles.headline}>
          {`¡FELICITACIONES! HAS GANADO EL LOTE #${datos.numero_lote}`}
        </Text>

        <View style={styles.productCard}>
          {datos.imagen ? (
            <Image source={{ uri: datos.imagen }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Ionicons name="image-outline" size={40} color="#CCC" />
            </View>
          )}
          <Text style={styles.productTitle}>{datos.titulo}</Text>
          <Text style={styles.productDescription}>{datos.descripcion}</Text>
        </View>

        <Text style={styles.sectionLabel}>RESUMEN DE LIQUIDACIÓN</Text>
        <View style={styles.liquidacionBox}>
          <View style={styles.liquidacionRow}>
            <Text style={styles.liquidacionLabel}>Precio Final</Text>
            <Text style={styles.liquidacionValue}>{formatearPrecio(datos.precio_final)}</Text>
          </View>
          <View style={styles.liquidacionRow}>
            <Text style={styles.liquidacionLabel}>
              {`Comisiones (${datos.comision_porcentaje}%)`}
            </Text>
            <Text style={styles.liquidacionValue}>{formatearPrecio(datos.comision)}</Text>
          </View>
          <View style={styles.liquidacionRow}>
            <Text style={styles.liquidacionLabel}>
              {`IVA sobre comisiones (${Math.round(datos.iva_porcentaje)}%)`}
            </Text>
            <Text style={styles.liquidacionValue}>
              {formatearPrecio(datos.iva_sobre_comision)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValue}>{formatearPrecio(datos.total_a_pagar)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>MÉTODO DE ENTREGA</Text>

        <TouchableOpacity
          style={[styles.entregaCard, metodoEntrega === 'sucursal' && styles.entregaCardSelected]}
          activeOpacity={0.9}
          onPress={() => setMetodoEntrega('sucursal')}
        >
          <View style={styles.entregaRadio}>
            {metodoEntrega === 'sucursal' && <View style={styles.entregaRadioInner} />}
          </View>
          <View style={styles.entregaIconBox}>
            <Ionicons name="storefront-outline" size={20} color="#000" />
          </View>
          <View style={styles.entregaBody}>
            <Text style={styles.entregaTitle}>Retiro en Sucursal</Text>
            <Text style={styles.entregaSubtitle}>{ubicacionRetiro}</Text>
            <Text style={styles.entregaFooter}>SIN CARGO ADICIONAL</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.entregaCard, metodoEntrega === 'envio' && styles.entregaCardSelected]}
          activeOpacity={0.9}
          onPress={() => setMetodoEntrega('envio')}
        >
          <View style={styles.entregaRadio}>
            {metodoEntrega === 'envio' && <View style={styles.entregaRadioInner} />}
          </View>
          <View style={styles.entregaIconBox}>
            <Ionicons name="car-outline" size={20} color="#000" />
          </View>
          <View style={styles.entregaBody}>
            <Text style={styles.entregaTitle}>Envío Asegurado</Text>
            <Text style={styles.entregaSubtitle}>Logística especializada de lujo</Text>
            <Text style={styles.entregaFooter}>A COTIZAR POST-PAGO</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.ctaButton} activeOpacity={0.9} onPress={handleConfirmarPago}>
          <Text style={styles.ctaButtonText}>CONFIRMAR Y PROCEDER AL PAGO</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: { width: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#000',
  },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 8,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000',
    lineHeight: 28,
    marginBottom: 20,
  },
  productCard: {
    backgroundColor: '#EFEFEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  productImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#FFF',
    marginBottom: 14,
  },
  productImagePlaceholder: { justifyContent: 'center', alignItems: 'center' },
  productTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  liquidacionBox: { marginBottom: 24 },
  liquidacionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  liquidacionLabel: { fontSize: 14, color: '#333' },
  liquidacionValue: { fontSize: 14, fontWeight: '600', color: '#000' },
  divider: { height: 1.5, backgroundColor: '#000', marginVertical: 12 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#000',
  },
  entregaCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  entregaCardSelected: {
    backgroundColor: '#FFF',
    borderColor: '#000',
    borderWidth: 1.5,
  },
  entregaRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  entregaRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  entregaIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entregaBody: { flex: 1 },
  entregaTitle: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 2 },
  entregaSubtitle: { fontSize: 12, color: '#666', marginBottom: 6 },
  entregaFooter: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  ctaButton: {
    backgroundColor: '#000',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginTop: 16,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: '#000',
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  retryBtnText: { fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 1 },
});
