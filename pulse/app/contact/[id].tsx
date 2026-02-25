import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AvatarRing } from '../../components/AvatarRing';
import { WeekDots } from '../../components/WeekDots';

export default function ContactDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable style={styles.back} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <AvatarRing />
      <Text style={styles.name}>Contact {id}</Text>
      <WeekDots />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  back: { position: 'absolute', top: 56, left: 24 },
  backText: { fontSize: 16, color: '#000' },
  name: { fontSize: 22, fontWeight: '700', marginTop: 16, color: '#000' },
});
