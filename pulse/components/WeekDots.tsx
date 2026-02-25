import { StyleSheet, View } from 'react-native';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface WeekDotsProps {
  activeDays?: boolean[];
}

export function WeekDots({ activeDays = Array(7).fill(false) }: WeekDotsProps) {
  return (
    <View style={styles.row}>
      {DAYS.map((_, i) => (
        <View
          key={i}
          style={[styles.dot, activeDays[i] && styles.active]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
  },
  active: { backgroundColor: '#000' },
});
