import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function FirstPulseScreen() {
  const router = useRouter();
  const { setPulseSent, selectedContacts } = useOnboardingStore();
  const [pulsed, setPulsed] = useState(false);

  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;

  function animatePulse() {
    const ringAnimation = (anim: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]);

    Animated.sequence([
      // Button press down
      Animated.timing(buttonScale, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      // Button release
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      // Rings expand
      Animated.parallel([
        ringAnimation(ring1, 0),
        ringAnimation(ring2, 180),
        ringAnimation(ring3, 360),
      ]),
      // Celebration fade in
      Animated.timing(celebrateOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function handlePulse() {
    if (pulsed) return;
    setPulsed(true);
    setPulseSent(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animatePulse();
    // Second haptic for confirmation
    setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 600);
  }

  const ringScale = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] });
  const ringOpacity = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.3, 0] });

  const firstName = selectedContacts[0]?.name ?? 'your people';

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={9}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.heading}>
            {pulsed ? 'They felt it. 💛' : 'Send your first pulse'}
          </Text>
          <Text style={styles.subheading}>
            {pulsed
              ? `${firstName} just felt a warm signal from you.`
              : `Tap the button below. It takes 2 seconds. ${firstName} will love it.`}
          </Text>
        </View>

        {/* Pulse button with rings */}
        <View style={styles.pulseArea}>
          {/* Expanding rings */}
          {[ring1, ring2, ring3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  transform: [{ scale: ringScale(anim) }],
                  opacity: ringOpacity(anim),
                },
              ]}
            />
          ))}

          {/* Center button */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <Pressable
              style={[styles.pulseBtn, pulsed && styles.pulseBtnSent]}
              onPress={handlePulse}
              disabled={pulsed}
            >
              <Text style={styles.pulseBtnEmoji}>{pulsed ? '💛' : '👆'}</Text>
              <Text style={styles.pulseBtnLabel}>{pulsed ? 'Sent!' : 'Pulse'}</Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Celebration message */}
        <Animated.View style={[styles.celebrationCard, { opacity: celebrateOpacity }]}>
          <Text style={styles.celebrationEmoji}>🎉</Text>
          <Text style={styles.celebrationText}>
            That felt good, right? Imagine doing that every morning for 100 days.
          </Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        {pulsed ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/onboarding/step10')}
          >
            <Text style={styles.primaryBtnText}>See Your Rhythm →</Text>
          </Pressable>
        ) : (
          <Text style={styles.hintText}>Tap the button above to continue</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 8, gap: 32, alignItems: 'center' },
  textBlock: { gap: 10, alignItems: 'center' },
  heading: { fontSize: 30, fontWeight: '800', color: C.textPrimary, textAlign: 'center', letterSpacing: -0.5 },
  subheading: { fontSize: 16, color: C.textMuted, lineHeight: 24, textAlign: 'center' },
  pulseArea: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: C.coral,
  },
  pulseBtn: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: C.coral,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  pulseBtnSent: { backgroundColor: C.green },
  pulseBtnEmoji: { fontSize: 30 },
  pulseBtnLabel: { fontSize: 13, fontWeight: '700', color: C.white },
  celebrationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.coral + '44',
    width: '100%',
  },
  celebrationEmoji: { fontSize: 24 },
  celebrationText: { flex: 1, fontSize: 15, color: C.textMuted, lineHeight: 22 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
  hintText: { fontSize: 14, color: C.textSubtle },
});
