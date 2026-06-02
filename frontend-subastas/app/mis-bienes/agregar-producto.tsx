import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { API_URL } from '@/src/config/env';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import { Button } from '@/src/components/Button';

interface OpcionItem {
  id: number;
  nombre: string;
}

export default function AgregarProductoScreen() {
  const { token, removeToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [revisores, setRevisores] = useState<OpcionItem[]>([]);
  const [seguros, setSeguros] = useState<OpcionItem[]>([]);

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioSugerido, setPrecioSugerido] = useState('');

  const [revisorId, setRevisorId] = useState<number | null>(null);
  const [revisorLabel, setRevisorLabel] = useState('');
  const [seguroId, setSeguroId] = useState<number | null>(null);
  const [seguroLabel, setSeguroLabel] = useState('');

  const [imagenes, setImagenes] = useState<{ uri: string; name: string; type: string }[]>([]);

  const fetchOpciones = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/mis-bienes/opciones`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        await removeToken();
        return;
      }
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setRevisores(data.revisores || []);
      setSeguros(data.seguros || []);
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, [token, removeToken]);

  useEffect(() => {
    fetchOpciones();
  }, [fetchOpciones]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: true,
    });

    if (result.canceled || !result.assets?.length) return;

    const nuevos = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: `producto-${Date.now()}-${index}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    }));

    setImagenes((prev) => [...prev, ...nuevos].slice(0, 6));
  };

  const handleRemoveImage = (idx: number) => {
    setImagenes((prev) => prev.filter((_, i) => i !== idx));
  };

  const canSubmit = useMemo(() => {
    return (
      nombre.trim() &&
      descripcion.trim() &&
      precioSugerido.trim() &&
      revisorId &&
      imagenes.length > 0
    );
  }, [nombre, descripcion, precioSugerido, revisorId, imagenes]);

  const handleSubmit = async () => {
    if (!token) return;
    if (!canSubmit) {
      Alert.alert('Faltan datos', 'Completá todos los campos obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('descripcioncatalogo', nombre.trim());
      formData.append('descripcioncompleta', descripcion.trim());
      formData.append('preciosugerido', precioSugerido.trim());
      formData.append('revisor', String(revisorId));
      formData.append('seguro', seguroId ? String(seguroId) : '');

      imagenes.forEach((img) => {
        formData.append('fotos', img as any);
      });

      const res = await fetch(`${API_URL}/api/mis-bienes/productos`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.status === 401) {
        await removeToken();
        return;
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'No se pudo crear el producto');
      }

      Alert.alert('Producto enviado', 'Tu artículo quedó en revisión.');
      router.replace('/mis-bienes');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No se pudo crear el producto');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AGREGAR PRODUCTO</Text>
        <View style={styles.headerBack} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fotos del producto</Text>
          <View style={styles.imageGrid}>
            {imagenes.map((img, idx) => (
              <View key={`${img.uri}-${idx}`} style={styles.imageBox}>
                <Image source={{ uri: img.uri }} style={styles.image} />
                <TouchableOpacity style={styles.imageRemove} onPress={() => handleRemoveImage(idx)}>
                  <Ionicons name="close" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
            {imagenes.length < 6 && (
              <TouchableOpacity style={styles.imageAdd} onPress={handlePickImage}>
                <Ionicons name="add" size={24} color="#666" />
                <Text style={styles.imageAddText}>Agregar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Datos del producto</Text>
          <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Ej: Reloj Suizo" />
          <Input
            label="Descripción completa"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Detalles del producto"
            multiline
          />
          <Input
            label="Precio sugerido"
            value={precioSugerido}
            onChangeText={setPrecioSugerido}
            placeholder="Ej: 150000"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Asignaciones</Text>
          <Select
            label="Revisor"
            value={revisorLabel}
            options={revisores}
            placeholder="Seleccionar revisor"
            onSelect={(id, label) => {
              setRevisorId(id);
              setRevisorLabel(label);
            }}
          />
          <Select
            label="Seguro"
            value={seguroLabel}
            options={seguros}
            placeholder="Sin seguro"
            onSelect={(id, label) => {
              setSeguroId(id);
              setSeguroLabel(label);
            }}
          />
        </View>

        <Button title="PUBLICAR PRODUCTO" onPress={handleSubmit} loading={saving} />
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerBack: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  scroll: { flex: 1, paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#111', marginBottom: 12, letterSpacing: 1 },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageBox: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  imageRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAdd: {
    width: 90,
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageAddText: { marginTop: 4, fontSize: 10, color: '#666' },
});
