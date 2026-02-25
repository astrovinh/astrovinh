import { StyleSheet, View } from 'react-native';

interface AvatarRingProps {
  size?: number;
  color?: string;
  imageUri?: string;
}

export function AvatarRing({ size = 80, color = '#000' }: AvatarRingProps) {
  return (
    <View
      style={[
        styles.ring,
        {
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          borderColor: color,
        },
      ]}
    >
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    backgroundColor: '#e5e7eb',
  },
});
