import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';

const STATS = [
  { value: '66%', label: 'of parents feel isolated and lonely' },
  { value: '73%', label: 'of adults wish they talked to family more often' },
  { value: '4 in 10', label: 'adults aged 45+ experience loneliness' },
];

const AVATARS = [
  { initials: 'M', color: C.coral, label: 'Mom' },
  { initials: 'D', color: C.amber, label: 'Dad' },
  { initials: 'S', color: C.lavender, label: 'Sister' },
  { initials: 'B', color: C.green, label: 'Best Friend' },
];

export default function ProblemScreen() {
  const router = useRouter();
  const fadeAnims = AVATARS.map(() => useRef(new Animated.Value(1)).current);

  useEffect(() => {
    // Staggered fade in/out for avatars to show loneliness
    AVATARS.forEach((_, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.timing(fadeAnims[i], {
            toValue: 0.15,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnims[i], {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={2}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        {/* Fading avatars */}
        <View style={styles.avatarRow}>
          {AVATARS.map((av, i) => (
            <Animated.View key={av.label} style={[styles.avatarWrap, { opacity: fadeAnims[i] }]}>
              <View style={[styles.avatar, { backgroundColor: av.color + '33', borderColor: av.color }]}>
                <Text style={[styles.avatarInitials, { color: av.color }]}>{av.initials}</Text>
              </View>
              <Text style={styles.avatarLabel}>{av.label}</Text>
            </Animated.View>
          ))}
        </View>

        {/* Headline */}
        <View style={styles.textBlock}>
          <Text style={styles.heading}>Distance is growing.</Text>
          <Text style={styles.subheading}>
            The people who matter most feel further away every year — not because you don't care, but because life gets in the way.
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          {STATS.map((s) => (
            <View key={s.value} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Source note */}
        <Text style={styles.source}>
          Ohio State University, 2024 · AARP Loneliness Report, 2025 · US Surgeon General
        </Text>
      </View>

      {/* Next button */}
      <View style={styles.footer}>
        <Text
          style={styles.nextBtn}
          onPress={() => router.push('/onboarding/step3')}
        >
          There's a better way →
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 28 },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 8,
  },
  avatarWrap: { alignItems: 'center', gap: 6 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontSize: 20, fontWeight: '700' },
  avatarLabel: { fontSize: 11, color: C.textMuted },
  textBlock: { gap: 12 },
  heading: {
    fontSize: 30,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 16,
    color: C.textMuted,
    lineHeight: 25,
  },
  statsContainer: { gap: 10 },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: C.coral,
    minWidth: 68,
  },
  statLabel: {
    flex: 1,
    fontSize: 14,
    color: C.textMuted,
    lineHeight: 20,
  },
  source: {
    fontSize: 11,
    color: C.textSubtle,
    textAlign: 'center',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    alignItems: 'center',
  },
  nextBtn: {
    fontSize: 17,
    fontWeight: '700',
    color: C.coral,
  },
});
