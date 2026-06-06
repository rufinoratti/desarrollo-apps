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
  AlertButton,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/context/AuthContext';
import { Button } from '@/src/components/Button';
import { SkeletonCircle, SkeletonLine } from '@/src/components/Skeleton';
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
  es_duenio: boolean;
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
  const { token, nombre, email, pending, saveToken, removeToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [restricciones, setRestricciones] = useState<RestriccionesData | null>(null);
  const [editing, setEditing] = useState(false);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDireccion, setEditDireccion] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [registrandoDuenio, setRegistrandoDuenio] = useState(false);

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
        es_duenio: raw.es_duenio ?? false,
      };
      setPerfil(perfilData);
      setRestricciones(restData);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  }, [token, removeToken]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPerfil();
    setRefreshing(false);
  }, [fetchPerfil]);

  useEffect(() => {
    if (pending && !token) {
      setLoading(false);
      return;
    }
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
        es_duenio: data.es_duenio ?? perfil.es_duenio,
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
        es_duenio: data.es_duenio ?? perfil?.es_duenio ?? false,
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
        es_duenio: data.es_duenio ?? perfil?.es_duenio ?? false,
      };
      setPerfil(updatedPerfil);
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la foto');
    } finally {
      setUploadingFoto(false);
    }
  };

  const handlePickPhoto = () => {
    const options: AlertButton[] = [
      { text: 'Cámara', onPress: handlePickPhotoFromCamera },
      { text: 'Galería', onPress: handlePickPhotoFromGallery },
    ];
    if (perfil?.usuario?.foto_url) {
      options.push({ text: 'Eliminar foto', onPress: handleDeletePhoto, style: 'destructive' });
    }
    options.push({ text: 'Cancelar', style: 'cancel' });
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

  const handleRegistrarComoDuenio = () => {
    Alert.alert(
      'Registrarme como dueño',
      'Al registrarte como dueño podrás publicar artículos para ser subastados. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Registrarme',
          onPress: async () => {
            if (!token) return;
            setRegistrandoDuenio(true);
            try {
              const res = await fetch(`${API_URL}/api/perfil/duenio`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.status === 401) {
                await removeToken();
                return;
              }
              const data = await res.json();
              if (!res.ok) {
                throw new Error(data.error || 'Error al registrarte');
              }
              if (data.ya_existia) {
                Alert.alert('Ya sos dueño', 'Ya estás registrado como dueño en el sistema.');
              } else {
                setPerfil((prev) => prev ? { ...prev, es_duenio: true } : prev);
                Alert.alert('¡Listo!', 'Ya estás registrado como dueño. Ahora podés publicar artículos.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'No se pudo completar el registro');
            } finally {
              setRegistrandoDuenio(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerBack} />
          <Text style={styles.headerTitle}>REMATIX</Text>
          <View style={styles.headerBack} />
        </View>
        <View style={{ padding: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 30 }}>
            <SkeletonCircle size={100} />
            <View style={{ height: 16 }} />
            <SkeletonLine width={180} height={18} />
            <View style={{ height: 8 }} />
            <SkeletonLine width={100} height={12} />
          </View>
          <View style={{ gap: 14, marginBottom: 25 }}>
            <SkeletonLine width="100%" height={56} borderRadius={12} />
            <SkeletonLine width="100%" height={56} borderRadius={12} />
            <SkeletonLine width="100%" height={56} borderRadius={12} />
          </View>
          <View style={{ gap: 8 }}>
            <SkeletonLine width="100%" height={50} borderRadius={10} />
            <SkeletonLine width="100%" height={50} borderRadius={10} />
            <SkeletonLine width="100%" height={50} borderRadius={10} />
            <SkeletonLine width="100%" height={50} borderRadius={10} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (pending && !token) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Ionicons name="chevron-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>REMATIX</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.pendingFull}>
          <Text style={styles.pendingTitle}>USUARIO EN VALIDACIÓN</Text>
          <Text style={styles.pendingText}>Tu cuenta aún no fue aprobada. Podés cerrar sesión y volver más tarde.</Text>
          <Button title="CERRAR SESIÓN" onPress={handleLogout} />
        </View>
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: '#888', marginBottom: 20, textAlign: 'center' }}>No se pudo cargar el perfil</Text>
          <Text style={{ color: '#aaa', fontSize: 12, marginBottom: 20, textAlign: 'center' }}>Tirá hacia abajo para reintentar</Text>
          <TouchableOpacity
            onPress={() => { setLoading(true); fetchPerfil(); }}
            style={{ borderWidth: 1, borderColor: '#000', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 30 }}
          >
            <Text style={{ fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>REINTENTAR</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const tieneDeuda = restricciones?.restriccion_activa;
  const isAdmin = String(email || '').toLowerCase() === 'admin@rematix.com';

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

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
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
          <TouchableOpacity onPress={!perfil.es_duenio ? handleRegistrarComoDuenio : undefined} activeOpacity={!perfil.es_duenio ? 0.6 : 1}>
            <Text style={[styles.duenioStatus, perfil.es_duenio ? styles.duenioSi : styles.duenioNo]}>
              Dueño: {perfil.es_duenio ? '✓' : '✗'}
            </Text>
          </TouchableOpacity>
        </View>

        {pending && !token && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>USUARIO EN VALIDACIÓN</Text>
            <Text style={styles.pendingText}>Solo podés cerrar sesión hasta que un admin apruebe tu cuenta.</Text>
          </View>
        )}

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

        {isAdmin && (
          <View style={styles.adminCard}>
            <Text style={styles.adminTitle}>PANEL ADMIN</Text>
            <Text style={styles.adminSubtitle}>Validar clientes, productos y subastas</Text>
            <Button title="IR AL PANEL" onPress={() => router.push('/admin' as any)} />
          </View>
        )}

        {/* Menú de opciones */}
        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/billetera')}>
            <Text style={styles.menuItemText}>Medios de Pago</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/metricas-historial')}>
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
          <TouchableOpacity style={styles.menuItemLast} onPress={() => router.push('/mis-bienes')}>
            <Text style={styles.menuItemText}>Mis Bienes</Text>
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.duenioButton} onPress={handleRegistrarComoDuenio} disabled={registrandoDuenio}>
            <Ionicons name={registrandoDuenio ? 'hourglass-outline' : 'shield-checkmark-outline'} size={20} color="#2E7D32" />
            <Text style={styles.duenioButtonText}>{registrandoDuenio ? 'REGISTRANDO...' : 'REGISTRARME COMO DUEÑO'}</Text>
          </TouchableOpacity>

        {/* Cambiar Contraseña */}
        <TouchableOpacity style={styles.cambiarClaveButton} onPress={() => router.push(`/(auth)/recuperar-clave?email=${encodeURIComponent(perfil.usuario.email)}`)}>
          <Ionicons name="lock-closed-outline" size={20} color="#000" />
          <Text style={styles.cambiarClaveText}>CAMBIAR CONTRASEÑA</Text>
        </TouchableOpacity>

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
    fontSize: 26,
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
    fontSize: 26,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  nombreInput: {
    fontSize: 26,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 2,
  },
  duenioStatus: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  duenioSi: {
    color: '#2E7D32',
  },
  duenioNo: {
    color: '#D32F2F',
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
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },
  saveText: {
    fontSize: 16,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  fieldInput: {
    fontSize: 17,
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
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
  },
  cobroField: {
    marginBottom: 16,
  },
  adminCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  adminTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#000',
    marginBottom: 6,
  },
  duenioTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#2E7D32',
    marginBottom: 6,
  },
  adminSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  pendingCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  pendingTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#8D6E63',
    marginBottom: 6,
  },
  pendingText: {
    fontSize: 13,
    color: '#8D6E63',
  },
  pendingFull: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
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
    fontSize: 17,
    fontWeight: '600',
    color: '#373636',
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
  duenioButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  duenioButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 2,
  },
  cambiarClaveButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  cambiarClaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 2,
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
