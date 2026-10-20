import { interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { C, s } from '../theme';

interface PhoneClipProps {
  /** File in public/captures. */
  src: string;
  /** Seconds into the capture to start from. */
  from?: number;
  playbackRate?: number;
}

// Captures are 1206x2622 screen recordings; shown in a simple device frame
// below the caption area.
const PHONE_W = 640;
const PHONE_H = Math.round(PHONE_W * (2622 / 1206));

export function PhoneClip({ src, from = 0, playbackRate = 1 }: PhoneClipProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, mass: 0.8 } });

  return (
    <div
      style={{
        position: 'absolute',
        left: (1080 - PHONE_W) / 2,
        top: 560,
        width: PHONE_W,
        height: PHONE_H,
        borderRadius: 72,
        padding: 14,
        background: '#000',
        border: `2px solid ${C.border}`,
        boxShadow: '0 40px 120px rgba(0,0,0,0.6)',
        transform: `translateY(${interpolate(enter, [0, 1], [500, 0])}px)`,
      }}
    >
      <OffthreadVideo
        src={staticFile(`captures/${src}`)}
        startFrom={s(from)}
        playbackRate={playbackRate}
        muted
        style={{ width: '100%', height: '100%', borderRadius: 60, objectFit: 'cover' }}
      />
    </div>
  );
}
