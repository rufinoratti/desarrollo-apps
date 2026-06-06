import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/src/components/Button';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/config/env';

export default function RestablecerClave() {
  const { email: emailParam, token: tokenParam } = useLocalSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [completado, setCompletado] = useState(false);

  const handleRestablecer = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Por favor ingresa y confirma tu nueva contraseña.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/restablecer-clave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailParam,
          token: tokenParam,
          newPassword: password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setCompletado(true);
      } else if (response.status === 401) {
        Alert.alert('Error', 'El token es inválido o ha expirado. Solicita un nuevo restablecimiento.');
      } else if (response.status === 400 && data.codigo === 'PASSWORD_DEBIL') {
        Alert.alert('Error', data.error || 'La contraseña no cumple los requisitos mínimos.');
      } else {
        Alert.alert('Error', data.error || 'Ocurrió un error inesperado');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (completado) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
              <Text style={styles.logo}>REMATIX</Text>
            </View>
            <Text style={styles.title}>Contraseña Actualizada</Text>
            <Text style={styles.subtitle}>
              Tu contraseña se ha restablecido correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.
            </Text>
            <View style={styles.spacer} />
            <Button
              title="INICIAR SESIÓN"
              onPress={() => router.replace('/login')}
            />
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.logo}>REMATIX</Text>
            <Text style={styles.logoSub}>GALERÍA DE SUBASTAS EXCLUSIVAS</Text>
          </View>

          <Text style={styles.title}>Nueva Contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa tu nueva contraseña para restablecer el acceso a tu cuenta.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>NUEVA CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                placeholderTextColor="#B0B0B0"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.icon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>CONFIRMAR CONTRASEÑA</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry={!showConfirm}
                placeholderTextColor="#B0B0B0"
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.icon}>
                <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>
            Mínimo 8 caracteres, una mayúscula y un número.
          </Text>

          <View style={styles.spacer} />

          <Button
            title="RESTABLECER CONTRASEÑA"
            onPress={handleRestablecer}
            loading={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Recordaste tu contraseña? </Text>
            <Text style={styles.footerLink} onPress={() => router.replace('/login')}>
              Iniciar Sesión
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
  container: { flex: 1 },
  scroll: { padding: 30, paddingTop: 50, flexGrow: 1 },
  header: { marginBottom: 50 },
  logo: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  logoSub: { fontSize: 8, fontWeight: 'bold', color: '#666', letterSpacing: 2, marginTop: 5 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 40, lineHeight: 20 },
  inputContainer: { marginBottom: 25 },
  inputLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', letterSpacing: 1, marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D0D0D0' },
  input: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 8 },
  icon: { padding: 5 },
  hint: { fontSize: 11, color: '#888', marginTop: -15, marginBottom: 10 },
  spacer: { flex: 1, minHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  footerText: { fontSize: 12, color: '#888' },
  footerLink: { fontSize: 12, fontWeight: 'bold', color: '#000' },
});
