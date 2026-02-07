import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ImageBackground,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

// Placeholder images — replace with actual Figma exports
const IMAGES = {
  heroBg: { uri: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80' },
  whatBothCanDoBg: { uri: 'https://images.unsplash.com/photo-1475274047050-1d0c55b0033b?w=800&q=80' },
  jennyAvatar: { uri: 'https://i.pravatar.cc/100?img=5' },
  jonathanAvatar: { uri: 'https://i.pravatar.cc/100?img=12' },
};

export default function ReflectionScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <HeroSection onBack={() => router.back()} />
        <LogoDivider />
        <OverviewSection />
        <ExpressionDifferenceSection />
        <QuoteCard />
        <WhatBothCanDoSection />
        <BottomCTA />
        <View className="h-10" />
      </ScrollView>
    </View>
  );
}

/* ─── HERO SECTION ─── */
function HeroSection({ onBack }: { onBack: () => void }) {
  return (
    <View className="overflow-hidden" style={{ borderRadius: 40 }}>
      <ImageBackground
        source={IMAGES.heroBg}
        style={{ width: '100%', height: 586 }}
        resizeMode="cover"
      >
        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Subtle white border overlay */}
        <View
          className="absolute inset-0"
          style={{ borderRadius: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
        />

        {/* Back button */}
        <SafeAreaView className="absolute top-0 left-0 right-0 z-10">
          <Pressable
            onPress={onBack}
            className="ml-4 mt-2 w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          >
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
        </SafeAreaView>

        {/* "Opening Up" badge — centered at top */}
        <View className="absolute top-14 left-0 right-0 items-center z-10">
          <View className="bg-cream rounded-full px-4 py-1.5">
            <Text className="text-black text-sm font-semibold" style={{ letterSpacing: -0.14 }}>
              Opening Up
            </Text>
          </View>
        </View>

        {/* Subtitle */}
        <View className="absolute top-[72px] left-0 right-0 items-center px-14 z-10">
          <Text
            className="text-white text-base font-semibold text-center"
            style={{ letterSpacing: -0.16, lineHeight: 24 }}
          >
            You're starting to understand how each other feels
          </Text>
        </View>

        {/* Bottom content */}
        <View className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <Text className="text-white text-[28px] mb-6" style={{ fontWeight: '500' }}>
            May 21
          </Text>

          <Text
            className="text-white text-sm font-bold uppercase mb-2"
            style={{ letterSpacing: 1.12 }}
          >
            TOPIC
          </Text>

          <Text className="text-white text-[40px] mb-3" style={{ fontWeight: '900', lineHeight: 46 }}>
            The world between us two
          </Text>

          <Text
            className="text-white/80 text-sm"
            style={{ letterSpacing: -0.14, lineHeight: 20 }}
          >
            This insight is generated to help understanding — not judgment.
          </Text>
        </View>
      </ImageBackground>
    </View>
  );
}

/* ─── LOGO DIVIDER ─── */
function LogoDivider() {
  return (
    <View className="items-center py-8">
      <View className="w-9 h-9 bg-white rounded-full items-center justify-center">
        <MurrorLogo size={18} />
      </View>
    </View>
  );
}

/* ─── OVERVIEW ─── */
function OverviewSection() {
  return (
    <View className="items-center px-10 mb-10">
      <Text
        className="text-white text-sm font-bold uppercase text-center mb-2"
        style={{ letterSpacing: 1.12 }}
      >
        OVERVIEW
      </Text>
      <Text className="text-white text-xl text-center" style={{ lineHeight: 28 }}>
        You both care deeply, even if you express it differently. You two can find the a time to
        meet and discuss with each other.
      </Text>
    </View>
  );
}

/* ─── EXPRESSION DIFFERENCE ─── */
function ExpressionDifferenceSection() {
  return (
    <View className="mx-6 mb-8 rounded-3xl overflow-hidden">
      {/* Painterly background */}
      <ImageBackground
        source={IMAGES.heroBg}
        resizeMode="cover"
        style={{ width: '100%', minHeight: 400 }}
        imageStyle={{ opacity: 0.4 }}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
          <View className="p-6">
            <Text
              className="text-white text-sm font-bold uppercase mb-8"
              style={{ letterSpacing: 1.12 }}
            >
              Expression difference
            </Text>

            {/* Speech bubbles */}
            <View className="mb-6">
              {/* Jenny's bubble (left-aligned) */}
              <View className="flex-row items-start mb-5">
                <Image
                  source={IMAGES.jennyAvatar}
                  style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }}
                />
                <View className="flex-1">
                  <SpeechBubble direction="left">
                    <Text
                      className="text-black text-sm"
                      style={{ fontFamily: 'PlayfairDisplay_600SemiBold', letterSpacing: 0.07 }}
                    >
                      You tend to feel deeply but pause before expressing it
                    </Text>
                  </SpeechBubble>
                </View>
              </View>

              {/* Jonathan's bubble (right-aligned) */}
              <View className="flex-row-reverse items-start">
                <Image
                  source={IMAGES.jonathanAvatar}
                  style={{ width: 43, height: 43, borderRadius: 22, marginLeft: 12 }}
                />
                <View className="flex-1">
                  <SpeechBubble direction="right">
                    <Text
                      className="text-black text-sm"
                      style={{ fontFamily: 'PlayfairDisplay_600SemiBold', letterSpacing: 0.07 }}
                    >
                      He notices closeness through shared moments and presence
                    </Text>
                  </SpeechBubble>
                </View>
              </View>
            </View>

            <Text
              className="text-white text-base"
              style={{ letterSpacing: -0.16, lineHeight: 24 }}
            >
              Neither of you are wrong, you're just speaking different emotional languages
            </Text>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

/* ─── SPEECH BUBBLE ─── */
function SpeechBubble({
  children,
  direction,
}: {
  children: React.ReactNode;
  direction: 'left' | 'right';
}) {
  return (
    <View
      className="bg-white/90 p-4"
      style={{
        borderRadius: 16,
        borderBottomLeftRadius: direction === 'left' ? 4 : 16,
        borderBottomRightRadius: direction === 'right' ? 4 : 16,
      }}
    >
      {children}
    </View>
  );
}

/* ─── QUOTE CARD ─── */
function QuoteCard() {
  return (
    <View
      className="mx-6 mb-8 bg-black rounded-3xl p-6"
      style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <Text
        className="text-white text-sm font-bold uppercase mb-6"
        style={{ letterSpacing: 1.12 }}
      >
        Quote
      </Text>

      <Text
        className="text-white text-[27px]"
        style={{ fontFamily: 'PlayfairDisplay_500Medium', letterSpacing: -0.27, lineHeight: 32 }}
      >
        When one of you stays quiet, it's not distance, it's care. When the other shares openly,
        it's not pressure, it's connection
      </Text>
    </View>
  );
}

/* ─── WHAT BOTH CAN DO ─── */
function WhatBothCanDoSection() {
  return (
    <View className="mx-6 mb-8 rounded-3xl overflow-hidden">
      <ImageBackground
        source={IMAGES.whatBothCanDoBg}
        resizeMode="cover"
        style={{ width: '100%', minHeight: 400 }}
      >
        <View style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}>
          <View className="p-6" style={{ gap: 26 }}>
            <Text
              className="text-white text-sm font-bold uppercase"
              style={{ letterSpacing: 1.12 }}
            >
              What both can do
            </Text>

            <PersonAdvice
              name="JENNY"
              avatar={IMAGES.jennyAvatar}
              advice={[
                "Jenny can be more open when listening to Jonathan\u2019s feedback.",
                "When he is sharing, he does not need an answer, he was simply looking for someone to listen, you don\u2019t have to respond to every word he said.",
                "You are doing great as a doer, keep up with the great spirit.",
              ]}
            />

            <PersonAdvice
              name="JONATHAN"
              avatar={IMAGES.jonathanAvatar}
              advice={[
                "Jonathan is great at expressing himself, what you can do is to be mindful if the other person is wanting to listen or not, this will save you the energy so make sure you clarify what the other person is looking for.",
                "Try to control your emotions and use deep breath technique when you are feeling overwhelming.",
                "You can be wrong and that\u2019s completely ok. You don\u2019t have to be right to depend yourself all the time",
              ]}
            />
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

/* ─── PERSON ADVICE ─── */
function PersonAdvice({
  name,
  avatar,
  advice,
}: {
  name: string;
  avatar: { uri: string };
  advice: string[];
}) {
  return (
    <View>
      <View className="flex-row items-center mb-3">
        <Image source={avatar} style={{ width: 34, height: 34, borderRadius: 17, marginRight: 12 }} />
        <Text
          className="text-white text-sm font-bold uppercase"
          style={{ letterSpacing: 1.12 }}
        >
          {name}
        </Text>
      </View>

      {advice.map((text, i) => (
        <Text
          key={i}
          className="text-white text-lg mb-3"
          style={{ letterSpacing: -0.18, lineHeight: 28 }}
        >
          {text}
        </Text>
      ))}
    </View>
  );
}

/* ─── BOTTOM CTA ─── */
function BottomCTA() {
  return (
    <View
      className="mx-5 mb-6 bg-white rounded-3xl items-center py-7 px-6"
      style={{ borderWidth: 2, borderColor: '#F5F5F5' }}
    >
      <Pressable className="bg-black rounded-full px-16 py-3 mb-2">
        <Text className="text-white text-sm font-semibold uppercase text-center">
          REFLECT DEEPER
        </Text>
      </Pressable>

      <Text
        className="text-black text-xs text-center mt-1"
        style={{ letterSpacing: 0.07 }}
      >
        This space is private
      </Text>
    </View>
  );
}

/* ─── MURROR LOGO (simplified) ─── */
function MurrorLogo({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6z"
        fill="#000"
      />
    </Svg>
  );
}
