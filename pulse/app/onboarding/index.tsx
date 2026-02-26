import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // Continuous pulse ring animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.4,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo / pulse animation */}
        <View style={styles.logoArea}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }], opacity: 0.15 },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing2,
              { transform: [{ scale: pulseAnim }], opacity: 0.08 },
            ]}
          />
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>💛</Text>
          </View>
        </View>

        {/* Headline */}
        <View style={styles.textArea}>
          <Text style={styles.appName}>Pulse</Text>
          <Text style={styles.tagline}>Connection, simplified.</Text>
          <Text style={styles.subtitle}>
            Stay close to the people who matter most — no calls, no texts required. Just one tap.
          </Text>
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => router.push('/onboarding/step2')}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/onboarding/login')}
          >
            <Text style={styles.secondaryBtnText}>
              Already have an account?{' '}
              <Text style={styles.secondaryBtnBold}>Sign in</Text>
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
  },
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 180,
    height: 180,
    marginTop: 24,
  },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.coral,
  },
  pulseRing2: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.coral,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: C.surface,
    borderWidth: 2,
    borderColor: C.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: {
    fontSize: 42,
  },
  textArea: {
    alignItems: 'center',
    gap: 12,
  },
  appName: {
    fontSize: 44,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: C.coral,
  },
  subtitle: {
    fontSize: 16,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  ctas: {
    width: '100%',
    gap: 16,
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryBtnText: {
    color: C.textMuted,
    fontSize: 15,
  },
  secondaryBtnBold: {
    color: C.textPrimary,
    fontWeight: '600',
  },
});
