import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, SplashScreen, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '../lib/posthog';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGuard() {
  const { session, initialized, setSession, setInitialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  // Subscribe to auth state changes; use INITIAL_SESSION to mark when first
  // session check is done so we don't redirect before we know the state.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'INITIAL_SESSION') {
        setInitialized(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hide splash screen once we know the auth state.
  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  // Redirect based on auth state — but only after the navigator has mounted
  // (navigationState.key is undefined until then) and session is known.
  useEffect(() => {
    if (!navigationState?.key || !initialized) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [session, initialized, segments, navigationState?.key]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <PostHogProvider client={posthog} autocapture>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <AuthGuard />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </PostHogProvider>
  );
}
