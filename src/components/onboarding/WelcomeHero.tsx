import { Gauge, MessageCircle, Route, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingGlow } from '@/components/onboarding/OnboardingGlow';
import { ThemedText } from '@/components/themed-text';
import { BrandMark } from '@/components/ui/BrandMark';
import { Brand, OnBrand, Radius, Shadow, displayFontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The three hooks, each a thing the app really does: the sweep across every kind
 * of route, the one Score, and the coach. Same claims the carousel then explains.
 */
const HOOKS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Route, title: 'Every way to your goal', body: 'Cut spending, save, invest or bet. All checked at once.' },
  { icon: Gauge, title: 'Real odds for each', body: 'Your chance of hitting the goal, and what you could lose.' },
  { icon: MessageCircle, title: 'Plain-English help', body: 'Ask about any pick, any hour. No stupid questions.' },
];

/** One staggered entrance: fade up, in order, off a single clock per item. */
function useEntrance(count: number): Animated.Value[] {
  const [values] = useState(() => Array.from({ length: count }, () => new Animated.Value(0)));
  useEffect(() => {
    Animated.stagger(
      110,
      values.map((value) => Animated.timing(value, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })),
    ).start();
  }, [values]);
  return values;
}

function rise(value: Animated.Value, distance = 18) {
  return {
    opacity: value,
    transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
  };
}

/**
 * First thing anyone sees. The pitch before the name: what Pathey is, in one line,
 * and the three reasons to keep going.
 */
export function WelcomeHero({ onStart, onSignIn }: { onStart: () => void; onSignIn: () => void }): React.ReactElement {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  const short = height > 0 && height < 700;
  // mark, headline, sub, three hooks, button
  const [mark, headline, sub, ...rest] = useEntrance(3 + HOOKS.length + 1);
  const hooks = rest.slice(0, HOOKS.length);
  const cta = rest[HOOKS.length];

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <OnboardingGlow />
      <SafeAreaView className="flex-1">
        <View className="flex-1 px-6 justify-center" style={{ gap: short ? 22 : 32 }}>
          <Animated.View style={[{ alignSelf: 'flex-start', borderRadius: Radius.xl, ...Shadow.float }, rise(mark, 10)]}>
            <BrandMark size={short ? 56 : 68} />
          </Animated.View>

          <View style={{ gap: 12 }}>
            <Animated.View style={rise(headline)}>
              <ThemedText
                style={{
                  fontFamily: displayFontFamily('700'),
                  fontSize: short ? 36 : 42,
                  lineHeight: short ? 40 : 46,
                  letterSpacing: -1.2,
                  color: theme.text,
                }}>
                Name a goal.{'\n'}
                <ThemedText style={{ fontFamily: displayFontFamily('700'), fontSize: short ? 36 : 42, lineHeight: short ? 40 : 46, letterSpacing: -1.2, color: Brand[500] }}>
                  We find the way.
                </ThemedText>
              </ThemedText>
            </Animated.View>
            <Animated.View style={rise(sub)}>
              <ThemedText style={{ fontSize: short ? 15 : 16.5, lineHeight: short ? 21 : 24, color: theme.textSecondary, maxWidth: 340 }}>
                Tell us what you want the money for. Pathey lays out every route to it, safest to riskiest.
              </ThemedText>
            </Animated.View>
          </View>

          <View style={{ gap: short ? 10 : 12 }}>
            {HOOKS.map(({ icon: HookIcon, title, body }, index) => (
              <Animated.View
                key={title}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    padding: short ? 12 : 14,
                    borderRadius: Radius.lg,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundElevated,
                  },
                  rise(hooks[index]),
                ]}>
                <View style={{ width: 40, height: 40, borderRadius: Radius.md, backgroundColor: Brand[500], alignItems: 'center', justifyContent: 'center' }}>
                  <HookIcon size={20} color={OnBrand} strokeWidth={2.4} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{title}</ThemedText>
                  <ThemedText style={{ fontSize: 13, lineHeight: 18, color: theme.textSecondary }}>{body}</ThemedText>
                </View>
              </Animated.View>
            ))}
          </View>
        </View>

        <Animated.View style={[{ paddingHorizontal: 24, paddingBottom: 12, paddingTop: 12, gap: 10 }, rise(cta, 12)]}>
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            className="py-4 items-center active:opacity-85"
            style={{ borderRadius: Radius.lg, backgroundColor: Brand[500], ...Shadow.card }}>
            <ThemedText style={{ fontSize: 16, fontWeight: '800', color: OnBrand, letterSpacing: -0.2 }}>
              Get started
            </ThemedText>
          </Pressable>
          {/* A returning user on a new phone has an account already; walking them
              through the pitch and a name they gave months ago was the only way in. */}
          <Pressable onPress={onSignIn} accessibilityRole="button" hitSlop={8} className="items-center py-1 active:opacity-60">
            <ThemedText style={{ fontSize: 14, color: theme.textSecondary }}>
              I already have an account · <ThemedText style={{ fontSize: 14, fontWeight: '800', color: Brand[500] }}>Sign in</ThemedText>
            </ThemedText>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}
