import { useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors as C } from '../../constants/theme';

export default function CheckEmailScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.emoji}>📬</Text>
        <Text style={styles.heading}>Check your inbox</Text>
        <Text style={styles.body}>
          We sent a confirmation link to your email address. Tap it to activate your account, then come back to sign in.
        </Text>

        <Pressable
          style={styles.primaryBtn}
          onPress={() => Linking.openURL('mailto:')}
        >
          <Text style={styles.primaryBtnText}>Open email app</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => router.replace('/onboarding/login')}
        >
          <Text style={styles.secondaryBtnText}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  emoji: { fontSize: 64, marginBottom: 8 },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: C.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: C.coral,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: '100%',
  },
  primaryBtnText: { color: C.white, fontSize: 17, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 8, alignItems: 'center' },
  secondaryBtnText: { color: C.textMuted, fontSize: 15 },
});
