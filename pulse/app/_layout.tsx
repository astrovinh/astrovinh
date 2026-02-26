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
  const {
    session,
    profile,
    initialized,
    profileLoaded,
    setSession,
    setProfile,
    setInitialized,
    setProfileLoaded,
  } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      (async () => {
        if (newSession && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
          const { data } = await supabase
            .from('users')
            .select('id, role, name, avatar_url, onboarding_complete')
            .eq('id', newSession.user.id)
            .single();
          setProfile(
            data
              ? {
                  id: data.id,
                  role: data.role ?? null,
                  name: data.name ?? null,
                  avatarUrl: data.avatar_url ?? null,
                  onboardingComplete: data.onboarding_complete ?? false,
                }
              : null
          );
        } else if (!newSession) {
          setProfile(null);
        }
        setProfileLoaded(true);
        if (event === 'INITIAL_SESSION') setInitialized(true);
      })();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (initialized) {
      SplashScreen.hideAsync();
    }
  }, [initialized]);

  useEffect(() => {
    if (!navigationState?.key || !initialized || !profileLoaded) return;

    const inOnboarding = segments[0] === 'onboarding';

    if (!session) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if (!profile?.role) {
      router.replace('/onboarding/role');
    } else if (!profile.onboardingComplete) {
      router.replace('/onboarding/profile');
    } else if (inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [session, initialized, profileLoaded, profile, segments, navigationState?.key]);

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
