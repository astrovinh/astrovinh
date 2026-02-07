import { Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Text, View } from '@/components/Themed';

export default function TabOneScreen() {
  return (
    <View className="flex-1 items-center justify-center">
      <Text className="text-xl font-bold mb-6">Murror</Text>
      <Link href="/reflection" asChild>
        <Pressable className="bg-black rounded-full px-8 py-3">
          <Text className="text-white text-base font-semibold">
            View Reflection
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}
