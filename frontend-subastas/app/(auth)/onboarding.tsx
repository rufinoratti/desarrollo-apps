import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const ONBOARDING_DATA = [
  {
    id: 1,
    title: 'Descubrí subastas\nen tiempo real',
    subtitle: 'Encontrá productos únicos y pujás en segundos',
    image: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Tel%C3%A9fono_Antiguo.jpg',
  },
  {
    id: 2,
    title: 'Pujar es fácil',
    subtitle: 'Elegí un producto, hacé tu oferta y seguí la subasta en vivo',
    image: 'https://m.media-amazon.com/images/I/61sKw8b3S9L._AC_UF894,1000_QL80_.jpg',
  },
  {
    id: 3,
    title: 'Empezá a pujar ahora',
    subtitle: 'Creá tu cuenta y participá en minutos',
    image: 'https://png.pngtree.com/png-clipart/20250609/original/pngtree-classic-vintage-camera-png-image_21143451.png',
  }
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prefetchImages = async () => {
      try {
        await Promise.all(ONBOARDING_DATA.map((item) => Image.prefetch(item.image)));
      } catch {
        // Ignore prefetch failures and still show slides.
      }
    };

    prefetchImages();
  }, []);

  useEffect(() => {
    slideAnim.setValue(0);
  }, [currentIndex, slideAnim]);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/login');
  };

  const currentSlide = ONBOARDING_DATA[currentIndex];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Animated.View style={[styles.imageContainer, { opacity: slideAnim }]}> 
          <Image 
            key={`onboarding-image-${currentIndex}`}
            source={{ uri: currentSlide.image }} 
            style={styles.image} 
            resizeMode="contain"
            onLoad={() => {
              Animated.timing(slideAnim, {
                toValue: 1,
                duration: 220,
                useNativeDriver: true,
              }).start();
            }}
          />
        </Animated.View>

        <Animated.View style={[styles.textContainer, { opacity: slideAnim }]}> 
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.dotsContainer}>
            {ONBOARDING_DATA.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.dot, 
                  currentIndex === index && styles.dotActive
                ]} 
              />
            ))}
          </View>

          {currentIndex < ONBOARDING_DATA.length - 1 ? (
            <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
              <Ionicons name="chevron-forward" size={24} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.createAccountButton} onPress={() => router.replace('/registro/paso1')}>
              <Text style={styles.createAccountText}>Crear cuenta</Text>
            </TouchableOpacity>
          )}
        </View>

        {currentIndex === ONBOARDING_DATA.length - 1 && (
          <TouchableOpacity onPress={handleGoToLogin} style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>¿Ya tenés cuenta? Iniciar sesión</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
  },
  skipButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '700',
  },
  imageContainer: {
    width: '100%',
    height: 440,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F9F9F9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 0.28,
    justifyContent: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 16,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#000',
    width: 20,
  },
  nextButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 32,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#000',
  },
  primaryButton: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  primaryText: {
    color: '#FFF',
  },
  arrowIcon: {
    marginLeft: 8,
  },
  loginLinkContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },
});
