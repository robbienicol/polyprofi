import { View } from 'react-native';

import { Brand } from '@/constants/theme';

export function OnboardingGlow(): React.ReactElement {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -80, left: -40, right: -40, height: 280 }}>
      <View style={{ position: 'absolute', top: 40, alignSelf: 'center', width: 280, height: 280, borderRadius: 999, backgroundColor: Brand[500], opacity: 0.12 }} />
      <View style={{ position: 'absolute', top: 80, alignSelf: 'center', width: 180, height: 180, borderRadius: 999, backgroundColor: Brand[300], opacity: 0.08 }} />
    </View>
  );
}
