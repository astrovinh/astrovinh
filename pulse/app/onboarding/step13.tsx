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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useOnboardingStore } from '../../stores/onboardingStore';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'choose' | 'email-signup' | 'email-signin';

export default function CreateAccountScreen() {
  const router = useRouter();
  const { selectedContacts, rhythm } = useOnboardingStore();
  const [mode, setMode] = useState<Mode>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = makeRedirectUri({ scheme: 'pulse' });

  // After any successful auth, continue to step 14 (paywall).
  // The AuthGuard will NOT redirect to tabs because onboardingComplete is still false.
  function onAuthSuccess() {
    router.push('/onboarding/step14');
  }

  async function signUpWithEmail() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign Up Error', error.message);
      return;
    }
    onAuthSuccess();
  }

  async function signInWithEmail() {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign In Error', error.message);
      return;
    }
    onAuthSuccess();
  }

  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        Alert.alert('Sign In Error', error?.message ?? 'No URL returned');
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
      onAuthSuccess();
    } finally {
      setLoading(false);
    }
  }

  const contactCount = selectedContacts.length;
  const rhythmLabel = rhythm === 'daily' ? 'daily' : rhythm === 'multiple' ? 'multiple times a day' : rhythm === 'few_days' ? 'every few days' : 'weekly';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header — no back, no skip (hard gate) */}
          <View style={styles.header}>
            <View style={styles.warningBadge}>
              <Text style={styles.warningEmoji}>⚠️</Text>
              <Text style={styles.warningText}>Don't lose your progress</Text>
            </View>

            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>
              Without an account, your{' '}
              {contactCount > 0 ? (
                <Text style={styles.highlight}>{contactCount} {contactCount === 1 ? 'contact' : 'contacts'}</Text>
              ) : (
                'contacts'
              )}{' '}
              and <Text style={styles.highlight}>{rhythmLabel}</Text> rhythm will be lost.
            </Text>
          </View>

          {mode === 'choose' && (
            <View style={styles.options}>
              {/* Apple (iOS only) */}
              {Platform.OS === 'ios' && (
                <Pressable
                  style={[styles.oauthBtn, styles.appleBtn]}
                  onPress={() => signInWithOAuth('apple')}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={C.white} />
                  ) : (
                    <Text style={styles.appleBtnText}> Continue with Apple</Text>
                  )}
                </Pressable>
              )}

              {/* Google */}
              <Pressable
                style={[styles.oauthBtn, styles.googleBtn]}
                onPress={() => signInWithOAuth('google')}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={C.black} />
                ) : (
                  <Text style={styles.googleBtnText}>G  Continue with Google</Text>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Email */}
              <Pressable
                style={styles.emailBtn}
                onPress={() => setMode('email-signup')}
              >
                <Text style={styles.emailBtnText}>Sign up with Email</Text>
              </Pressable>

              <Pressable onPress={() => setMode('email-signin')} style={styles.signinLink}>
                <Text style={styles.signinLinkText}>
                  Already have an account?{' '}
                  <Text style={styles.signinLinkBold}>Sign in</Text>
                </Text>
              </Pressable>
            </View>
          )}

          {(mode === 'email-signup' || mode === 'email-signin') && (
            <View style={styles.emailForm}>
              <Pressable onPress={() => setMode('choose')} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Back</Text>
              </Pressable>

              <Text style={styles.formTitle}>
                {mode === 'email-signup' ? 'Create account' : 'Welcome back'}
              </Text>

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
                placeholder={mode === 'email-signup' ? 'Create a password' : 'Password'}
                placeholderTextColor={C.textSubtle}
                secureTextEntry
                textContentType={mode === 'email-signup' ? 'newPassword' : 'password'}
                value={password}
                onChangeText={setPassword}
              />

              <Pressable
                style={[styles.submitBtn, (!email || !password) && styles.submitBtnDisabled]}
                onPress={mode === 'email-signup' ? signUpWithEmail : signInWithEmail}
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <ActivityIndicator color={C.white} />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {mode === 'email-signup' ? 'Create Account' : 'Sign In'}
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {/* Legal */}
          <Text style={styles.legal}>
            By continuing you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40, gap: 28 },
  header: { gap: 14 },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.amber + '22',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.amber + '44',
    alignSelf: 'flex-start',
  },
  warningEmoji: { fontSize: 14 },
  warningText: { fontSize: 13, color: C.amber, fontWeight: '600' },
  heading: { fontSize: 30, fontWeight: '800', color: C.textPrimary, letterSpacing: -0.5 },
  subheading: { fontSize: 16, color: C.textMuted, lineHeight: 24 },
  highlight: { color: C.coral, fontWeight: '700' },
  options: { gap: 12 },
  oauthBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  appleBtn: { backgroundColor: C.white },
  appleBtnText: { fontSize: 16, fontWeight: '700', color: C.black },
  googleBtn: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.cardBorder },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: C.textPrimary },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.cardBorder },
  dividerText: { fontSize: 13, color: C.textSubtle },
  emailBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  emailBtnText: { fontSize: 16, fontWeight: '700', color: C.white },
  signinLink: { alignItems: 'center', paddingVertical: 4 },
  signinLinkText: { fontSize: 14, color: C.textMuted },
  signinLinkBold: { color: C.textPrimary, fontWeight: '600' },
  emailForm: { gap: 14 },
  backLink: { paddingBottom: 4 },
  backLinkText: { fontSize: 15, color: C.textMuted },
  formTitle: { fontSize: 22, fontWeight: '700', color: C.textPrimary },
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
  submitBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnDisabled: { backgroundColor: C.card },
  submitBtnText: { fontSize: 17, fontWeight: '700', color: C.white },
  legal: { fontSize: 12, color: C.textSubtle, textAlign: 'center', lineHeight: 18 },
});
