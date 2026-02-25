import * as WebBrowser from 'expo-web-browser';
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
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Sign In Error', error.message);
    setLoading(false);
  }

  async function signInWithOAuth(provider: 'google' | 'apple') {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'pulse://auth/callback' },
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else if (data?.url) {
      await WebBrowser.openAuthSessionAsync(data.url, 'pulse://auth/callback');
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Welcome back</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#999"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#999"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={signInWithEmail} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.button, styles.outlineButton]}
        onPress={() => signInWithOAuth('google')}
        disabled={loading}
      >
        <Text style={[styles.buttonText, styles.outlineText]}>Continue with Google</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.appleButton]}
        onPress={() => signInWithOAuth('apple')}
        disabled={loading}
      >
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </Pressable>

      <Pressable onPress={() => router.push('/(auth)/signup')} style={styles.link}>
        <Text style={styles.linkText}>
          Don't have an account?{' '}
          <Text style={styles.linkBold}>Sign up</Text>
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 32, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 14, marginBottom: 12, fontSize: 16, color: '#000',
  },
  button: {
    backgroundColor: '#000', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  outlineButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  outlineText: { color: '#000' },
  appleButton: { backgroundColor: '#1a1a1a' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 8, color: '#999', fontSize: 14 },
  link: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#666', fontSize: 14 },
  linkBold: { color: '#000', fontWeight: '600' },
});
