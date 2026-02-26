import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';

const FEATURES = [
  {
    emoji: '👆',
    title: 'One tap',
    desc: "Open the app, tap once. Your people know you're thinking of them.",
  },
  {
    emoji: '💛',
    title: 'Feels warm',
    desc: 'A private, intentional signal — not a like, not a post. Just love.',
  },
  {
    emoji: '⚡',
    title: 'Instant',
    desc: 'They see it on their home screen widget the moment you send it.',
  },
  {
    emoji: '🙌',
    title: 'No pressure',
    desc: "You never have to say anything. A tap says it all. Tap back if you'd like.",
  },
];

const CONNECTED_AVATARS = [
  { initials: 'M', color: C.coral, x: -60, y: -20 },
  { initials: 'D', color: C.amber, x: 60, y: -20 },
  { initials: 'S', color: C.lavender, x: -30, y: 50 },
];

export default function SolutionScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={3}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Connected avatars illustration */}
        <View style={styles.illustration}>
          <View style={styles.centerAvatar}>
            <Text style={styles.centerEmoji}>💛</Text>
          </View>
          {CONNECTED_AVATARS.map((av) => (
            <View
              key={av.initials}
              style={[
                styles.orbitAvatar,
                { backgroundColor: av.color + '22', borderColor: av.color },
                { transform: [{ translateX: av.x }, { translateY: av.y }] },
              ]}
            >
              <Text style={[styles.orbitInitials, { color: av.color }]}>{av.initials}</Text>
            </View>
          ))}
          {/* Connection lines (visual only) */}
          <View style={styles.connLine1} />
          <View style={styles.connLine2} />
          <View style={styles.connLine3} />
        </View>

        {/* Headline */}
        <Text style={styles.heading}>
          The gap between silence and a full conversation.
        </Text>
        <Text style={styles.subheading}>
          Pulse lives in that gap. Effortless enough for every day. Meaningful enough to matter.
        </Text>

        {/* Feature cards */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step4')}
        >
          <Text style={styles.primaryBtnText}>See How It Works</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 24 },
  illustration: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.coral + '33',
    borderWidth: 2,
    borderColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  centerEmoji: { fontSize: 32 },
  orbitAvatar: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  orbitInitials: { fontSize: 18, fontWeight: '700' },
  connLine1: {
    position: 'absolute',
    width: 80,
    height: 1,
    backgroundColor: C.coral + '44',
    transform: [{ rotate: '-20deg' }, { translateX: -40 }],
  },
  connLine2: {
    position: 'absolute',
    width: 80,
    height: 1,
    backgroundColor: C.amber + '44',
    transform: [{ rotate: '20deg' }, { translateX: 40 }],
  },
  connLine3: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: C.lavender + '44',
    transform: [{ rotate: '75deg' }, { translateY: 20 }],
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: C.textPrimary,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 16,
    color: C.textMuted,
    lineHeight: 25,
    marginTop: -8,
  },
  features: { gap: 12 },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  featureEmoji: { fontSize: 26, marginTop: 2 },
  featureText: { flex: 1, gap: 4 },
  featureTitle: { fontSize: 16, fontWeight: '700', color: C.textPrimary },
  featureDesc: { fontSize: 14, color: C.textMuted, lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
