import { StyleSheet, Text, View } from 'react-native';
import { ShareTray } from '../../components/ShareTray';

export default function ShareScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Share</Text>
      <ShareTray />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#000', marginBottom: 24 },
});
