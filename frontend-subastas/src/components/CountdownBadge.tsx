import { View, Text, StyleSheet } from 'react-native';
import { useCountdown } from '@/src/hooks/useCountdown';

interface Props {
  fechaInicio?: string | null;
  fechaFin?: string | null;
  duracionDefectoSegundos?: number;
}

export default function CountdownBadge({ fechaInicio, fechaFin, duracionDefectoSegundos }: Props) {
  const { estado, tiempoTexto } = useCountdown(fechaInicio, fechaFin, duracionDefectoSegundos);

  if (!tiempoTexto || !estado || estado === 'FINALIZADA') return null;

  const label = estado === 'PROXIMAMENTE' ? 'COMIENZA EN' : 'RESTAN';

  return (
    <View style={styles.badge}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.tiempo}>{tiempoTexto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(230, 230, 230, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    minWidth: 90,
  },
  label: {
    fontSize: 9,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
    letterSpacing: 1,
  },
  tiempo: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    textAlign: 'center',
  },
});
