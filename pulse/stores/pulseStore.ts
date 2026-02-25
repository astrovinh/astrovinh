import { create } from 'zustand';

interface Pulse {
  id: string;
  userId: string;
  sentAt: string;
}

interface PulseState {
  pulses: Pulse[];
  lastPulseSentAt: string | null;
  setPulses: (pulses: Pulse[]) => void;
  addPulse: (pulse: Pulse) => void;
  setLastPulseSentAt: (sentAt: string | null) => void;
}

export const usePulseStore = create<PulseState>((set) => ({
  pulses: [],
  lastPulseSentAt: null,
  setPulses: (pulses) => set({ pulses }),
  addPulse: (pulse) => set((state) => ({ pulses: [pulse, ...state.pulses] })),
  setLastPulseSentAt: (lastPulseSentAt) => set({ lastPulseSentAt }),
}));
