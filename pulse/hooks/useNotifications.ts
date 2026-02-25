import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';

export function useNotifications() {
  const session = useAuthStore((s) => s.session);
  const { setNotifications, addNotification, unreadCount } = useNotificationStore();

  useEffect(() => {
    if (!session?.user.id) return;

    async function fetchNotifications() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session!.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setNotifications(
          data.map((n: any) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            receivedAt: n.created_at,
            read: n.read,
          }))
        );
      }
    }

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          const n = payload.new as any;
          addNotification({ id: n.id, title: n.title, body: n.body, receivedAt: n.created_at, read: false });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user.id]);

  return { unreadCount };
}
