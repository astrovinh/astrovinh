import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';

const MILESTONES = [
  { days: 7, emoji: '🌱', label: '7 days', desc: 'A new habit takes root' },
  { days: 30, emoji: '🌿', label: '30 days', desc: 'They notice the difference' },
  { days: 100, emoji: '🌳', label: '100 days', desc: 'Connection becomes effortless' },
];

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function YourWeekScreen() {
  const router = useRouter();
  const { rhythm } = useOnboardingStore();

  const activeDay = (i: number) => {
    if (rhythm === 'multiple') return true;
    if (rhythm === 'daily') return i < 7;
    if (rhythm === 'few_days') return [0, 2, 4, 6].includes(i);
    return i === 0;
  };

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={10}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.heading}>Your week, together</Text>
          <Text style={styles.subheading}>
            Not a score. Not a streak to stress over. Just a quiet reminder of your connection rhythm.
          </Text>
        </View>

        {/* Week view */}
        <View style={styles.weekCard}>
          <Text style={styles.weekLabel}>This week</Text>
          <View style={styles.weekRow}>
            {DAYS.map((day, i) => (
              <View key={`${day}-${i}`} style={styles.dayColumn}>
                <View style={[styles.dayDot, activeDay(i) && styles.dayDotActive]}>
                  {activeDay(i) && <Text style={styles.dayDotEmoji}>💛</Text>}
                </View>
                <Text style={styles.dayLabel}>{day}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.weekSubtext}>
            {rhythm === 'daily'
              ? '6 pulses this week · keep it going!'
              : rhythm === 'multiple'
              ? 'Every day this week · you\'re amazing!'
              : rhythm === 'few_days'
              ? '4 pulses this week · great start!'
              : '1 pulse this week · a small gesture, big impact'}
          </Text>
        </View>

        {/* Milestones */}
        <View style={styles.milestonesSection}>
          <Text style={styles.milestonesTitle}>Milestones to celebrate</Text>
          <View style={styles.milestones}>
            {MILESTONES.map((m) => (
              <View key={m.days} style={styles.milestoneCard}>
                <Text style={styles.milestoneEmoji}>{m.emoji}</Text>
                <View style={styles.milestoneText}>
                  <Text style={styles.milestoneLabel}>{m.label}</Text>
                  <Text style={styles.milestoneDesc}>{m.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Encouragement */}
        <View style={styles.encourageCard}>
          <Text style={styles.encourageText}>
            "You and Mom have stayed close for{' '}
            <Text style={{ color: C.coral, fontWeight: '700' }}>7 days</Text>
            . That's something special. 💛"
          </Text>
          <Text style={styles.encourageSource}>— Pulse, on your 7-day milestone</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step11')}
        >
          <Text style={styles.primaryBtnText}>Set Up Your Widget →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 22 },
  textBlock: { gap: 10 },
  heading: { fontSize: 30, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textMuted, lineHeight: 22 },
  weekCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  weekLabel: { fontSize: 13, color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center', gap: 6 },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotActive: { backgroundColor: C.coral + '33' },
  dayDotEmoji: { fontSize: 16 },
  dayLabel: { fontSize: 11, color: C.textSubtle },
  weekSubtext: { fontSize: 13, color: C.coral, fontWeight: '500', textAlign: 'center' },
  milestonesSection: { gap: 12 },
  milestonesTitle: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  milestones: { flexDirection: 'row', gap: 10 },
  milestoneCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
  },
  milestoneEmoji: { fontSize: 28 },
  milestoneText: { alignItems: 'center', gap: 4 },
  milestoneLabel: { fontSize: 14, fontWeight: '700', color: C.textPrimary },
  milestoneDesc: { fontSize: 11, color: C.textMuted, textAlign: 'center', lineHeight: 16 },
  encourageCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: C.coral + '33',
    borderLeftWidth: 3,
    borderLeftColor: C.coral,
  },
  encourageText: { fontSize: 15, color: C.textMuted, lineHeight: 22, fontStyle: 'italic' },
  encourageSource: { fontSize: 12, color: C.textSubtle },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
