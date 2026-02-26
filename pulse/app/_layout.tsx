import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, SplashScreen, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import { posthog } from '../lib/posthog';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthGuard() {
  const { session, initialized, onboardingComplete, setSession, setInitialized, loadPersistedState } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Load persisted onboarding completion state first so the redirect
    // logic below has accurate data when INITIAL_SESSION fires.
    loadPersistedState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'INITIAL_SESSION') {
        setInitialized(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  useEffect(() => {
    if (!navigationState?.key || !initialized) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inOnboarding) {
      // Not authenticated → send to onboarding
      router.replace('/onboarding');
    } else if (session && inOnboarding && onboardingComplete) {
      // Authenticated AND onboarding done → send to main app
      // If onboardingComplete is false (mid-onboarding auth at step 13),
      // we intentionally do nothing so steps 14-15 can complete the flow.
      router.replace('/(tabs)');
    }
  }, [session, initialized, onboardingComplete, segments, navigationState?.key]);

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
