import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { API_URL } from '@/src/config/env';

export default function RecuperarClave() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleRecuperar = async () => {
    if (!email) {
      Alert.alert('Error', 'Por favor ingresa tu email.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/recuperar-clave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setEnviado(true);
        if (data.resetToken) {
          setResetToken(data.resetToken);
        }
      } else if (response.status === 404) {
        Alert.alert('Aviso', 'Si el email existe, recibirás instrucciones para restablecer tu contraseña');
      } else if (response.status === 429) {
        Alert.alert('Aviso', 'Demasiadas solicitudes. Intente más tarde.');
      } else {
        Alert.alert('Error', data.error || 'Ocurrió un error inesperado');
      }
    } catch (err) {
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
              <Text style={styles.logo}>REMATIX</Text>
            </View>
            <Text style={styles.title}>Correo Enviado</Text>
            <Text style={styles.subtitle}>
              Si el email existe en el sistema, recibirás instrucciones para restablecer tu contraseña.
            </Text>
            {resetToken ? (
              <View style={styles.devBox}>
                <Text style={styles.devBoxTitle}>MODO DESARROLLO</Text>
                <Text style={styles.devBoxText}>
                  Token: {resetToken}
                </Text>
                <Button
                  title="Restablecer Contraseña"
                  onPress={() => router.push(`/(auth)/restablecer-clave?email=${encodeURIComponent(email)}&token=${resetToken}`)}
                  style={styles.devButton}
                />
              </View>
            ) : null}
            <View style={styles.spacer} />
            <Button
              title="Volver al Inicio de Sesión"
              onPress={() => router.replace('/(auth)/login')}
            />
          </ScrollView>
        </KeyboardAvoidingView>
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

          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            Ingresa tu email y te enviaremos instrucciones para restablecer tu contraseña.
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="usuario@mail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholderTextColor="#B0B0B0"
              />
            </View>
          </View>

          <View style={styles.spacer} />

          <Button
            title="ENVIAR INSTRUCCIONES"
            onPress={handleRecuperar}
            loading={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Recordaste tu contraseña? </Text>
            <Text style={styles.footerLink} onPress={() => router.replace('/(auth)/login')}>
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
  spacer: { flex: 1, minHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  footerText: { fontSize: 12, color: '#888' },
  footerLink: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  devBox: { backgroundColor: '#FFF3CD', borderRadius: 8, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#FFEAA7' },
  devBoxTitle: { fontSize: 10, fontWeight: 'bold', color: '#856404', letterSpacing: 1, marginBottom: 8 },
  devBoxText: { fontSize: 12, color: '#856404', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  devButton: { marginTop: 12 }
});
