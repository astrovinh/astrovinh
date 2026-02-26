import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { useOnboardingStore } from '../../stores/onboardingStore';

export default function WidgetScreen() {
  const router = useRouter();
  const { selectedContacts } = useOnboardingStore();

  const displayContacts = selectedContacts.slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={11}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.content}>
        <View style={styles.textBlock}>
          <Text style={styles.heading}>Never miss a moment</Text>
          <Text style={styles.subheading}>
            Add Pulse to your home screen. See pulses from your people at a glance — without opening the app.
          </Text>
        </View>

        {/* Widget preview — large */}
        <View style={styles.phoneFrame}>
          <View style={styles.phoneMockup}>
            {/* Status bar */}
            <View style={styles.statusBar}>
              <Text style={styles.statusTime}>9:41</Text>
              <View style={styles.statusIcons}>
                <Text style={styles.statusIcon}>▶▶ ● ■</Text>
              </View>
            </View>

            {/* Widget mockup */}
            <View style={styles.widgetLarge}>
              <View style={styles.widgetHeader}>
                <Text style={styles.widgetApp}>💛 Pulse</Text>
                <Text style={styles.widgetTime}>Just now</Text>
              </View>

              <View style={styles.widgetPeople}>
                {displayContacts.length > 0 ? (
                  displayContacts.map((c) => (
                    <View key={c.id} style={styles.widgetPerson}>
                      <View style={[styles.widgetAvatar, { backgroundColor: c.color + '33', borderColor: c.color }]}>
                        <Text style={[styles.widgetInitials, { color: c.color }]}>{c.initials}</Text>
                      </View>
                      <View style={[styles.widgetGlow, { backgroundColor: c.color }]} />
                      <Text style={styles.widgetName}>{c.name}</Text>
                    </View>
                  ))
                ) : (
                  ['Mom', 'Dad', 'Sis'].map((name, i) => {
                    const colors = [C.coral, C.amber, C.lavender];
                    const initials = name[0];
                    return (
                      <View key={name} style={styles.widgetPerson}>
                        <View style={[styles.widgetAvatar, { backgroundColor: colors[i] + '33', borderColor: colors[i] }]}>
                          <Text style={[styles.widgetInitials, { color: colors[i] }]}>{initials}</Text>
                        </View>
                        <View style={[styles.widgetGlow, { backgroundColor: colors[i] }]} />
                        <Text style={styles.widgetName}>{name}</Text>
                      </View>
                    );
                  })
                )}
              </View>

              <Text style={styles.widgetFooter}>Mom pulsed you · Tap to respond</Text>
            </View>

            {/* Small widget */}
            <View style={styles.widgetSmall}>
              <Text style={styles.widgetSmallEmoji}>💛</Text>
              <Text style={styles.widgetSmallText}>3 new pulses</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>How to add the widget</Text>
          {[
            'Long press on your home screen',
            'Tap the + button in the top corner',
            'Search for "Pulse" and add it',
          ].map((step, i) => (
            <View key={step} style={styles.instructionRow}>
              <View style={styles.instructionNumber}>
                <Text style={styles.instructionNum}>{i + 1}</Text>
              </View>
              <Text style={styles.instructionText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step12')}
        >
          <Text style={styles.primaryBtnText}>Continue →</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step12')}>
          <Text style={styles.skipText}>I'll do this later</Text>
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
  phoneFrame: { alignItems: 'center' },
  phoneMockup: {
    width: 240,
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: C.cardBorder,
    overflow: 'hidden',
    padding: 12,
    gap: 10,
  },
  statusBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  statusTime: { fontSize: 12, fontWeight: '700', color: C.textPrimary },
  statusIcons: {},
  statusIcon: { fontSize: 8, color: C.textMuted },
  widgetLarge: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgetApp: { fontSize: 12, fontWeight: '700', color: C.textPrimary },
  widgetTime: { fontSize: 10, color: C.textMuted },
  widgetPeople: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  widgetPerson: { alignItems: 'center', gap: 6 },
  widgetAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widgetInitials: { fontSize: 16, fontWeight: '700' },
  widgetGlow: { width: 8, height: 8, borderRadius: 4, opacity: 0.8 },
  widgetName: { fontSize: 10, color: C.textMuted },
  widgetFooter: { fontSize: 10, color: C.coral, textAlign: 'center' },
  widgetSmall: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  widgetSmallEmoji: { fontSize: 20 },
  widgetSmallText: { fontSize: 12, color: C.textPrimary, fontWeight: '600' },
  instructions: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  instructionsTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 4 },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.coral + '22',
    borderWidth: 1,
    borderColor: C.coral + '66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionNum: { fontSize: 12, fontWeight: '800', color: C.coral },
  instructionText: { flex: 1, fontSize: 14, color: C.textMuted },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
    gap: 14,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
  skipText: { fontSize: 14, color: C.textMuted },
});
