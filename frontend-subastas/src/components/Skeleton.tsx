import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleSheet, ActivityIndicator, Text } from 'react-native';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
};

export function Skeleton({ width = '100%', height = 14, borderRadius = 4, style }: SkeletonProps) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#E0E0E0', opacity: anim },
        style as ViewStyle,
      ]}
    />
  );
}

export function SkeletonLine({ width = '100%', height = 14, borderRadius = 4, style }: SkeletonProps) {
  return <Skeleton width={width} height={height} borderRadius={borderRadius} style={style} />;
}

export function SkeletonCircle({ size = 60, style }: { size?: number; style?: ViewStyle | ViewStyle[] }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonCard({ style }: { style?: ViewStyle | ViewStyle[] }) {
  return (
    <View style={[styles.card, style as ViewStyle]}>
      <Skeleton width={44} height={44} borderRadius={22} />
      <View style={styles.cardBody}>
        <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={11} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 3, gap = 12, style }: { rows?: number; gap?: number; style?: ViewStyle | ViewStyle[] }) {
  return (
    <View style={[{ gap }, style as ViewStyle]}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function ScreenLoading({ text = 'Cargando...' }: { text?: string }) {
  return (
    <View style={styles.screenLoading}>
      <ActivityIndicator size="large" color="#000" />
      {text ? <Text style={styles.screenLoadingText}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderRadius: 14,
    padding: 16,
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
  },
  screenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  screenLoadingText: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
});
