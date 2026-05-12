import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';

interface SelectProps {
  label: string;
  value: string;
  // 1. Actualizamos los tipos para que acepte id, numero, nombre o label sin quejarse
  options: { id?: number; numero?: number; nombre?: string; label?: string }[];
  onSelect: (id: number, nombre: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ label, value, options, onSelect, disabled, placeholder, error }) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TouchableOpacity 
        style={[styles.input, error && styles.inputError, disabled && styles.disabled]} 
        onPress={() => !disabled && setModalVisible(true)}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder || 'Seleccionar'}
        </Text>
        <Text style={styles.chevron}>v</Text>
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecciona una opción</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
               data={options}
               keyExtractor={(item, index) => String(item?.id ?? item?.numero ?? index)}
               renderItem={({ item }) => (
                 <TouchableOpacity 
                   style={styles.option} 
                   onPress={() => {
                     // 2. Le pasamos al formulario el ID (o el numero) y el Nombre
                     onSelect(
                       item?.id ?? item?.numero ?? 0, 
                       item?.nombre ?? item?.label ?? 'Opción'
                     );
                     // 3. Cerramos el modal automáticamente al elegir
                     setModalVisible(false);
                   }}
                 >
                   <Text style={styles.optionText}>
                     {item?.nombre ?? item?.label ?? 'Opción sin nombre'}
                   </Text>
                 </TouchableOpacity>
               )}
             />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    letterSpacing: 1,
    marginBottom: 4,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D0D0D0',
  },
  disabled: {
    opacity: 0.5,
  },
  inputError: {
    borderBottomColor: 'red',
  },
  valueText: {
    fontSize: 16,
    color: '#000',
  },
  placeholderText: {
    fontSize: 16,
    color: '#B0B0B0',
  },
  chevron: {
    color: '#B0B0B0',
    fontSize: 12,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#007AFF',
    fontSize: 16,
  },
  option: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  optionText: {
    fontSize: 16,
  },
});