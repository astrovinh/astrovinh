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
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { colors as C } from '../../constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else if (data.session) {
      // Email confirm is disabled — session is live, continue to role selection
      router.replace('/onboarding/role');
    } else {
      // Email confirm is enabled — show check-email holding screen
      router.replace('/onboarding/check-email');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Create account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={C.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={C.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={signUp} disabled={loading}>
        {loading
          ? <ActivityIndicator color={C.white} />
          : <Text style={styles.buttonText}>Create Account</Text>}
      </Pressable>

      <Pressable onPress={() => router.back()} style={styles.link}>
        <Text style={styles.linkText}>
          Already have an account?{' '}
          <Text style={styles.linkBold}>Sign in</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, textAlign: 'center', color: C.textPrimary },
  input: {
    borderWidth: 1, borderColor: C.cardBorder, borderRadius: 8,
    padding: 14, marginBottom: 12, fontSize: 16, color: C.textPrimary, backgroundColor: C.surface,
  },
  button: {
    backgroundColor: C.coral, borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: C.white, fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: C.textMuted, fontSize: 14 },
  linkBold: { color: C.textPrimary, fontWeight: '600' },
});
