import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { C, FONT_SERIF } from '../theme';

interface CaptionProps {
  text: string;
  sub?: string;
  top?: number;
  size?: number;
}

export function Caption({ text, sub, top = 150, size = 76 }: CaptionProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 72,
        right: 72,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
      }}
    >
      <div style={{ fontFamily: FONT_SERIF, fontSize: size, lineHeight: 1.08, color: C.text, fontWeight: 600 }}>
        {text}
      </div>
      {sub && (
        <div style={{ marginTop: 20, fontFamily: FONT_SERIF, fontSize: size * 0.45, color: C.muted }}>{sub}</div>
      )}
    </div>
  );
}
