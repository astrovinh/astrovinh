import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { usePulseStore } from '../stores/pulseStore';
import { useAuthStore } from '../stores/authStore';

export function usePulse() {
  const [sending, setSending] = useState(false);
  const { addPulse, setLastPulseSentAt } = usePulseStore();
  const session = useAuthStore((s) => s.session);

  const sendPulse = useCallback(
    async (connectionId: string) => {
      if (!session?.user.id) return;
      setSending(true);
      try {
        const { data, error } = await supabase
          .from('pulses')
          .insert({ sender_id: session.user.id, receiver_id: connectionId })
          .select()
          .single();
        if (error) throw error;
        addPulse({ id: data.id, userId: data.sender_id, sentAt: data.created_at });
        setLastPulseSentAt(data.created_at);
      } finally {
        setSending(false);
      }
    },
    [session]
  );

  return { sendPulse, sending };
}
