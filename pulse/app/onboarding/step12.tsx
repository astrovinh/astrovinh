import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';

// expo-store-review is not in this project's dependencies.
// The UI is fully implemented; the native rating call is a no-op stub.
function requestStoreReview() {
  // When expo-store-review is added: StoreReview.requestReview()
}

function Stars() {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={styles.star}>★</Text>
      ))}
    </View>
  );
}

export default function AppRatingScreen() {
  const router = useRouter();

  function handleRate() {
    requestStoreReview();
    router.push('/onboarding/step13');
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* No OnboardingHeader — just a "Not now" link per PRD */}
      <View style={styles.content}>
        <View style={styles.illustrationArea}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconEmoji}>💛</Text>
          </View>
          <Stars />
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.heading}>Help more families stay connected</Text>
          <Text style={styles.subheading}>
            Your review helps other parents and adult children discover Pulse. It takes 5 seconds and means the world to us.
          </Text>
        </View>

        {/* Impact stats */}
        <View style={styles.statsRow}>
          {[
            { value: '4.9★', label: 'App Store' },
            { value: '10K+', label: 'Families' },
            { value: '1M+', label: 'Pulses sent' },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteText}>
            "Because of Pulse, I hear from my son every single day now. It changed everything."
          </Text>
          <Text style={styles.quoteName}>— Margaret, 68, Ohio</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={handleRate}>
          <Text style={styles.primaryBtnText}>Rate Pulse ★★★★★</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step13')}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 28,
    alignItems: 'center',
  },
  illustrationArea: { alignItems: 'center', gap: 16 },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.coral + '22',
    borderWidth: 2,
    borderColor: C.coral + '55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 50 },
  starsRow: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 34, color: C.amber },
  textBlock: { alignItems: 'center', gap: 12 },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: C.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 23,
    textAlign: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statValue: { fontSize: 18, fontWeight: '800', color: C.coral },
  statLabel: { fontSize: 11, color: C.textMuted },
  quoteCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  quoteText: { fontSize: 14, color: C.textMuted, lineHeight: 22, fontStyle: 'italic' },
  quoteName: { fontSize: 12, color: C.textSubtle, fontWeight: '600' },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: C.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.black, fontSize: 17, fontWeight: '800' },
  notNowText: { fontSize: 15, color: C.textMuted },
});
