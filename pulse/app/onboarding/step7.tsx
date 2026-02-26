import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { RhythmOption, useOnboardingStore } from '../../stores/onboardingStore';

const RHYTHM_OPTIONS: { value: RhythmOption; label: string; sub: string; recommended?: boolean }[] = [
  {
    value: 'multiple',
    label: 'Multiple times a day',
    sub: 'Send a pulse whenever you think of them',
  },
  {
    value: 'daily',
    label: 'Once a day',
    sub: 'A morning or evening ritual — most popular',
    recommended: true,
  },
  {
    value: 'few_days',
    label: 'Every few days',
    sub: 'A gentle rhythm, easy to maintain',
  },
  {
    value: 'weekly',
    label: 'Once a week',
    sub: 'A Sunday evening check-in',
  },
];

export default function SetRhythmScreen() {
  const router = useRouter();
  const { rhythm, setRhythm } = useOnboardingStore();

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={7}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.heading}>How often do you want to connect?</Text>
          <Text style={styles.subheading}>
            We'll send gentle reminders to match your rhythm. You can change this anytime.
          </Text>
        </View>

        <View style={styles.options}>
          {RHYTHM_OPTIONS.map((opt) => {
            const selected = rhythm === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[
                  styles.optionCard,
                  selected && styles.optionCardSelected,
                  opt.recommended && !selected && styles.optionCardRecommended,
                ]}
                onPress={() => setRhythm(opt.value)}
              >
                <View style={styles.optionLeft}>
                  <Text style={[styles.optionLabel, selected && { color: C.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.optionSub, selected && { color: C.textMuted }]}>
                    {opt.sub}
                  </Text>
                </View>
                <View style={styles.optionRight}>
                  {opt.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Popular</Text>
                    </View>
                  )}
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Visual habit preview */}
        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>Your week could look like this</Text>
          <View style={styles.weekDots}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
              const active = rhythm === 'multiple'
                ? true
                : rhythm === 'daily'
                ? i < 6
                : rhythm === 'few_days'
                ? [0, 2, 4, 6].includes(i)
                : i === 0;
              return (
                <View key={`${day}-${i}`} style={styles.dotWrap}>
                  <View style={[styles.dot, active && styles.dotActive]} />
                  <Text style={styles.dotLabel}>{day}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step8')}
        >
          <Text style={styles.primaryBtnText}>Set My Rhythm →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 24 },
  textBlock: { gap: 10 },
  heading: { fontSize: 27, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textMuted, lineHeight: 22 },
  options: { gap: 10 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: C.cardBorder,
  },
  optionCardSelected: { borderColor: C.coral, backgroundColor: C.coral + '11' },
  optionCardRecommended: { borderColor: C.amber + '66' },
  optionLeft: { flex: 1, gap: 4 },
  optionLabel: { fontSize: 16, fontWeight: '600', color: C.textMuted },
  optionSub: { fontSize: 13, color: C.textSubtle, lineHeight: 18 },
  optionRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recommendedBadge: {
    backgroundColor: C.amber + '22',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: C.amber + '55',
  },
  recommendedText: { fontSize: 11, color: C.amber, fontWeight: '600' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: C.coral },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.coral },
  previewCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  previewTitle: { fontSize: 14, color: C.textMuted, textAlign: 'center' },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  dotWrap: { alignItems: 'center', gap: 6 },
  dot: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.card },
  dotActive: { backgroundColor: C.coral },
  dotLabel: { fontSize: 11, color: C.textSubtle },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
