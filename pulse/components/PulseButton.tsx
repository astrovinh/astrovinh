import { Pressable, StyleSheet, Text } from 'react-native';

interface PulseButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export function PulseButton({ onPress, disabled }: PulseButtonProps) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.label}>Pulse</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  label: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
