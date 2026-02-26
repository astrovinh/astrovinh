import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AvatarRing } from '../../components/AvatarRing';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { colors as C } from '../../constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { session, profile, setProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function finish() {
    if (!displayName.trim() || !session) return;
    setLoading(true);
    const { error } = await supabase
      .from('users')
      .update({ name: displayName.trim(), onboarding_complete: true })
      .eq('id', session.user.id);
    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }
    setProfile(
      profile
        ? { ...profile, name: displayName.trim(), onboardingComplete: true }
        : null
    );
    // AuthGuard detects onboardingComplete=true and routes to /(tabs)
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.top}>
          <Text style={styles.heading}>Set up your profile</Text>
          <Text style={styles.subheading}>What should we call you?</Text>

          <AvatarRing size={96} color={C.coral} />

          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={C.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={finish}
          />
        </View>

        <Pressable
          style={[styles.btn, (!displayName.trim() || loading) && styles.btnDisabled]}
          onPress={finish}
          disabled={!displayName.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={styles.btnText}>Let's go</Text>}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  top: { alignItems: 'center', gap: 20 },
  heading: {
    fontSize: 32,
    fontWeight: '800',
    color: C.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    color: C.textMuted,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: C.textPrimary,
    backgroundColor: C.surface,
    textAlign: 'center',
    marginTop: 8,
  },
  btn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: C.white, fontSize: 17, fontWeight: '700' },
});
