import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function OnboardingWelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Pulse</Text>
      <Text style={styles.subtitle}>Stay connected with the people who matter most.</Text>
      <Pressable style={styles.button} onPress={() => router.push('/onboarding/step2')}>
        <Text style={styles.buttonText}>Get Started</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/onboarding/login')} style={styles.link}>
        <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff' },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 48, lineHeight: 24 },
  button: { backgroundColor: '#000', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { marginTop: 24 },
  linkText: { color: '#666', fontSize: 14 },
  linkBold: { color: '#000', fontWeight: '600' },
});
