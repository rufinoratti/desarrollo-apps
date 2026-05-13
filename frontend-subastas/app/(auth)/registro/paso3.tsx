import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { useRegistration } from '@/src/context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '@/src/config/env';

const ImageCard = ({ title, image, onPick }: any) => (
  <View style={styles.cardContainer}>
    <Text style={styles.cardTitle}>{title.toUpperCase()}</Text>
    <TouchableOpacity style={styles.cardButton} onPress={onPick}>
      {image ? (
        <Ionicons name="checkmark-circle" size={40} color="#000" />
      ) : (
        <Ionicons name="camera-outline" size={40} color="#000" />
      )}
      <Text style={styles.cardSubtitle}>
        {image ? "IMAGEN CARGADA" : `CAPTURAR ${title.split(' ')[0]}`}
      </Text>
    </TouchableOpacity>
  </View>
);

export default function Paso3() {
  const { registrationData } = useRegistration();
  const [frente, setFrente] = useState<any>(null);
  const [dorso, setDorso] = useState<any>(null);
  const [fotoPerfil, setFotoPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter: any) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para capturar tu DNI.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
    });

    if (!result.canceled) {
      setter(result.assets[0]);
    }
  };

  const pickProfilePhoto = () => {
    const options: any[] = [
      {
        text: 'CÁMARA',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.5,
          });
          if (!result.canceled) setFotoPerfil(result.assets[0]);
        },
      },
      {
        text: 'GALERÍA',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.5,
          });
          if (!result.canceled) setFotoPerfil(result.assets[0]);
        },
      },
    ];
    if (fotoPerfil) {
      options.push({ text: 'ELIMINAR FOTO', onPress: () => setFotoPerfil(null), style: 'destructive' });
    }
    options.push({ text: 'CANCELAR', style: 'cancel' });
    Alert.alert('Foto de perfil', 'Elige una opción', options);
  };

  const handleSubmit = async () => {
    if (!frente || !dorso) {
      Alert.alert('Incompleto', 'Debes capturar frente y dorso de tu DNI.');
      return;
    }

    if (!registrationData.registro_id) {
      Alert.alert('Error', 'Falta el ID de registro.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('registro_id', registrationData.registro_id.toString());
      formData.append('dni_frente', {
        uri: frente.uri,
        name: 'frente.jpg',
        type: 'image/jpeg',
      } as any);
      formData.append('dni_dorso', {
        uri: dorso.uri,
        name: 'dorso.jpg',
        type: 'image/jpeg',
      } as any);
      if (fotoPerfil) {
        formData.append('foto_perfil', {
          uri: fotoPerfil.uri,
          name: 'perfil.jpg',
          type: 'image/jpeg',
        } as any);
      }

      const response = await fetch(`${API_URL}/api/auth/registro/paso3`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 413) {
        Alert.alert('Error', 'Las imágenes son muy pesadas. Intenta tomar una foto con menor resolución.');
      } else if (response.status === 200) {
        Alert.alert('Éxito', data.mensaje);
        router.push('/(auth)/registro/paso4-pago');
      } else {
        Alert.alert('Error', data.error || 'Ocurrió un error inesperado');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error de conexión durante la subida de imágenes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.logo}>REMATIX</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>PASO 3 DE 3</Text>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: '100%' }]} />
          </View>
        </View>

        <Text style={styles.title}>Validación de Identidad</Text>
        <Text style={styles.subtitle}>
          Capture su documento en un ambiente iluminado para evitar reflejos.
        </Text>

        <ImageCard title="FRENTE DEL DNI" image={frente} onPick={() => pickImage(setFrente)} />
        <ImageCard title="DORSO DEL DNI" image={dorso} onPick={() => pickImage(setDorso)} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>FOTO DE PERFIL (OPCIONAL)</Text>
        <Text style={styles.subtitle}>
          Elige una foto para tu perfil. Puedes saltar este paso y agregarla después.
        </Text>
        <TouchableOpacity style={styles.profilePhotoButton} onPress={pickProfilePhoto}>
          {fotoPerfil ? (
            <View style={styles.profilePhotoPreview}>
              <Ionicons name="checkmark-circle" size={40} color="#000" />
              <Text style={styles.cardSubtitle}>FOTO CARGADA</Text>
            </View>
          ) : (
            <View style={styles.profilePhotoPlaceholder}>
              <Ionicons name="person-add-outline" size={48} color="#999" />
              <Text style={styles.profilePhotoText}>AGREGAR FOTO</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.spacer} />

        {loading && <ActivityIndicator style={{ marginBottom: 10 }} color="#000" />}

        <Button 
          title={loading ? "PROCESANDO IMÁGENES..." : "SIGUIENTE ➔"}
          onPress={handleSubmit}
          loading={loading}
        />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  scroll: { padding: 30, paddingTop: 20, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  backButton: { padding: 5 },
  logo: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  progressContainer: { marginBottom: 20 },
  progressText: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 10 },
  progressBarBackground: { height: 2, backgroundColor: '#EEE', width: '100%' },
  progressBarFill: { height: 2, backgroundColor: '#000' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 30, lineHeight: 20 },
  cardContainer: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 20, marginBottom: 20 },
  cardTitle: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 20 },
  cardButton: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  cardSubtitle: { fontSize: 12, fontWeight: 'bold', color: '#000', marginTop: 15, letterSpacing: 1 },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 10, marginTop: 10 },
  profilePhotoButton: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 20, marginBottom: 20, alignItems: 'center' },
  profilePhotoPreview: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  profilePhotoPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
  profilePhotoText: { fontSize: 12, fontWeight: 'bold', color: '#999', marginTop: 10, letterSpacing: 1 },
  spacer: { flex: 1, minHeight: 20 },
});
