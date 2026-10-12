import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

import { C } from '../theme';

export function Background() {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 200]);
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.bg,
        backgroundImage: `radial-gradient(circle at 80% ${20 + drift / 10}%, ${C.brand}33, transparent 45%)`,
      }}
    />
  );
}
