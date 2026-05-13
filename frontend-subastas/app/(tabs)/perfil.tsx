import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/Button';
import { API_URL } from '@/src/config/env';

interface PerfilData {
  usuario: {
    id: string;
    nombre_completo: string;
    email: string;
    nivel: string;
    foto_url: string | null;
  };
  datos_personales: {
    documento: string;
    telefono: string;
    direccion: string;
    pais_residencia: string;
  };
  cuenta_cobro: {
    cbu_alias: string;
    banco: string;
  } | null;
}

interface RestriccionesData {
  restriccion_activa: boolean;
  restriccion: {
    motivo: string;
    lote_adeudado: string;
    monto_original: number;
    monto_multa: number;
    total_a_regularizar: number;
    fecha_limite_legal: string;
  } | null;
}

export default function Perfil() {
  const { token, nombre, saveToken, removeToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [restricciones, setRestricciones] = useState<RestriccionesData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  const fetchPerfil = useCallback(async () => {
    if (!token) return;
    try {
      const [perfilRes, restRes] = await Promise.all([
        fetch(`${API_URL}/api/perfil`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/perfil/restricciones`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (perfilRes.status === 401) {
        await removeToken();
        return;
      }
      const raw = await perfilRes.json();
      const restData = await restRes.json();
      const perfilData: PerfilData = {
        usuario: {
          id: raw.usuario_id ?? '',
          nombre_completo: raw.nombre_completo ?? '',
          email: raw.datos_personales?.email ?? '',
          nivel: raw.categoria ?? '',
          foto_url: raw.foto_url ?? null,
        },
        datos_personales: {
          documento: raw.datos_personales?.documento ?? '',
          telefono: raw.datos_personales?.telefono ?? '',
          direccion: raw.datos_personales?.direccion ?? '',
          pais_residencia: raw.datos_personales?.pais_residencia ?? '',
        },
        cuenta_cobro: raw.cuenta_cobro
          ? {
              cbu_alias: raw.cuenta_cobro.numero_cbu ?? '',
              banco: raw.cuenta_cobro.entidad_bancaria ?? '',
            }
          : null,
      };
      setPerfil(perfilData);
      setRestricciones(restData);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  }, [token, removeToken]);

  useEffect(() => {
    fetchPerfil();
  }, [fetchPerfil]);

  const handleStartEdit = () => {
    if (!perfil) return;
    setEditNombre(perfil.usuario.nombre_completo);
    setEditTelefono(perfil.datos_personales.telefono);
    setEditDireccion(perfil.datos_personales.direccion);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!token || !perfil) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/perfil`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nombre_completo: editNombre,
          telefono: editTelefono,
          direccion: editDireccion,
        }),
      });
      if (res.status === 401) {
        await removeToken();
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al actualizar');
      }
      const data = await res.json();
      const updatedPerfil: PerfilData = {
        usuario: {
          id: data.usuario_id ?? '',
          nombre_completo: data.nombre_completo ?? '',
          email: data.datos_personales?.email ?? '',
          nivel: data.categoria ?? '',
          foto_url: data.foto_url ?? null,
        },
        datos_personales: {
          documento: data.datos_personales?.documento ?? '',
          telefono: data.datos_personales?.telefono ?? '',
          direccion: data.datos_personales?.direccion ?? '',
          pais_residencia: data.datos_personales?.pais_residencia ?? '',
        },
        cuenta_cobro: data.cuenta_cobro
          ? { cbu_alias: data.cuenta_cobro.numero_cbu ?? '', banco: data.cuenta_cobro.entidad_bancaria ?? '' }
          : perfil.cuenta_cobro,
      };
      setPerfil(updatedPerfil);
      if (editNombre !== nombre) {
        await saveToken(token, editNombre);
      }
      setEditing(false);
      Alert.alert('Éxito', 'Datos actualizados correctamente');
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhotoFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0].uri);
  };

  const handlePickPhotoFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets?.[0]) return;
    await uploadPhoto(result.assets[0].uri);
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingFoto(true);
    try {
      const formData = new FormData();
      formData.append('foto', {
        uri,
        name: 'perfil.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await fetch(`${API_URL}/api/perfil/foto`, {
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
        throw new Error(errData.error || 'Error al subir la foto');
      }

      const data = await res.json();
      const updatedPerfil: PerfilData = {
        usuario: {
          id: data.usuario_id ?? '',
          nombre_completo: data.nombre_completo ?? '',
          email: data.datos_personales?.email ?? '',
          nivel: data.categoria ?? '',
          foto_url: data.foto_url ?? null,
        },
        datos_personales: {
          documento: data.datos_personales?.documento ?? '',
          telefono: data.datos_personales?.telefono ?? '',
          direccion: data.datos_personales?.direccion ?? '',
          pais_residencia: data.datos_personales?.pais_residencia ?? '',
        },
        cuenta_cobro: data.cuenta_cobro
          ? { cbu_alias: data.cuenta_cobro.numero_cbu ?? '', banco: data.cuenta_cobro.entidad_bancaria ?? '' }
          : perfil?.cuenta_cobro ?? null,
      };
      setPerfil(updatedPerfil);
    } catch {
      Alert.alert('Error', 'No se pudo subir la foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!token) return;
    setUploadingFoto(true);
    try {
      const res = await fetch(`${API_URL}/api/perfil/foto`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        await removeToken();
        return;
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al eliminar la foto');
      }

      const data = await res.json();
      const updatedPerfil: PerfilData = {
        usuario: {
          id: data.usuario_id ?? '',
          nombre_completo: data.nombre_completo ?? '',
          email: data.datos_personales?.email ?? '',
          nivel: data.categoria ?? '',
          foto_url: null,
        },
        datos_personales: {
          documento: data.datos_personales?.documento ?? '',
          telefono: data.datos_personales?.telefono ?? '',
          direccion: data.datos_personales?.direccion ?? '',
          pais_residencia: data.datos_personales?.pais_residencia ?? '',
        },
        cuenta_cobro: data.cuenta_cobro
          ? { cbu_alias: data.cuenta_cobro.numero_cbu ?? '', banco: data.cuenta_cobro.entidad_bancaria ?? '' }
          : perfil?.cuenta_cobro ?? null,
      };
      setPerfil(updatedPerfil);
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handlePickPhoto = () => {
    const options = [
      { text: 'CÁMARA', onPress: handlePickPhotoFromCamera },
      { text: 'GALERÍA', onPress: handlePickPhotoFromGallery },
    ];
    if (perfil?.usuario?.foto_url) {
      options.push({ text: 'ELIMINAR FOTO', onPress: handleDeletePhoto, style: 'destructive' as const });
    }
    options.push({ text: 'CANCELAR', style: 'cancel' as const });
    Alert.alert('Foto de perfil', 'Elige una opción', options);
  };

  const handleCopyCBU = async () => {
    if (!perfil?.cuenta_cobro) return;
    await Clipboard.setStringAsync(perfil.cuenta_cobro.cbu_alias);
    Alert.alert('Copiado', 'CBU copiado al portapapeles');
  };

  const handleLogout = () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          await removeToken();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#000" style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#888' }}>No se pudo cargar el perfil</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tieneDeuda = restricciones?.restriccion_activa;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>REMATIX</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Foto y nombre */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            {perfil?.usuario?.foto_url ? (
              <Image source={{ uri: `${API_URL}/uploads/${perfil.usuario.foto_url}` }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={50} color="#CCC" />
              </View>
            )}
            <TouchableOpacity style={styles.cameraButton} onPress={handlePickPhoto} disabled={uploadingFoto}>
              {uploadingFoto ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
          {editing ? (
            <TextInput
              style={styles.nombreInput}
              value={editNombre}
              onChangeText={setEditNombre}
              placeholder="Nombre completo"
            />
          ) : (
            <Text style={styles.nombre}>{perfil.usuario.nombre_completo}</Text>
          )}
          <Text style={styles.nivel}>CATEGORÍA: {perfil.usuario.nivel}</Text>
        </View>

        {/* Datos Personales */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
            {!editing ? (
              <TouchableOpacity onPress={handleStartEdit}>
                <Ionicons name="pencil" size={18} color="#000" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSaveEdit} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {editing ? (
            <>
              <View style={styles.fieldEdit}>
                <Text style={styles.fieldLabel}>TELÉFONO</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editTelefono}
                  onChangeText={setEditTelefono}
                  placeholder="+549..."
                />
              </View>
              <View style={styles.fieldEdit}>
                <Text style={styles.fieldLabel}>DIRECCIÓN</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editDireccion}
                  onChangeText={setEditDireccion}
                  placeholder="Dirección"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <Text style={styles.fieldValue}>{perfil.usuario.email}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>EMAIL</Text>
                <Text style={styles.fieldValue}>{perfil.usuario.email}</Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>TELÉFONO</Text>
                <Text style={styles.fieldValue}>{perfil.datos_personales.telefono}</Text>
              </View>
              <View style={styles.fieldLast}>
                <Text style={styles.fieldLabel}>DIRECCIÓN</Text>
                <Text style={styles.fieldValue}>{perfil.datos_personales.direccion}</Text>
              </View>
            </>
          )}
        </View>

        {/* Cuenta de Cobro */}
        {perfil.cuenta_cobro && (
          <View style={styles.cobroCard}>
            <View style={styles.cobroHeader}>
              <Text style={styles.cobroTitle}>CUENTA DE COBRO</Text>
              <Ionicons name="shield-checkmark" size={20} color="#000" />
            </View>
            <View style={styles.cobroField}>
              <Text style={styles.fieldLabel}>NÚMERO DE CBU</Text>
              <View style={styles.cbuRow}>
                <Text style={styles.fieldValue}>{perfil.cuenta_cobro.cbu_alias}</Text>
                <TouchableOpacity onPress={handleCopyCBU} style={styles.copyBtn}>
                  <Ionicons name="copy-outline" size={18} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.cobroField}>
              <Text style={styles.fieldLabel}>BANCO</Text>
              <Text style={styles.fieldValue}>{perfil.cuenta_cobro.banco}</Text>
            </View>
            <Button
              title="EDITAR DATOS BANCARIOS"
              onPress={() => router.push('/(tabs)/billetera')}
              style={styles.cobroButton}
            />
          </View>
        )}

        {/* Menú de opciones */}
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/billetera')}>
            <Text style={styles.menuItemText}>Medios de Pago</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/historial')}>
            <Text style={styles.menuItemText}>Métricas e Historial</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/historial')}>
            <View style={styles.menuItemRow}>
              <Text style={styles.menuItemText}>Estado de Cuenta</Text>
              {tieneDeuda && <View style={styles.deudaBadge}><Text style={styles.deudaBadgeText}>¡Deuda!</Text></View>}
            </View>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItemLast} onPress={() => router.push('/(tabs)/billetera')}>
            <Text style={styles.menuItemText}>Mis Bienes</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#D32F2F" />
          <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
  },
  headerBack: {
    width: 40,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#000',
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginBottom: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: -4,
    backgroundColor: '#000',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  nombre: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  nombreInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
    textAlign: 'center',
    paddingVertical: 4,
    minWidth: 200,
  },
  nivel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 2,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  field: {
    marginBottom: 16,
  },
  fieldLast: {
    marginBottom: 0,
  },
  fieldEdit: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    color: '#000',
    flex: 1,
  },
  fieldInput: {
    fontSize: 15,
    color: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
    paddingVertical: 6,
  },
  cobroCard: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  cobroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  cobroTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },
  cobroField: {
    marginBottom: 16,
  },
  cbuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyBtn: {
    marginLeft: 8,
    padding: 4,
  },
  cobroButton: {
    marginTop: 8,
  },
  menu: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  menuItemLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deudaBadge: {
    backgroundColor: '#D32F2F',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  deudaBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D32F2F',
    letterSpacing: 2,
  },
});
