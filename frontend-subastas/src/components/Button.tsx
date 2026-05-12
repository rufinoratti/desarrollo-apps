import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'google';
  style?: ViewStyle;
  textStyle?: TextStyle;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ title, onPress, variant = 'primary', style, textStyle, loading }) => {
  const isPrimary = variant === 'primary';
  const isGoogle = variant === 'google';

  return (
    <TouchableOpacity 
      style={[
        styles.button, 
        isPrimary ? styles.primary : isGoogle ? styles.google : styles.secondary,
        style
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#FFF' : '#000'} />
      ) : (
        <Text style={[
          styles.text, 
          isPrimary ? styles.primaryText : styles.secondaryText,
          textStyle
        ]}>
          {isGoogle ? 'G   ' : ''}{title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: '#000',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#000',
  },
  google: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  text: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  primaryText: {
    color: '#FFF',
  },
  secondaryText: {
    color: '#000',
  },
});
