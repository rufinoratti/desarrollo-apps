import { Platform } from 'react-native';

// Central place for environment configuration.
const defaultApiUrl = Platform.OS === 'android'
  ? 'http://192.168.0.198:3000'
  : 'http://localhost:3000';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultApiUrl;