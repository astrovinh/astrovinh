import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

export interface Profile {
  id: string;
  role: 'parent' | 'child' | null;
  name: string | null;
  avatarUrl: string | null;
  onboardingComplete: boolean;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  initialized: boolean;
  profileLoaded: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setInitialized: (value: boolean) => void;
  setProfileLoaded: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  initialized: false,
  profileLoaded: false,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setInitialized: (initialized) => set({ initialized }),
  setProfileLoaded: (profileLoaded) => set({ profileLoaded }),
}));
