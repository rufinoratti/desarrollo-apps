import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function SplashScreen() {
  const { token, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/onboarding');
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [token, isLoading]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Text style={styles.title}>REMATIX</Text>
        <View style={styles.separator} />
        <Text style={styles.subtitle}>EXCELENCIA EN SUBASTAS</Text>
      </Animated.View>
      
      <View style={styles.footerLinesContainer}>
        <View style={styles.line1} />
        <View style={styles.line2} />
        <View style={styles.line3} />
        <Text style={styles.footerText}>BUENOS AIRES • EST. 2020</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontSize: 42,
    fontWeight: '300',
    letterSpacing: 8,
    marginBottom: 20,
  },
  separator: {
    height: 1,
    width: '100%',
    backgroundColor: '#333',
    marginBottom: 15,
  },
  subtitle: {
    color: '#888',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  footerLinesContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    paddingHorizontal: 40,
  },
  line1: {
    height: 1,
    backgroundColor: '#333',
    width: '100%',
    marginBottom: 20,
  },
  line2: {
    height: 1,
    backgroundColor: '#333',
    width: '50%',
    marginBottom: 20,
    alignSelf: 'center',
  },
  line3: {
    height: 1,
    backgroundColor: '#555',
    width: '80%',
    marginBottom: 30,
  },
  footerText: {
    color: '#555',
    fontSize: 8,
    letterSpacing: 2,
    textAlign: 'center',
  }
});
