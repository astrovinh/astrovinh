import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>You're in!</Text>
      <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 32 },
  button: {
    backgroundColor: '#000', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
