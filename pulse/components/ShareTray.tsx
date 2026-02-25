import { Pressable, StyleSheet, Text, View } from 'react-native';

export function ShareTray() {
  return (
    <View style={styles.tray}>
      <Pressable style={styles.option}>
        <Text style={styles.label}>Photo</Text>
      </Pressable>
      <Pressable style={styles.option}>
        <Text style={styles.label}>Text</Text>
      </Pressable>
      <Pressable style={styles.option}>
        <Text style={styles.label}>Location</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 16,
  },
  option: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  label: { fontSize: 14, fontWeight: '500', color: '#000' },
});
