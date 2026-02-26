import { create } from 'zustand';

export interface OnboardingContact {
  id: string;
  name: string;
  initials: string;
  color: string;
}

export type RhythmOption = 'multiple' | 'daily' | 'few_days' | 'weekly';

interface OnboardingState {
  selectedContacts: OnboardingContact[];
  rhythm: RhythmOption;
  notificationsEnabled: boolean;
  pulseSent: boolean;
  setSelectedContacts: (contacts: OnboardingContact[]) => void;
  toggleContact: (contact: OnboardingContact) => void;
  setRhythm: (rhythm: RhythmOption) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setPulseSent: (sent: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  selectedContacts: [],
  rhythm: 'daily',
  notificationsEnabled: false,
  pulseSent: false,
  setSelectedContacts: (contacts) => set({ selectedContacts: contacts }),
  toggleContact: (contact) => {
    const existing = get().selectedContacts;
    const isSelected = existing.some((c) => c.id === contact.id);
    set({
      selectedContacts: isSelected
        ? existing.filter((c) => c.id !== contact.id)
        : [...existing, contact],
    });
  },
  setRhythm: (rhythm) => set({ rhythm }),
  setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
  setPulseSent: (sent) => set({ pulseSent: sent }),
}));
