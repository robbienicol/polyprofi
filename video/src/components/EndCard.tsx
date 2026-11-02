import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { C, FONT_SANS, FONT_SERIF } from '../theme';

interface EndCardProps {
  /** Per-variant link so installs can be attributed to the cut that drove them. */
  cta: string;
}

export function EndCard({ cta }: EndCardProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14 } });
  const late = spring({ frame: frame - 15, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 48 }}>
      <Img src={staticFile('icon.png')} style={{ width: 220, height: 220, borderRadius: 50, transform: `scale(${pop})` }} />
      <div style={{ fontFamily: FONT_SERIF, fontSize: 120, fontWeight: 700, color: C.text }}>Pathey</div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 60, color: C.text, opacity: late }}>Not advice. Just the math.</div>
      <div
        style={{
          marginTop: 40,
          padding: '28px 56px',
          borderRadius: 999,
          background: C.brand,
          fontFamily: FONT_SANS,
          fontWeight: 800,
          fontSize: 44,
          color: '#fff',
          opacity: late,
          transform: `translateY(${interpolate(late, [0, 1], [30, 0])}px)`,
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
}
