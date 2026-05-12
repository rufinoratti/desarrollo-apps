import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Input } from '@/src/components/Input';
import { Select } from '@/src/components/Select';
import { Button } from '@/src/components/Button';
import { useRegistration } from '@/src/context/RegistrationContext';
import { API_URL } from '@/src/config/env';

export default function Paso1() {
  const { updateRegistrationData } = useRegistration();
  const [loading, setLoading] = useState(false);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countries, setCountries] = useState<{ id: number; nombre: string }[]>([]);
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    documento: '',
    direccion: '',
    pais_residencia: null as number | null,
    pais_nombre: '',
    email: '',
  });

  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    fetch(`${API_URL}/paises`)
      .then(res => res.json())
      .then(data => {
        setCountries(data);
        setCountriesLoading(false);
      })
      .catch(err => {
        console.error(err);
        setCountriesLoading(false);
        Alert.alert('Error', 'No se pudieron cargar los países. Verifica que el mock server esté corriendo.');
      });
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: Record<string, unknown>) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSelectCountry = (id: number, nombre: string) => {
    setFormData((prev) => ({ ...prev, pais_residencia: id, pais_nombre: nombre }));
    if (errors.pais_residencia) {
      setErrors((prev: Record<string, unknown>) => ({ ...prev, pais_residencia: undefined }));
    }
  };

  const validate = () => {
    const newErrors: any = {};
    if (!formData.nombre_completo) newErrors.nombre_completo = 'Requerido';
    if (!formData.documento) newErrors.documento = 'Requerido';
    if (!formData.direccion) newErrors.direccion = 'Requerido';
    if (!formData.pais_residencia) newErrors.pais_residencia = 'Requerido';
    if (!formData.email) newErrors.email = 'Requerido';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/registro/paso1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formData.nombre_completo,
          documento: formData.documento,
          direccion: formData.direccion,
          pais_residencia: formData.pais_residencia,
          email: formData.email,
        })
      });

      const data = await response.json();

      if (response.status === 400 && data.codigo === 'EMAIL_DUPLICADO') {
        setErrors({ email: data.error });
        Alert.alert('Aviso', 'El email ya está registrado. ¿Desea iniciar sesión?');
      } else if (response.status === 201) {
        updateRegistrationData({
          registro_id: data.registro_id,
          paso1: {
            nombre_completo: formData.nombre_completo,
            documento: formData.documento,
            direccion: formData.direccion,
            pais_residencia: formData.pais_residencia,
            email: formData.email,
          }
        });
        router.push('/(auth)/registro/paso2');
      } else {
        Alert.alert('Error', 'Ocurrió un error inesperado');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.logo}>REMATIX</Text>
          
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>PASO 1 DE 3</Text>
            <View style={styles.progressBarBackground}>
              <View style={styles.progressBarFill} />
            </View>
          </View>

          <Text style={styles.title}>Datos Personales</Text>

          <Input 
            label="NOMBRE COMPLETO"
            placeholder="Ej. Juan Pérez"
            value={formData.nombre_completo}
            onChangeText={(t) => handleChange('nombre_completo', t)}
            error={errors.nombre_completo}
            autoCapitalize="words"
          />

          <Input 
            label="DNI / PASAPORTE"
            placeholder="Sin puntos ni espacios"
            value={formData.documento}
            onChangeText={(t) => handleChange('documento', t)}
            keyboardType="numeric"
            error={errors.documento}
          />

          <Input 
            label="DIRECCIÓN RESIDENCIAL"
            placeholder="Calle, Número, Piso"
            value={formData.direccion}
            onChangeText={(t) => handleChange('direccion', t)}
            error={errors.direccion}
          />

          <Select 
            label="PAÍS DE RESIDENCIA"
            placeholder={countriesLoading ? "Cargando..." : "Selecciona"}
            value={formData.pais_nombre}
            options={countries}
            onSelect={handleSelectCountry}
            disabled={countriesLoading}
            error={errors.pais_residencia}
          />

          <Input 
            label="EMAIL"
            placeholder="Ej. juanperez@hotmail.com"
            value={formData.email}
            onChangeText={(t) => handleChange('email', t)}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

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

          <Button 
            title="SIGUIENTE"
            onPress={handleSubmit}
            loading={loading}
          />

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tiene una cuenta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={styles.footerLink}>Iniciar Sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
  },
  scroll: {
    padding: 30,
    paddingTop: 50,
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 1,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: '#EEE',
    width: '100%',
  },
  progressBarFill: {
    height: 2,
    backgroundColor: '#000',
    width: '33%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEE',
  },
  dividerText: {
    fontSize: 10,
    color: '#888',
    marginHorizontal: 10,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
  },
  footerLink: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  }
});
