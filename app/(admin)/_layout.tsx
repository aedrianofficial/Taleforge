import { Stack } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AdminLayout() {
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
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="story-management"
        options={{
          title: 'Story Management',
          headerStyle: {
            backgroundColor: '#1C1C1E',
          },
          headerTintColor: '#E8D5B7',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
      <Stack.Screen
        name="story-review/[storyId]"
        options={{
          title: 'Review Story',
          headerStyle: {
            backgroundColor: '#1C1C1E',
          },
          headerTintColor: '#E8D5B7',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      />
    </Stack>
  );
}
