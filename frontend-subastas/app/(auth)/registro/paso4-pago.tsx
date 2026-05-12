import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import { Button } from '@/src/components/Button';
import { useRegistration } from '@/src/context/RegistrationContext';
import { useAuth } from '@/src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/src/config/env';

type MetodoPago = 'CUENTA_BANCARIA' | 'TARJETA' | 'CHEQUE';

export default function Paso4Pago() {
  const { registrationData, clearRegistrationData } = useRegistration();
  const { saveToken } = useAuth();
  
  const [metodo, setMetodo] = useState<MetodoPago>('CUENTA_BANCARIA');
  const [loading, setLoading] = useState(false);
  const [bancos, setBancos] = useState([]);
  
  // Form State
  const [cbu, setCbu] = useState('');
  const [titular, setTitular] = useState('');
  const [bancoNombre, setBancoNombre] = useState('');
  
  const [tarjeta, setTarjeta] = useState('');
  const [cvv, setCvv] = useState('');
  const [fechaExp, setFechaExp] = useState('');

  useEffect(() => {
    if (metodo === 'CUENTA_BANCARIA' && bancos.length === 0) {
      fetch(`${API_URL}/api/auth/bancos`)
        .then(res => res.json())
        .then(data => setBancos(data))
        .catch(() => Alert.alert('Error', 'No se pudieron cargar los bancos'));
    }
  }, [metodo, bancos.length]);

  // Formatters
  const formatTarjeta = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 16);
    const match = cleaned.match(/.{1,4}/g);
    return match ? match.join(' ') : cleaned;
  };

  const formatFechaExp = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 4);
    if (cleaned.length >= 3) {
      return `${cleaned.substring(0, 2)}/${cleaned.substring(2, 4)}`;
    }
    return cleaned;
  };

  const formatCvv = (text: string) => {
    return text.replace(/\D/g, '').substring(0, 4);
  };

  const handleSubmit = async () => {
    if (!registrationData.registro_id) {
      Alert.alert('Error', 'ID de registro no encontrado.');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        registro_id: registrationData.registro_id,
        tipo_pago: metodo,
        detalles: {}
      };

      if (metodo === 'CUENTA_BANCARIA') {
        payload.detalles = { cbu_alias: cbu, titular, banco: bancoNombre };
      } else if (metodo === 'TARJETA') {
        payload.detalles = { numero_tarjeta: tarjeta.replace(/\s/g, ''), cvv, fecha_expiracion: fechaExp, titular };
      }

      const response = await fetch(`${API_URL}/api/auth/registro/paso4-pago`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.status === 201) {
        // Exito total
        saveToken(data.token, titular || 'Usuario', data.nivel);
        clearRegistrationData();
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', data.error || 'Ocurrió un error');
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
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.logo}>REMATIX</Text>
            <View style={{ width: 24 }} />
          </View>
          
          <Text style={styles.subtitle}>GESTIÓN DE FONDOS</Text>
          <Text style={styles.title}>Agregar Medio de Pago</Text>

          <View style={styles.segmentContainer}>
            {(['CUENTA_BANCARIA', 'TARJETA', 'CHEQUE'] as MetodoPago[]).map((tab) => (
              <TouchableOpacity 
                key={tab} 
                style={[styles.segmentTab, metodo === tab && styles.segmentTabActive]}
                onPress={() => setMetodo(tab)}
              >
                <Text style={[styles.segmentText, metodo === tab && styles.segmentTextActive]}>
                  {tab === 'CUENTA_BANCARIA' ? 'CUENTA\nBANCARIA' : tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {metodo === 'CUENTA_BANCARIA' && (
            <View>
              <Input 
                label="CBU / ALIAS"
                placeholder="0000000000000000000000"
                value={cbu}
                onChangeText={setCbu}
              />
              <Input 
                label="NOMBRE DEL TITULAR"
                placeholder="Nombre completo como figura en el banco"
                value={titular}
                onChangeText={setTitular}
              />
              <Select 
                label="BANCO"
                placeholder="Seleccionar entidad bancaria"
                value={bancoNombre}
                options={bancos}
                onSelect={(_id, nombre) => { setBancoNombre(nombre); }}
              />
            </View>
          )}

          {metodo === 'TARJETA' && (
            <View>
              <Input 
                label="NÚMERO DE TARJETA"
                placeholder="0000 0000 0000 0000"
                value={tarjeta}
                onChangeText={(t) => setTarjeta(formatTarjeta(t))}
                keyboardType="numeric"
              />
              <Input 
                label="NOMBRE DEL TITULAR"
                placeholder="Nombre completo como figura en la tarjeta"
                value={titular}
                onChangeText={setTitular}
              />
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Input 
                    label="FECHA DE EXP."
                    placeholder="MM/AA"
                    value={fechaExp}
                    onChangeText={(t) => setFechaExp(formatFechaExp(t))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input 
                    label="CVV"
                    placeholder="123"
                    value={cvv}
                    onChangeText={(t) => setCvv(formatCvv(t))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          )}

          {metodo === 'CHEQUE' && (
            <View>
              <Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
                Opción de cheque en desarrollo...
              </Text>
            </View>
          )}

          <View style={styles.spacer} />

          <Button 
            title="CONFIRMAR Y VERIFICAR ➔"
            onPress={handleSubmit}
            loading={loading}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { padding: 5 },
  logo: { fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  subtitle: { fontSize: 10, fontWeight: 'bold', color: '#888', letterSpacing: 1, marginBottom: 5 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  segmentContainer: { flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 4, marginBottom: 30 },
  segmentTab: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  segmentTabActive: { backgroundColor: '#000' },
  segmentText: { fontSize: 10, fontWeight: 'bold', color: '#888', textAlign: 'center', letterSpacing: 1 },
  segmentTextActive: { color: '#FFF' },
  row: { flexDirection: 'row' },
  spacer: { flex: 1, minHeight: 40 },
});
