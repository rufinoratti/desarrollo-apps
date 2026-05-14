  import React from 'react';
  import { Tabs } from 'expo-router';
  import { Ionicons } from '@expo/vector-icons';
  import { Platform } from 'react-native';

  export default function TabLayout() {
    return (
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: '#000000', // Ícono seleccionado en negro
          tabBarInactiveTintColor: '#999999', // Ícono inactivo en gris
          tabBarStyle: {
            height: Platform.OS === 'ios' ? 88 : 72,
            paddingHorizontal: 12,
            paddingBottom: Platform.OS === 'ios' ? 28 : 10,
            paddingTop: 8,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: '#F0F0F0',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="subastas"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? "pricetag" : "pricetag-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pujas-actuales"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="billetera" options={{ href: null }} />
        <Tabs.Screen name="medio-pago-detalle" options={{ href: null }} />
        <Tabs.Screen name="historial" options={{ href: null }} />
      </Tabs>
    );
  }

  const activePill = {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center', // Clave para que el ícono quede bien centrado
  };