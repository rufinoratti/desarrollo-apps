import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/config/env';

const PasswordInput = ({ label, value, onChangeText, placeholder, onForgot }: any) => {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.inputContainer}>
      <View style={styles.labelRow}>
        <Text style={styles.inputLabel}>{label.toUpperCase()}</Text>
        {onForgot && (
          <TouchableOpacity onPress={onForgot}>
            <Text style={styles.forgotText}>¿OLVIDÓ SU CLAVE?</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={!show}
          placeholderTextColor="#B0B0B0"
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={() => setShow(!show)} style={styles.icon}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Login() {
  const { saveToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa tu email y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.status === 200) {
        saveToken(data.token, data.nombre || 'Usuario', data.nivel);
        router.replace('/(tabs)');
      } else if (response.status === 401) {
        Alert.alert('Error', 'Email o contraseña incorrectos');
      } else if (response.status === 403) {
        Alert.alert('Aviso', data.error || 'Cuenta bloqueada o en revisión.');
      } else {
        Alert.alert('Error', 'Ocurrió un error inesperado');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <View style={styles.header}>
            <Text style={styles.logo}>REMATIX</Text>
            <Text style={styles.logoSub}>GALERÍA DE SUBASTAS EXCLUSIVAS</Text>
          </View>
          
          <Text style={styles.title}>Acceso Exclusivo</Text>
          <Text style={styles.subtitle}>
            Inicie sesión para acceder a los lotes más prestigiosos del mercado.
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

          <PasswordInput 
            label="CONTRASEÑA"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            onForgot={() => Alert.alert('Aviso', 'Ir a recuperación de clave...')}
          />

          <View style={styles.spacer} />

          <Button 
            title="INGRESAR ➔"
            onPress={handleLogin}
            loading={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿No tiene una cuenta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/registro/paso1')}>
              <Text style={styles.footerLink}>Crear Cuenta</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>O CONTINUA CON</Text>
            <View style={styles.divider} />
          </View>

          <Button 
            title="Continuar con Google"
            onPress={() => {}}
            variant="google"
          />

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
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 },
  inputLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', letterSpacing: 1 },
  forgotText: { fontSize: 10, fontWeight: 'bold', color: '#888', textDecorationLine: 'underline' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D0D0D0' },
  input: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 8 },
  icon: { padding: 5 },
  spacer: { flex: 1, minHeight: 20 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginVertical: 20 },
  footerText: { fontSize: 12, color: '#888' },
  footerLink: { fontSize: 12, fontWeight: 'bold', color: '#000' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#EEE' },
  dividerText: { fontSize: 10, color: '#888', marginHorizontal: 10, letterSpacing: 1 },
});
