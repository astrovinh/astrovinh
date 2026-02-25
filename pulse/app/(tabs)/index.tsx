import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { OrbitLayout } from '../../components/OrbitLayout';

export default function HomeScreen() {
  const session = useAuthStore((s) => s.session);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Sign Out Error', error.message);
  }

  return (
    <View style={styles.container}>
      <OrbitLayout />
      <Text style={styles.greeting}>
        Hello, {session?.user.email ?? 'User'}
      </Text>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  greeting: { fontSize: 18, marginBottom: 32, color: '#333' },
  button: {
    backgroundColor: '#ef4444', borderRadius: 8,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
