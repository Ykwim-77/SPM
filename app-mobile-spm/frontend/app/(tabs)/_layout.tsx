import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/theme';
import * as Speech from 'expo-speech';
import { useAuth } from '@/src/auth';
import React, { useCallback } from 'react';
import { Pressable } from 'react-native';

export default function TabsLayout() {
  const { user } = useAuth();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="home" options={{
        title: 'Início',
        tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        tabBarButton: (props) => <TabBarButton {...props} label="Início" accessibilityEnabled={user?.accessibility_enabled} />
      }} />
      <Tabs.Screen name="appointments" options={{
        title: 'Consultas',
        tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        tabBarButton: (props) => <TabBarButton {...props} label="Consultas" accessibilityEnabled={user?.accessibility_enabled} />
      }} />
      <Tabs.Screen name="documents" options={{
        title: 'Exames',
        tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
        tabBarButton: (props) => <TabBarButton {...props} label="Exames" accessibilityEnabled={user?.accessibility_enabled} />
      }} />
      <Tabs.Screen name="medications" options={{
        title: 'Remédios',
        tabBarIcon: ({ color, size }) => <Ionicons name="medical" size={size} color={color} />,
        tabBarButton: (props) => <TabBarButton {...props} label="Remédios" accessibilityEnabled={user?.accessibility_enabled} />
      }} />
      <Tabs.Screen name="profile" options={{
        title: 'Perfil',
        tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        tabBarButton: (props) => <TabBarButton {...props} label="Perfil" accessibilityEnabled={user?.accessibility_enabled} />
      }} />
    </Tabs>
  );
}

function TabBarButton({ accessibilityEnabled, label, ...props }: any) {
  const handlePress = useCallback((e: any) => {
    try {
      if (accessibilityEnabled) { Speech.stop(); Speech.speak(label); }
    } catch (e) {}
    if (props.onPress) props.onPress(e);
  }, [accessibilityEnabled, label, props]);

  return <Pressable {...props} onPress={handlePress} />;
}
