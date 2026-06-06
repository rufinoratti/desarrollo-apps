import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '@/src/components/Button';
import { useRegistration } from '@/src/context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/config/env';

const PasswordInput = ({ label, value, onChangeText, placeholder }: any) => {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label.toUpperCase()}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={!show}
          placeholderTextColor="#B0B0B0"
        />
        <TouchableOpacity onPress={() => setShow(!show)} style={styles.icon}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={20} color="#888" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function Paso2() {
  const { registrationData } = useRegistration();
  const [loading, setLoading] = useState(false);
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumberOrSpecial = /[0-9!@#$%^&*]/.test(password);
  const isMatch = password === confirmPassword && password !== '';

  const isValid = hasMinLength && hasUppercase && hasNumberOrSpecial && isMatch;

  const handleSubmit = async () => {
    if (!isValid) return;

    if (!registrationData.registro_id) {
      Alert.alert('Error', 'Falta el ID de registro. Regrese al paso 1.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/registro/paso2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registro_id: registrationData.registro_id,
          password
        })
      });

      const data = await response.json();

      if (response.status === 400) {
        Alert.alert('Error', data.error);
      } else if (response.status === 200) {
        router.push('/registro/paso3');
      } else {
        Alert.alert('Error', data.error || 'Ocurrió un error inesperado');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const renderRequirement = (met: boolean, text: string) => (
    <View style={styles.reqRow}>
      <Ionicons 
        name={met ? "checkmark-circle" : "radio-button-off"} 
        size={16} 
        color={met ? "#000" : "#CCC"} 
      />
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll}>
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.logo}>REMATIX</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>PASO 2 DE 3</Text>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: '66%' }]} />
            </View>
          </View>

          <Text style={styles.title}>Crea tu contraseña</Text>

          <PasswordInput 
            label="CONTRASEÑA"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
          />

          <PasswordInput 
            label="CONFIRMAR CONTRASEÑA"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <View style={styles.requirementsContainer}>
            <Text style={styles.reqTitle}>REQUISITOS DE SEGURIDAD</Text>
            {renderRequirement(hasMinLength, "Mínimo 8 caracteres")}
            {renderRequirement(hasUppercase, "Al menos una mayúscula")}
            {renderRequirement(hasNumberOrSpecial, "Un número o carácter especial")}
          </View>

          <View style={styles.spacer} />

          <Button 
            title="SIGUIENTE ➔"
            onPress={handleSubmit}
            loading={loading}
            // Mantenemos el estilo activo si isValid, sino opaco.
            style={!isValid ? { opacity: 0.5 } : {}}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  container: { flex: 1 },
  scroll: { padding: 30, paddingTop: 20, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  backButton: { padding: 5 },
  logo: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  progressContainer: { marginBottom: 20 },
  progressText: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 10 },
  progressBarBackground: { height: 2, backgroundColor: '#EEE', width: '100%' },
  progressBarFill: { height: 2, backgroundColor: '#000' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 10, fontWeight: 'bold', color: '#333', letterSpacing: 1, marginBottom: 4 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#D0D0D0' },
  input: { flex: 1, fontSize: 16, color: '#000', paddingVertical: 8 },
  icon: { padding: 5 },
  requirementsContainer: { marginTop: 10 },
  reqTitle: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 10 },
  reqRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  reqText: { fontSize: 12, color: '#888', marginLeft: 8 },
  reqTextMet: { color: '#000' },
  spacer: { flex: 1, minHeight: 40 },
});
