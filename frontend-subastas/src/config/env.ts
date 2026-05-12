// Central place for environment configuration.
// For local dev with the mock server, point this to the machine IP/hostname reachable
// from your device/emulator.

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.0.21:3000';
