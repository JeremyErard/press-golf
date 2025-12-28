import { Stack } from 'expo-router';

export default function CoursesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1F2937' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#111827' },
      }}
    />
  );
}
