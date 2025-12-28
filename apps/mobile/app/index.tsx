import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';

export default function Index() {
  const { isSignedIn } = useAuth();

  // Redirect based on auth state
  if (isSignedIn) {
    return <Redirect href="/(app)/" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
