import { StyleSheet, Text, View } from 'react-native';

interface MomentCardProps {
  title?: string;
  body?: string;
  timestamp?: string;
}

export function MomentCard({ title = '', body = '', timestamp = '' }: MomentCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {!!timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginVertical: 6,
  },
  title: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
  body: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  timestamp: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
});
