import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingHeader from '../../components/OnboardingHeader';
import { colors as C } from '../../constants/theme';
import { OnboardingContact, useOnboardingStore } from '../../stores/onboardingStore';

const SUGGESTED: OnboardingContact[] = [
  { id: '1', name: 'Mom', initials: 'M', color: C.coral },
  { id: '2', name: 'Dad', initials: 'D', color: C.amber },
  { id: '3', name: 'Sister', initials: 'S', color: C.lavender },
  { id: '4', name: 'Brother', initials: 'B', color: C.green },
  { id: '5', name: 'Best Friend', initials: 'BF', color: C.blue },
  { id: '6', name: 'Grandma', initials: 'G', color: C.rose },
  { id: '7', name: 'Grandpa', initials: 'Gp', color: '#A78BFA' },
  { id: '8', name: 'Partner', initials: 'P', color: '#34D399' },
];

export default function AddPeopleScreen() {
  const router = useRouter();
  const { selectedContacts, toggleContact } = useOnboardingStore();

  const isSelected = (id: string) => selectedContacts.some((c) => c.id === id);

  return (
    <SafeAreaView style={styles.container}>
      <OnboardingHeader
        step={6}
        onBack={() => router.back()}
        onSkip={() => router.push('/onboarding/step13')}
      />

      <View style={styles.header}>
        <Text style={styles.heading}>Who do you want to stay close with?</Text>
        <Text style={styles.subheading}>
          Select the people who'd love to know you're thinking of them. You can always add more later.
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {SUGGESTED.map((contact) => {
          const selected = isSelected(contact.id);
          return (
            <Pressable
              key={contact.id}
              style={[
                styles.contactCard,
                selected && { borderColor: contact.color, backgroundColor: contact.color + '18' },
              ]}
              onPress={() => toggleContact(contact)}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: contact.color + (selected ? '44' : '22'), borderColor: contact.color },
                ]}
              >
                <Text style={[styles.initials, { color: contact.color }]}>{contact.initials}</Text>
              </View>
              <Text style={[styles.contactName, selected && { color: C.textPrimary }]}>
                {contact.name}
              </Text>
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          );
        })}

        {/* Custom add */}
        <Pressable style={[styles.contactCard, styles.addCustomCard]}>
          <View style={[styles.avatar, styles.addCustomAvatar]}>
            <Text style={styles.plusIcon}>+</Text>
          </View>
          <Text style={styles.addCustomText}>Add someone</Text>
        </Pressable>
      </ScrollView>

      <View style={styles.footer}>
        {selectedContacts.length > 0 && (
          <Text style={styles.selectedCount}>
            {selectedContacts.length} {selectedContacts.length === 1 ? 'person' : 'people'} selected
          </Text>
        )}
        <Pressable
          style={[
            styles.primaryBtn,
            selectedContacts.length === 0 && styles.primaryBtnDisabled,
          ]}
          onPress={() => router.push('/onboarding/step7')}
          disabled={selectedContacts.length === 0}
        >
          <Text style={styles.primaryBtnText}>
            {selectedContacts.length > 0 ? 'Continue →' : 'Select at least one person'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, gap: 10 },
  heading: { fontSize: 26, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 15, color: C.textMuted, lineHeight: 22 },
  scroll: { flex: 1 },
  grid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 16,
  },
  contactCard: {
    width: '47%',
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: C.cardBorder,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 20, fontWeight: '700' },
  contactName: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  checkmark: { position: 'absolute', top: 8, right: 10, fontSize: 16, color: C.coral },
  addCustomCard: { borderStyle: 'dashed' },
  addCustomAvatar: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    borderStyle: 'dashed',
  },
  plusIcon: { fontSize: 24, color: C.textMuted },
  addCustomText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    gap: 10,
    alignItems: 'center',
  },
  selectedCount: { fontSize: 14, color: C.coral, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnDisabled: { backgroundColor: C.card },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
