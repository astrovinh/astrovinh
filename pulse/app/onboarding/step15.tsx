import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';
import { useAuthStore } from '../../stores/authStore';
import { useOnboardingStore } from '../../stores/onboardingStore';

// Confetti particle config
const PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  color: [C.coral, C.amber, C.lavender, C.green, C.blue, C.rose][i % 6],
  x: Math.random() * 340 - 170,
  delay: Math.random() * 600,
  size: 8 + Math.random() * 8,
}));

function ConfettiParticle({ color, x, delay, size }: { color: string; x: number; delay: number; size: number }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 500, duration: 2000, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 1, duration: 2000, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 4,
          transform: [{ translateX: x }, { translateY }, { rotate: spin }],
          opacity,
        },
      ]}
    />
  );
}

export default function CelebrationScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const { selectedContacts, rhythm } = useOnboardingStore();
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(contentScale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  async function handleEnterApp() {
    await completeOnboarding();
    router.replace('/(tabs)');
  }

  const rhythmLabel =
    rhythm === 'daily'
      ? 'Daily connection'
      : rhythm === 'multiple'
      ? 'Multiple times a day'
      : rhythm === 'few_days'
      ? 'Every few days'
      : 'Weekly connection';

  return (
    <SafeAreaView style={styles.container}>
      {/* Confetti */}
      <View style={styles.confettiContainer} pointerEvents="none">
        {PARTICLES.map((p) => (
          <ConfettiParticle key={p.id} color={p.color} x={p.x} delay={p.delay} size={p.size} />
        ))}
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: contentOpacity, transform: [{ scale: contentScale }] },
        ]}
      >
        {/* Hero */}
        <View style={styles.heroArea}>
          <Text style={styles.heroEmoji}>🎉</Text>
          <Text style={styles.heading}>You're all set!</Text>
          <Text style={styles.subheading}>
            Welcome to Pulse. The people who matter most are just a tap away.
          </Text>
        </View>

        {/* Setup summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Your setup</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryEmoji}>👥</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Your circle</Text>
              <Text style={styles.summaryValue}>
                {selectedContacts.length > 0
                  ? selectedContacts.map((c) => c.name).join(', ')
                  : 'You can add people in the app'}
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryEmoji}>🔔</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>Your rhythm</Text>
              <Text style={styles.summaryValue}>{rhythmLabel}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryRow}>
            <Text style={styles.summaryEmoji}>💛</Text>
            <View style={styles.summaryText}>
              <Text style={styles.summaryLabel}>First pulse</Text>
              <Text style={styles.summaryValue}>Sent ✓</Text>
            </View>
          </View>
        </View>

        {/* Encouragement */}
        <View style={styles.encourageCard}>
          <Text style={styles.encourageText}>
            "In 7 days you'll feel the difference. In 30 days, so will they."
          </Text>
        </View>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={handleEnterApp}>
          <Text style={styles.primaryBtnText}>Start Connecting 💛</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: '50%',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 24,
    zIndex: 1,
  },
  heroArea: { alignItems: 'center', gap: 14 },
  heroEmoji: { fontSize: 72 },
  heading: {
    fontSize: 36,
    fontWeight: '800',
    color: C.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 16,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: C.coral + '44',
  },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  summaryEmoji: { fontSize: 22, marginTop: 2 },
  summaryText: { flex: 1, gap: 3 },
  summaryLabel: { fontSize: 12, color: C.textSubtle, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 14, color: C.textPrimary, fontWeight: '500', lineHeight: 20 },
  summaryDivider: { height: 1, backgroundColor: C.cardBorder },
  encourageCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderLeftWidth: 3,
    borderLeftColor: C.coral,
  },
  encourageText: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    zIndex: 1,
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  primaryBtnText: { color: C.white, fontSize: 18, fontWeight: '800' },
});
