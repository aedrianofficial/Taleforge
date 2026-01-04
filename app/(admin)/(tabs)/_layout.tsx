import { IconSymbol } from '@/components/ui/icon-symbol';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminTabsLayout() {
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
        tabBarActiveTintColor: '#5E5CE6',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#1C1C1E',
          borderTopColor: '#2C2C2E',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: bottomPadding,
          paddingTop: 6,
          paddingHorizontal: 4,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
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
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 24 : 22} name="chart.bar.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: 'Board',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 24 : 22} name="square.grid.2x2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="story-management"
        options={{
          title: 'Stories',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 24 : 22} name="book.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="panel"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 24 : 22} name="person.2.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol size={focused ? 24 : 22} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
