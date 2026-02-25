import { create } from 'zustand';

interface PulseNotification {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: PulseNotification[];
  unreadCount: number;
  setNotifications: (notifications: PulseNotification[]) => void;
  markAllRead: () => void;
  addNotification: (notification: PulseNotification) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({ notifications, unreadCount: notifications.filter((n) => !n.read).length }),
  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + (notification.read ? 0 : 1),
    })),
}));
