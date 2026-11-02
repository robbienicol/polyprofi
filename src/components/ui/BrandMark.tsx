import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { Brand, Colors } from '@/constants/theme';

/**
 * The Pathey mark: a short bar above a longer bar, fully rounded — an equals
 * sign stepped up. Geometry is the icon spec in BRANDING.md, expressed as
 * fractions of the 1024 canvas so it scales to any size and stays identical to
 * `assets/images/icon.png`.
 */
const BAR_HEIGHT = 124 / 1024;
const BAR_X = 262 / 1024;
const UPPER_Y = 300 / 1024;
const UPPER_W = 352 / 1024;
const LOWER_Y = 600 / 1024;
const LOWER_W = 500 / 1024;
/** iOS icon corner radius as a fraction of the tile — makes the tile read as the app icon. */
const TILE_RADIUS = 0.2237;

type BrandMarkProps = {
  /** Edge length of the square tile, in points. */
  size: number;
  /** Ground behind the mark. Cream by default, exactly like the icon file. */
  ground?: string;
  /** Colour of the bars. Brand clay by default; cream on a dark ground. */
  mark?: string;
  style?: ViewStyle;
};

export function BrandMark({
  size,
  ground = Colors.light.background,
  mark = Brand[500],
  style,
}: BrandMarkProps): React.ReactElement {
  const barHeight = size * BAR_HEIGHT;
  const bar: ViewStyle = {
    position: 'absolute',
    left: size * BAR_X,
    height: barHeight,
    borderRadius: barHeight / 2,
    backgroundColor: mark,
  };

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size * TILE_RADIUS,
          backgroundColor: ground,
          overflow: 'hidden',
        },
        style,
      ]}>
      <View style={[bar, { top: size * UPPER_Y, width: size * UPPER_W }]} />
      <View style={[bar, { top: size * LOWER_Y, width: size * LOWER_W }]} />
    </View>
  );
}
