import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

interface Connection {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function useConnections() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session?.user.id) return;

    async function fetchConnections() {
      setLoading(true);
      const { data } = await supabase
        .from('connections')
        .select('id, connected_user_id, profiles(display_name, avatar_url)')
        .eq('user_id', session!.user.id)
        .eq('status', 'accepted');

      if (data) {
        setConnections(
          data.map((c: any) => ({
            id: c.id,
            userId: c.connected_user_id,
            displayName: c.profiles?.display_name ?? null,
            avatarUrl: c.profiles?.avatar_url ?? null,
          }))
        );
      }
      setLoading(false);
    }

    fetchConnections();
  }, [session?.user.id]);

  return { connections, loading };
}
