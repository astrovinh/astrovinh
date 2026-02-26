import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors as C } from '../constants/theme';

interface Props {
  step: number;
  totalSteps?: number;
  onBack?: () => void;
  onSkip?: () => void;
  skipLabel?: string;
}

export default function OnboardingHeader({
  step,
  totalSteps = 12,
  onBack,
  onSkip,
  skipLabel = 'Skip',
}: Props) {
  const progress = step / totalSteps;

  return (
    <View style={styles.container}>
      {/* Back button */}
      <Pressable
        style={styles.backBtn}
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {onBack ? (
          <Text style={styles.backText}>←</Text>
        ) : (
          <View style={styles.placeholder} />
        )}
      </Pressable>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Skip / action button */}
      <Pressable
        style={styles.skipBtn}
        onPress={onSkip}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {onSkip ? (
          <Text style={styles.skipText}>{skipLabel}</Text>
        ) : (
          <View style={styles.placeholder} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 22,
    color: C.textMuted,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: C.card,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.coral,
    borderRadius: 99,
  },
  skipBtn: {
    width: 40,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 14,
    color: C.textMuted,
    fontWeight: '500',
  },
  placeholder: {
    width: 36,
  },
});
