import React from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Brand, OnBrand, Radius } from '@/constants/theme';

/** The rounded square a service card's icon sits in. */
export function IconTile({
  glyph,
  color,
  backgroundColor,
}: {
  glyph: string;
  color: string;
  backgroundColor: string;
}): React.ReactElement {
  return (
    <View style={{ width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor }}>
      <Icon glyph={glyph} size={20} color={color} strokeWidth={1.75} />
    </View>
  );
}

/** The filled tick on a card that is added or connected. */
export function CheckBadge(): React.ReactElement {
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: Radius.sm,
        backgroundColor: Brand[500],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon glyph="✓" size={13} color={OnBrand} strokeWidth={3} />
    </View>
  );
}
