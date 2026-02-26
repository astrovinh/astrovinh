import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';

type Plan = 'annual' | 'monthly';

const FREE_FEATURES = [
  'Send unlimited pulses',
  'Up to 5 close contacts',
  '4 emoji reactions',
  'Your Week rhythm view',
  '1 daily reminder',
  'Home screen widget',
];

const PLUS_FEATURES = [
  'Everything in Free',
  'Unlimited contacts',
  'Share Tray: Mood, Photo, Voice, Note',
  'Family Moments feed',
  'AI conversation starters',
  'Connection milestones (7, 30, 100 days)',
  'Full AI notifications (6 types)',
  'Custom pulse styles & animations',
  'Weekly reflection summary',
  'Priority alerts with avatar + haptics',
];

export default function PaywallScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>('annual');

  const price = plan === 'annual' ? '$29.99/year' : '$5.99/month';
  const pricePerMonth = plan === 'annual' ? '$2.50/mo' : '$5.99/mo';
  const savings = plan === 'annual' ? 'SAVE 58%' : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>7-DAY FREE TRIAL</Text>
          </View>
          <Text style={styles.heading}>Upgrade to Pulse+</Text>
          <Text style={styles.subheading}>
            The full experience for families who never want to miss a moment.
          </Text>
        </View>

        {/* Plan toggle */}
        <View style={styles.toggleContainer}>
          <Pressable
            style={[styles.toggleBtn, plan === 'annual' && styles.toggleBtnActive]}
            onPress={() => setPlan('annual')}
          >
            <Text style={[styles.toggleLabel, plan === 'annual' && styles.toggleLabelActive]}>
              Annual
            </Text>
            {savings && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>{savings}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, plan === 'monthly' && styles.toggleBtnActive]}
            onPress={() => setPlan('monthly')}
          >
            <Text style={[styles.toggleLabel, plan === 'monthly' && styles.toggleLabelActive]}>
              Monthly
            </Text>
          </Pressable>
        </View>

        {/* Price display */}
        <View style={styles.priceCard}>
          <Text style={styles.priceMain}>{price}</Text>
          <Text style={styles.pricePerMonth}>{pricePerMonth} per month</Text>
          <Text style={styles.trialNote}>
            Start free today — cancel anytime before your trial ends
          </Text>
        </View>

        {/* Feature comparison */}
        <View style={styles.comparison}>
          {/* Free column */}
          <View style={[styles.planCard, styles.freeCard]}>
            <Text style={styles.planCardTitle}>Free</Text>
            {FREE_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>

          {/* Plus column */}
          <View style={[styles.planCard, styles.plusCard]}>
            <View style={styles.plusHeader}>
              <Text style={styles.planCardTitle}>Pulse+</Text>
              <View style={styles.plusBadge}>
                <Text style={styles.plusBadgeText}>BEST</Text>
              </View>
            </View>
            {PLUS_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Text style={[styles.featureCheck, { color: C.coral }]}>✓</Text>
                <Text style={[styles.featureText, { color: C.textPrimary }]}>{f}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.push('/onboarding/step15')}
        >
          <Text style={styles.primaryBtnText}>
            Start Free Trial — {plan === 'annual' ? '$29.99/yr' : '$5.99/mo'}
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/onboarding/step15')}>
          <Text style={styles.freeText}>Continue with Free</Text>
        </Pressable>
        <Text style={styles.legalText}>
          Cancel anytime. Billed after 7-day trial. No commitment.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 16, gap: 24 },
  header: { alignItems: 'center', gap: 12 },
  badge: {
    backgroundColor: C.coral + '22',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.coral + '55',
  },
  badgeText: { fontSize: 12, fontWeight: '800', color: C.coral, letterSpacing: 1 },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: C.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: { fontSize: 15, color: C.textMuted, textAlign: 'center', lineHeight: 22 },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  toggleBtnActive: { backgroundColor: C.coral },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: C.textMuted },
  toggleLabelActive: { color: C.white },
  savingsBadge: {
    backgroundColor: C.white + '33',
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingsText: { fontSize: 10, fontWeight: '800', color: C.white },
  priceCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: C.coral + '44',
  },
  priceMain: { fontSize: 32, fontWeight: '800', color: C.textPrimary },
  pricePerMonth: { fontSize: 14, color: C.coral, fontWeight: '600' },
  trialNote: { fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 4 },
  comparison: { flexDirection: 'row', gap: 12 },
  planCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    backgroundColor: C.surface,
  },
  freeCard: {},
  plusCard: {
    borderColor: C.coral + '66',
    backgroundColor: C.coral + '0A',
  },
  plusHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  planCardTitle: { fontSize: 16, fontWeight: '800', color: C.textPrimary },
  plusBadge: {
    backgroundColor: C.coral,
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  plusBadgeText: { fontSize: 9, fontWeight: '800', color: C.white, letterSpacing: 0.5 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  featureCheck: { fontSize: 12, color: C.green, fontWeight: '700', marginTop: 2 },
  featureText: { flex: 1, fontSize: 12, color: C.textMuted, lineHeight: 18 },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
    gap: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    backgroundColor: C.bg,
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.white, fontSize: 16, fontWeight: '700' },
  freeText: { fontSize: 15, color: C.textMuted, fontWeight: '500' },
  legalText: { fontSize: 11, color: C.textSubtle, textAlign: 'center' },
});
