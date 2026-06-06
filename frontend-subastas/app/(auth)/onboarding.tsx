import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    id: 1,
    title: 'Descubrí subastas en tiempo real',
    subtitle: 'Encontrá productos únicos y pujas en segundos',
    image: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Tel%C3%A9fono_Antiguo.jpg', // Teléfono antiguo
  },
  {
    id: 2,
    title: 'Pujar es fácil',
    subtitle: 'Elegí un producto, hacé tu oferta y seguí la subasta en vivo',
    image: 'https://m.media-amazon.com/images/I/61sKw8b3S9L._AC_UF894,1000_QL80_.jpg', // Mona Lisa simulación
  },
  {
    id: 3,
    title: 'Empeza a pujar ahora',
    subtitle: 'Creá tu cuenta y participá en minutos',
    image: 'https://png.pngtree.com/png-clipart/20250609/original/pngtree-classic-vintage-camera-png-image_21143451.png', // Cámara vintage
  }
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      // Animate transition
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentIndex(currentIndex + 1);
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  };

  const handleCreateAccount = () => {
    router.replace('/registro/paso1');
  };

  const handleLogin = () => {
    router.replace('/login');
  };

  const currentSlide = ONBOARDING_DATA[currentIndex];

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* Image Container */}
        <Animated.View style={[styles.imageContainer, { opacity: slideAnim }]}>
          <Image 
            source={{ uri: currentSlide.image }} 
            style={styles.image} 
            resizeMode="cover"
          />
        </Animated.View>

        {/* Text Container */}
        <Animated.View style={[styles.textContainer, { opacity: slideAnim }]}>
          <Text style={styles.title}>{currentSlide.title}</Text>
          <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
        </Animated.View>

        {/* Footer (Dots + Button) */}
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
            <TouchableOpacity style={styles.createAccountButton} onPress={handleCreateAccount}>
              <Text style={styles.createAccountText}>Crear cuenta  ›</Text>
            </TouchableOpacity>
          )}

        </View>

        {/* Login Link for convenience */}
        {currentIndex === ONBOARDING_DATA.length - 1 && (
          <TouchableOpacity onPress={handleLogin} style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>¿Ya tienes cuenta? Iniciar Sesión</Text>
          </TouchableOpacity>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    padding: 30,
    justifyContent: 'space-between',
  },
  imageContainer: {
    flex: 0.55,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  textContainer: {
    flex: 0.25,
    justifyContent: 'center',
  },
  title: {
    fontSize: 35,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 20,
    color: '#888',
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    height: 60,
  },
  dotsContainer: {
    flexDirection: 'row',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginRight: 6,
  },
  dotActive: {
    backgroundColor: '#000',
    width: 16,
  },
  nextButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createAccountButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 30,
  },
  createAccountText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginLinkContainer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold',
  }
});
