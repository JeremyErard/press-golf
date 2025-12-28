import { Stack } from 'expo-router';
import { useApi } from '../../lib/api';

export default function AppLayout() {
  // Initialize API client with auth token
  useApi();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1F2937' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#111827' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Press',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          title: 'Profile',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="courses"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
