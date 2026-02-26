import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { colors as C } from '../../constants/theme';

type Role = 'parent' | 'child';

const ROLES: { value: Role; label: string; emoji: string; description: string }[] = [
  {
    value: 'parent',
    label: "I'm a Parent",
    emoji: '👨‍👩‍👧‍👦',
    description: 'Stay connected with your kids and family',
  },
  {
    value: 'child',
    label: "I'm a Kid or Teen",
    emoji: '👦',
    description: 'Keep in touch with the people you care about',
  },
];

export default function RoleScreen() {
  const router = useRouter();
  const { session, profile, setProfile } = useAuthStore();
  const [selected, setSelected] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);

  async function continueWithRole() {
    if (!selected || !session) return;
    setLoading(true);
    const { error } = await supabase
      .from('users')
      .update({ role: selected })
      .eq('id', session.user.id);
    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }
    setProfile(profile ? { ...profile, role: selected } : null);
    router.push('/onboarding/profile');
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.heading}>Who are you?</Text>
        <Text style={styles.subheading}>This helps us personalise your experience.</Text>

        <View style={styles.cards}>
          {ROLES.map((r) => (
            <Pressable
              key={r.value}
              style={[styles.card, selected === r.value && styles.cardSelected]}
              onPress={() => setSelected(r.value)}
            >
              <Text style={styles.cardEmoji}>{r.emoji}</Text>
              <Text style={[styles.cardLabel, selected === r.value && styles.cardLabelSelected]}>
                {r.label}
              </Text>
              <Text style={styles.cardDescription}>{r.description}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.btn, (!selected || loading) && styles.btnDisabled]}
          onPress={continueWithRole}
          disabled={!selected || loading}
        >
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.btnText}>Continue</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    gap: 16,
  },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 16,
    color: C.textMuted,
    marginBottom: 8,
  },
  cards: { gap: 14, marginTop: 8 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: C.cardBorder,
    padding: 24,
    gap: 6,
  },
  cardSelected: {
    borderColor: C.coral,
    backgroundColor: C.card,
  },
  cardEmoji: { fontSize: 36 },
  cardLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: C.textPrimary,
  },
  cardLabelSelected: { color: C.coral },
  cardDescription: {
    fontSize: 14,
    color: C.textMuted,
  },
  btn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
