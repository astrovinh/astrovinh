import { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const ONBOARDING_KEY = 'pulse_onboarding_complete';

interface AuthState {
  session: Session | null;
  initialized: boolean;
  onboardingComplete: boolean;
  setSession: (session: Session | null) => void;
  setInitialized: (value: boolean) => void;
  completeOnboarding: () => Promise<void>;
  loadPersistedState: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  initialized: false,
  onboardingComplete: false,
  setSession: (session) => set({ session }),
  setInitialized: (initialized) => set({ initialized }),
  completeOnboarding: async () => {
    await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
    set({ onboardingComplete: true });
  },
  loadPersistedState: async () => {
    const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
    set({ onboardingComplete: val === '1' });
  },
}));
