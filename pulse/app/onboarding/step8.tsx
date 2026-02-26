import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';

const NOTIFICATION_PREVIEWS = [
  {
    emoji: '💛',
    title: 'Mom sent you a pulse',
    body: 'Tap to let her know you\'re here.',
    time: 'now',
  },
  {
    emoji: '🎉',
    title: '7 days of connection!',
    body: 'You and Dad have stayed close for a whole week.',
    time: '2m ago',
  },
  {
    emoji: '🌅',
    title: 'Good morning',
    body: 'A nice time to let your family know you care.',
    time: '9:02 AM',
  },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const { setNotificationsEnabled } = useOnboardingStore();

  async function handleEnableNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotificationsEnabled(status === 'granted');
    router.push('/onboarding/step9');
  }

  function handleSkipNotifications() {
    setNotificationsEnabled(false);
    router.push('/onboarding/step9');
  }

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={8}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.heading}>Stay in the loop</Text>
          <Text style={styles.subheading}>
            Pulse sends thoughtful reminders — not spam. We learn your rhythm and reach out at the right moment.
          </Text>
        </View>

        {/* Notification preview cards */}
        <View style={styles.previewStack}>
          {NOTIFICATION_PREVIEWS.map((n, i) => (
            <View
              key={n.title}
              style={[
                styles.notificationCard,
                i === 0 && styles.notificationCardTop,
                i === 1 && styles.notificationCardMid,
                i === 2 && styles.notificationCardBottom,
              ]}
            >
              <View style={styles.notifLeft}>
                <View style={styles.notifIconWrap}>
                  <Text style={styles.notifEmoji}>{n.emoji}</Text>
                </View>
                <View style={styles.notifText}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifBody}>{n.body}</Text>
                </View>
              </View>
              <Text style={styles.notifTime}>{n.time}</Text>
            </View>
          ))}
        </View>

        {/* Promise card */}
        <View style={styles.promiseCard}>
          <Text style={styles.promiseTitle}>Our promise to you</Text>
          <View style={styles.promiseList}>
            {[
              '✅  Max 3 notifications per day',
              '✅  Quiet hours 10pm – 7am',
              '✅  Fully customizable in settings',
              '✅  No marketing, no spam',
            ].map((p) => (
              <Text key={p} style={styles.promiseItem}>{p}</Text>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={handleEnableNotifications}>
          <Text style={styles.primaryBtnText}>Enable Notifications</Text>
        </Pressable>
        <Pressable onPress={handleSkipNotifications}>
          <Text style={styles.skipText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 24 },
  textBlock: { gap: 10 },
  heading: { fontSize: 30, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textMuted, lineHeight: 23 },
  previewStack: { gap: 8 },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  notificationCardTop: { borderColor: C.coral + '55' },
  notificationCardMid: { opacity: 0.85 },
  notificationCardBottom: { opacity: 0.65 },
  notifLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  notifIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifEmoji: { fontSize: 20 },
  notifText: { flex: 1, gap: 3 },
  notifTitle: { fontSize: 13, fontWeight: '700', color: C.textPrimary },
  notifBody: { fontSize: 12, color: C.textMuted, lineHeight: 17 },
  notifTime: { fontSize: 11, color: C.textSubtle },
  promiseCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  promiseTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  promiseList: { gap: 8 },
  promiseItem: { fontSize: 14, color: C.textMuted },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 14,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
  skipText: { fontSize: 15, color: C.textMuted, fontWeight: '500' },
});
