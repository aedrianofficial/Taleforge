import { IconSymbol } from '@/components/ui/icon-symbol';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  // Calculate safe bottom padding for navigation bar
  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 20),
    android: Math.max(insets.bottom, 16),
    default: 16,
  });

  const tabBarHeight = Platform.select({
    ios: 50 + bottomPadding,
    android: 60 + bottomPadding,
    default: 60 + bottomPadding,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#C4A574',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2C2C2E',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
        headerStyle: {
          backgroundColor: '#1C1C1E',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: '#E8D5B7',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 26 : 24} name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 26 : 24} name="square.grid.2x2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stories"
        options={{
          title: 'Stories',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 26 : 24} name="book.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 26 : 24} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
