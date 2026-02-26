import { makeRedirectUri } from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
import { colors as C } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

WebBrowser.maybeCompleteAuthSession();

// This screen is for RETURNING users who tap "Already have an account?" from
// the welcome screen. After sign-in, completeOnboarding() is called so the
// AuthGuard sends them straight to /(tabs).

export default function LoginScreen() {
  const router = useRouter();
  const { completeOnboarding } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = makeRedirectUri({ scheme: 'pulse' });

  async function signInWithEmail() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Error', error.message);
      return;
    }
    await completeOnboarding();
  }

  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert('OAuth Error', error?.message ?? 'No URL returned');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success') return;
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          Alert.alert('Session Error', exchangeError.message);
          return;
        }
      }
      await completeOnboarding();
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to reconnect with your people.</Text>

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={C.textSubtle}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={C.textSubtle}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
          />

          <Pressable
            style={[styles.primaryBtn, (!email || !password) && styles.primaryBtnDisabled]}
            onPress={signInWithEmail}
            disabled={loading || !email || !password}
          >
            {loading
              ? <ActivityIndicator color={C.white} />
              : <Text style={styles.primaryBtnText}>Sign In</Text>}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {Platform.OS === 'ios' && (
            <Pressable
              style={[styles.oauthBtn, styles.appleBtn]}
              onPress={() => signInWithOAuth('apple')}
              disabled={loading}
            >
              <Text style={styles.appleBtnText}> Continue with Apple</Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.oauthBtn, styles.googleBtn]}
            onPress={() => signInWithOAuth('google')}
            disabled={loading}
          >
            <Text style={styles.googleBtnText}>G  Continue with Google</Text>
          </Pressable>

          <Pressable style={styles.signupLink} onPress={() => router.push('/onboarding/step13')}>
            <Text style={styles.signupLinkText}>
              New to Pulse?{' '}
              <Text style={styles.signupLinkBold}>Create an account</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 16, gap: 14 },
  backBtn: { paddingBottom: 8 },
  backText: { fontSize: 15, color: C.textMuted },
  title: { fontSize: 30, fontWeight: '800', color: C.textPrimary, marginTop: 8 },
  subtitle: { fontSize: 15, color: C.textMuted, marginBottom: 8 },
  input: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.textPrimary,
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: { backgroundColor: C.card },
  primaryBtnText: { fontSize: 17, fontWeight: '700', color: C.white },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  dividerText: { fontSize: 13, color: C.textSubtle },
  oauthBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  appleBtn: { backgroundColor: C.white },
  appleBtnText: { fontSize: 16, fontWeight: '700', color: C.black },
  googleBtn: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.cardBorder },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  signupLink: { alignItems: 'center', marginTop: 8 },
  signupLinkText: { fontSize: 14, color: C.textMuted },
  signupLinkBold: { color: C.textPrimary, fontWeight: '600' },
});
