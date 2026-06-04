import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToastData } from '@/src/hooks/useToast';

interface Props {
  toast: ToastData | null;
  onDismiss?: () => void;
  onActionPress?: () => void;
}

const COLOR_POR_TIPO: Record<string, { bg: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string }> = {
  OUTBID: { bg: '#D32F2F', icon: 'alert-circle', iconColor: '#FFFFFF' },
  INFO: { bg: '#1A1A1A', icon: 'information-circle', iconColor: '#FFFFFF' },
  SUCCESS: { bg: '#2E7D32', icon: 'checkmark-circle', iconColor: '#FFFFFF' },
};

export default function ToastOutbid({ toast, onDismiss, onActionPress }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 9, tension: 80 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [toast, translateY, opacity]);

  if (!toast) return null;

  const config = COLOR_POR_TIPO[toast.tipo] || COLOR_POR_TIPO.INFO;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: config.bg }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onDismiss}
          style={styles.toastBody}
        >
          <Ionicons name={config.icon} size={24} color={config.iconColor} />
          <View style={styles.textos}>
            <Text style={styles.titulo} numberOfLines={1}>{toast.titulo}</Text>
            {!!toast.mensaje && (
              <Text style={styles.mensaje} numberOfLines={2}>{toast.mensaje}</Text>
            )}
          </View>
        </TouchableOpacity>
        {toast.tipo === 'OUTBID' && onActionPress && (
          <TouchableOpacity style={styles.toastAction} onPress={onActionPress} activeOpacity={0.8}>
            <Text style={styles.toastActionTexto}>OFERTAR</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  toastBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  toastAction: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.25)',
  },
  toastActionTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  textos: {
    flex: 1,
  },
  titulo: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mensaje: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.9,
  },
});
