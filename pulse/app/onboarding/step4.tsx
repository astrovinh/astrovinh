import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';

const STEPS = [
  {
    number: '1',
    emoji: '👥',
    title: 'Add your people',
    desc: 'Choose the family and close friends you want to stay connected with.',
    color: C.coral,
  },
  {
    number: '2',
    emoji: '👆',
    title: 'Tap once to pulse',
    desc: 'Open the app and tap the Pulse button. Takes less than 3 seconds.',
    color: C.amber,
  },
  {
    number: '3',
    emoji: '💛',
    title: 'They feel the love',
    desc: 'Your people see a warm signal on their home screen widget instantly.',
    color: C.lavender,
  },
];

export default function HowItWorksScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={4}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        {/* Headline */}
        <View style={styles.textBlock}>
          <Text style={styles.heading}>How it works</Text>
          <Text style={styles.subheading}>
            Three steps. Three seconds. And the people you love know you care.
          </Text>
        </View>

        {/* Steps */}
        <View style={styles.steps}>
          {STEPS.map((step, i) => (
            <View key={step.number}>
              <View style={styles.stepRow}>
                {/* Number badge */}
                <View style={[styles.numberBadge, { backgroundColor: step.color + '22', borderColor: step.color }]}>
                  <Text style={[styles.numberText, { color: step.color }]}>{step.number}</Text>
                </View>

                {/* Content */}
                <View style={styles.stepContent}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepEmoji}>{step.emoji}</Text>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={styles.stepDesc}>{step.desc}</Text>
                </View>
              </View>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Effort comparison */}
        <View style={styles.comparisonCard}>
          <Text style={styles.comparisonTitle}>Effort of a like. Weight of a call.</Text>
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonTime}>0.5s</Text>
              <Text style={styles.comparisonLabel}>Like a post</Text>
              <Text style={styles.comparisonImpact}>Minimal</Text>
            </View>
            <View style={styles.comparisonDivider} />
            <View style={[styles.comparisonItem, styles.comparisonHighlight]}>
              <Text style={[styles.comparisonTime, { color: C.coral }]}>2–3s</Text>
              <Text style={[styles.comparisonLabel, { color: C.textPrimary }]}>Send a Pulse</Text>
              <Text style={[styles.comparisonImpact, { color: C.coral }]}>High 💛</Text>
            </View>
            <View style={styles.comparisonDivider} />
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonTime}>15min</Text>
              <Text style={styles.comparisonLabel}>Phone call</Text>
              <Text style={styles.comparisonImpact}>High (rare)</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step5')}
        >
          <Text style={styles.primaryBtnText}>What families say →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 28 },
  textBlock: { gap: 10 },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subheading: { fontSize: 16, color: C.textMuted, lineHeight: 24 },
  steps: { gap: 0 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  numberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  numberText: { fontSize: 18, fontWeight: '800' },
  stepContent: { flex: 1, gap: 4 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepEmoji: { fontSize: 20 },
  stepTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary },
  stepDesc: { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  connector: { paddingLeft: 19, paddingVertical: 8 },
  connectorLine: { width: 2, height: 24, backgroundColor: C.cardBorder },
  comparisonCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 14,
  },
  comparisonTitle: { fontSize: 15, fontWeight: '600', color: C.textPrimary, textAlign: 'center' },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  comparisonItem: { flex: 1, alignItems: 'center', gap: 4 },
  comparisonHighlight: {
    borderWidth: 1,
    borderColor: C.coral + '44',
    borderRadius: 10,
    padding: 8,
    backgroundColor: C.coral + '11',
  },
  comparisonDivider: { width: 1, height: 48, backgroundColor: C.cardBorder },
  comparisonTime: { fontSize: 16, fontWeight: '800', color: C.textMuted },
  comparisonLabel: { fontSize: 12, color: C.textMuted, textAlign: 'center' },
  comparisonImpact: { fontSize: 12, color: C.textSubtle, fontWeight: '600' },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
