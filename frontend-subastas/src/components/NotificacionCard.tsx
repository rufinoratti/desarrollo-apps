import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type NotificacionTipo = 'GANADA' | 'GANANDO' | 'SUPERADA' | 'CIERRE_INMINENTE' | 'SUBASTA_INICIADA';

export interface Notificacion {
  id: string;
  tipo: NotificacionTipo;
  titulo: string;
  descripcion: string;
  timestamp: string;
  lote?: string;
  itemId?: string;
  subastaId?: string;
  imagen?: string;
  monto?: number;
  _seq?: number;
}

interface Props {
  notificacion: Notificacion;
  onPress?: () => void;
  onActionPress?: () => void;
}

const ICONO_POR_TIPO: Record<NotificacionTipo, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  GANADA: { name: 'trophy', color: '#DAA520', bg: '#FFF8E1' },
  GANANDO: { name: 'checkmark-circle', color: '#16A34A', bg: '#F0FDF4' },
  SUPERADA: { name: 'trending-up', color: '#FFFFFF', bg: '#1A1A1A' },
  CIERRE_INMINENTE: { name: 'time-outline', color: '#666666', bg: '#F0F0F0' },
  SUBASTA_INICIADA: { name: 'sparkles', color: '#FFFFFF', bg: '#1A1A1A' },
};

const ES_ICONO_CLARO: Record<NotificacionTipo, boolean> = {
  GANADA: false,
  GANANDO: false,
  SUPERADA: true,
  CIERRE_INMINENTE: false,
  SUBASTA_INICIADA: true,
};

const TEXTO_BOTON_POR_TIPO: Record<NotificacionTipo, string | null> = {
  GANADA: null,
  GANANDO: null,
  SUPERADA: 'OFERTAR AHORA',
  CIERRE_INMINENTE: null,
  SUBASTA_INICIADA: 'VER LOTES',
};

function formatearHoraLabel(timestamp: string): string {
  const fecha = new Date(timestamp);
  const ahora = new Date();
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);

  if (diffMin < 1) return 'AHORA';
  if (diffMin < 60) return `HACE ${diffMin} MIN`;
  if (diffHoras < 24) {
    const horas = fecha.getHours().toString().padStart(2, '0');
    const min = fecha.getMinutes().toString().padStart(2, '0');
    return `${horas}:${min}`;
  }
  return 'AYER';
}

export default function NotificacionCard({ notificacion, onPress, onActionPress }: Props) {
  const esGanada = notificacion.tipo === 'GANADA';
  const esOscuro = ES_ICONO_CLARO[notificacion.tipo];
  const icono = ICONO_POR_TIPO[notificacion.tipo];
  const textoBoton = TEXTO_BOTON_POR_TIPO[notificacion.tipo];

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 60 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const containerStyle = esOscuro ? styles.cardOscuro : styles.cardClaro;
  const tituloStyle = esOscuro ? styles.tituloOscuro : styles.tituloClaro;
  const descStyle = esOscuro ? styles.descOscuro : styles.descClaro;
  const loteStyle = esOscuro ? styles.loteOscuro : styles.loteClaro;
  const horaStyle = esOscuro ? styles.horaOscuro : styles.horaClaro;
  const botonStyle = esOscuro ? styles.botonOscuro : styles.botonClaro;
  const botonTextoStyle = esOscuro ? styles.botonTextoOscuro : styles.botonTextoClaro;

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
      ]}
    >
      <TouchableOpacity
        style={[styles.card, containerStyle, esGanada && styles.cardGanada]}
        activeOpacity={0.85}
        onPress={onPress}
      >
        {esGanada && notificacion.imagen ? (
          <Image
            source={{ uri: notificacion.imagen }}
            style={styles.ganadaImagen}
          />
        ) : (
          <View style={[styles.iconoContenedor, { backgroundColor: icono.bg }]}>
            <Ionicons name={icono.name} size={22} color={icono.color} />
          </View>
        )}

        <View style={styles.contenido}>
          <View style={styles.headerRow}>
            <Text style={[styles.titulo, tituloStyle]} numberOfLines={1}>
              {notificacion.titulo}
            </Text>
            <Text style={[styles.hora, horaStyle]}>{formatearHoraLabel(notificacion.timestamp)}</Text>
          </View>

          {notificacion.lote && (
            <Text style={[styles.lote, loteStyle]}>{notificacion.lote}</Text>
          )}

          <Text style={[styles.descripcion, descStyle]} numberOfLines={3}>
            {notificacion.descripcion}
          </Text>

          {textoBoton && (
            <TouchableOpacity
              style={[styles.boton, botonStyle]}
              onPress={(e) => {
                e.stopPropagation?.();
                onActionPress?.();
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.botonTexto, botonTextoStyle]}>{textoBoton}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  cardClaro: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  cardOscuro: {
    backgroundColor: '#1A1A1A',
  },
  cardGanada: {
    borderWidth: 1.5,
    borderColor: '#DAA520',
    backgroundColor: '#FFFDF5',
  },
  ganadaImagen: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    flexShrink: 0,
  },
  iconoContenedor: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  contenido: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titulo: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tituloClaro: { color: '#000000' },
  tituloOscuro: { color: '#FFFFFF' },
  hora: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  horaClaro: { color: '#999999' },
  horaOscuro: { color: '#999999' },
  lote: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  loteClaro: { color: '#000000' },
  loteOscuro: { color: '#FFFFFF' },
  descripcion: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  descClaro: { color: '#666666' },
  descOscuro: { color: '#CCCCCC' },
  boton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
  },
  botonClaro: {
    backgroundColor: 'transparent',
    borderColor: '#000000',
  },
  botonOscuro: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
  },
  botonTexto: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  botonTextoClaro: { color: '#000000' },
  botonTextoOscuro: { color: '#FFFFFF' },
});
