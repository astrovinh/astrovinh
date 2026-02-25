import { StyleSheet, View } from 'react-native';
import { PulseButton } from './PulseButton';

export function OrbitLayout() {
  return (
    <View style={styles.container}>
      <View style={styles.orbit} />
      <View style={styles.center}>
        <PulseButton onPress={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  orbit: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
