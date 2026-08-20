import { useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Brand } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Ambient backdrop for onboarding / goal setup. Two soft radial blooms rendered in SVG
 * rather than the flat opacity circles we used before — real falloff, so the edges don't
 * read as hard discs against the near-black background.
 */
export function OnboardingGlow(): React.ReactElement {
  const { width: W, height: H } = useWindowDimensions();
  const dark = useColorScheme() !== 'light';
  const topOpacity = dark ? 0.42 : 0.22;
  const bottomOpacity = dark ? 0.2 : 0.12;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
      <Svg width={W} height={H}>
        <Defs>
          <RadialGradient id="onboardingTopGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={Brand[300]} stopOpacity={topOpacity} />
            <Stop offset="0.55" stopColor={Brand[500]} stopOpacity={topOpacity * 0.35} />
            <Stop offset="1" stopColor={Brand[500]} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="onboardingBottomGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={Brand[500]} stopOpacity={bottomOpacity} />
            <Stop offset="1" stopColor={Brand[500]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* Bloom behind the headline, bleeding off the top edge */}
        <Circle cx={W * 0.62} cy={-H * 0.06} r={W * 0.82} fill="url(#onboardingTopGlow)" />
        {/* Faint counterweight under the CTA so the bottom third isn't dead space */}
        <Circle cx={W * 0.1} cy={H * 0.92} r={W * 0.7} fill="url(#onboardingBottomGlow)" />
      </Svg>
    </View>
  );
}
