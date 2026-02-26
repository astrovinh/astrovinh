import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';

const TESTIMONIALS = [
  {
    name: 'Sarah M.',
    role: 'Daughter, 28',
    avatar: 'S',
    avatarColor: C.coral,
    text: "I used to feel so guilty about not calling Mom enough. Now I send her a pulse every morning — takes 2 seconds. She lights up every time.",
    stars: 5,
  },
  {
    name: 'Robert K.',
    role: 'Father, 62',
    avatar: 'R',
    avatarColor: C.amber,
    text: "My kids live across the country. Pulse makes me feel close to them every single day. I look at my widget and smile knowing they're thinking of me.",
    stars: 5,
  },
  {
    name: 'Jamie L.',
    role: 'Friend group organizer, 34',
    avatar: 'J',
    avatarColor: C.lavender,
    text: "Our friend group drifted after we moved to different cities. Pulse brought us back together without the pressure of group chats. It's just warmth.",
    stars: 5,
  },
];

function Stars({ count }: { count: number }) {
  return (
    <Text style={{ fontSize: 14, color: C.amber }}>
      {'★'.repeat(count)}
    </Text>
  );
}

export default function SocialProofScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={5}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Rating overview */}
        <View style={styles.ratingOverview}>
          <Text style={styles.ratingNumber}>4.9</Text>
          <View style={styles.ratingRight}>
            <Stars count={5} />
            <Text style={styles.ratingSubtext}>App Store rating</Text>
            <Text style={styles.reviewCount}>Thousands of families connected</Text>
          </View>
        </View>

        {/* Testimonials */}
        <View style={styles.testimonials}>
          {TESTIMONIALS.map((t) => (
            <View key={t.name} style={styles.testimonialCard}>
              <View style={styles.testimonialHeader}>
                <View style={[styles.testimonialAvatar, { backgroundColor: t.avatarColor + '22', borderColor: t.avatarColor }]}>
                  <Text style={[styles.testimonialInitial, { color: t.avatarColor }]}>{t.avatar}</Text>
                </View>
                <View style={styles.testimonialMeta}>
                  <Text style={styles.testimonialName}>{t.name}</Text>
                  <Text style={styles.testimonialRole}>{t.role}</Text>
                </View>
                <Stars count={t.stars} />
              </View>
              <Text style={styles.testimonialText}>"{t.text}"</Text>
            </View>
          ))}
        </View>

        {/* Press mentions */}
        <View style={styles.pressRow}>
          <Text style={styles.pressLabel}>As seen in</Text>
          <View style={styles.pressPills}>
            {['TechCrunch', 'Product Hunt', 'Forbes'].map((p) => (
              <View key={p} style={styles.pressPill}>
                <Text style={styles.pressPillText}>{p}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step6')}
        >
          <Text style={styles.primaryBtnText}>Add My People →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 24 },
  ratingOverview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    gap: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  ratingNumber: { fontSize: 52, fontWeight: '800', color: C.textPrimary },
  ratingRight: { gap: 4 },
  ratingSubtext: { fontSize: 13, color: C.textMuted },
  reviewCount: { fontSize: 12, color: C.textSubtle },
  testimonials: { gap: 12 },
  testimonialCard: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  testimonialHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  testimonialAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testimonialInitial: { fontSize: 18, fontWeight: '700' },
  testimonialMeta: { flex: 1, gap: 2 },
  testimonialName: { fontSize: 15, fontWeight: '700', color: C.textPrimary },
  testimonialRole: { fontSize: 12, color: C.textMuted },
  testimonialText: { fontSize: 14, color: C.textMuted, lineHeight: 22, fontStyle: 'italic' },
  pressRow: { alignItems: 'center', gap: 10 },
  pressLabel: { fontSize: 12, color: C.textSubtle, textTransform: 'uppercase', letterSpacing: 1 },
  pressPills: { flexDirection: 'row', gap: 8 },
  pressPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  pressPillText: { fontSize: 13, color: C.textMuted, fontWeight: '500' },
  footer: { paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16 },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
