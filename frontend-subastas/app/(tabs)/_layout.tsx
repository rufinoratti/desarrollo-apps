import React from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{ 
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 80,
          paddingHorizontal: 20,
          backgroundColor: '#FFF',
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignItems: 'center' }}>
                <Ionicons name="home" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>Inicio</Text>
              </View>
            ) : (
              <Ionicons name="home-outline" size={24} color="#888" />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="subastas"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignItems: 'center' }}>
                <Ionicons name="pricetag" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>Subastas</Text>
              </View>
            ) : (
              <Ionicons name="pricetag-outline" size={24} color="#888" />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="pujas-actuales"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignItems: 'center' }}>
                <Ionicons name="hammer" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>Pujas</Text>
              </View>
            ) : (
              <Ionicons name="hammer-outline" size={24} color="#888" />
            )
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          tabBarIcon: ({ focused }) => (
            focused ? (
              <View style={{ flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, alignItems: 'center' }}>
                <Ionicons name="person" size={20} color="#FFF" />
                <Text style={{ color: '#FFF', marginLeft: 8, fontWeight: 'bold', fontSize: 12 }}>Perfil</Text>
              </View>
            ) : (
              <Ionicons name="person-outline" size={24} color="#888" />
            )
          ),
        }}
      />
    </Tabs>
  );
}
