import { AbsoluteFill, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import { C, FONT_SANS, FONT_SERIF } from '../theme';

// Every account and post here is fictional. Swap in real clips only if you
// have the rights to them; never use a real person's name or likeness.

export interface Tout {
  name: string;
  handle: string;
  text: string;
  /** What the call actually did, shown on the stamp. */
  result: string;
  tint: string;
}

export const TOUTS: Tout[] = [
  { name: 'Lock Szn', handle: '@locksznpicks_', text: '5-leg parlay tonight. 🔒 LOCK. Cannot lose. Tail me or cry later.', result: '−$500', tint: '#3B82F6' },
  { name: 'Moon Calls', handle: '@mooncalls_xyz', text: '$FROG is going 50x by Friday. Not financial advice (it is). Trust me.', result: '−87%', tint: '#A855F7' },
  { name: 'Options Sensei', handle: '@sensei_0dte', text: 'Weekly calls. Easy money. VIP group is $99/mo, link in bio 💰', result: '−$2,340', tint: '#10B981' },
];

function usePop(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.7 } });
}

function Avatar({ tout, size = 88 }: { tout: Tout; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: size, flexShrink: 0, background: tout.tint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 800, fontSize: size * 0.42, fontFamily: FONT_SANS,
      }}
    >
      {tout.name[0]}
    </div>
  );
}

/** Stamped across a card once the call has played out. */
function LostStamp({ label, delay }: { label: string; delay: number }) {
  const t = usePop(delay);
  if (t <= 0.01) return null;
  return (
    <div
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `rgba(20,19,18,${0.75 * Math.min(t, 1)})`, borderRadius: 36,
      }}
    >
      <div
        style={{
          border: `8px solid ${C.negative}`, color: C.negative, background: C.bg, borderRadius: 20, padding: '10px 36px',
          fontFamily: FONT_SANS, fontWeight: 900, fontSize: 84, letterSpacing: 2,
          transform: `rotate(-8deg) scale(${interpolate(t, [0, 1], [2.2, 1])})`, opacity: Math.min(t, 1),
        }}
      >
        LOST {label}
      </div>
    </div>
  );
}

function Tweet({ tout, delay, lostAt, tilt }: { tout: Tout; delay: number; lostAt?: number; tilt: number }) {
  const t = usePop(delay);
  return (
    <div
      style={{
        position: 'relative', background: '#fff', color: '#0F1419', borderRadius: 36, padding: 44,
        fontFamily: FONT_SANS, boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        transform: `translateX(${interpolate(t, [0, 1], [tilt > 0 ? 1200 : -1200, 0])}px) rotate(${tilt}deg)`,
      }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Avatar tout={tout} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 38 }}>{tout.name} <span style={{ color: '#1D9BF0' }}>✔</span></div>
          <div style={{ color: '#536471', fontSize: 32 }}>{tout.handle}</div>
        </div>
      </div>
      <div style={{ fontSize: 44, lineHeight: 1.3, marginTop: 28 }}>{tout.text}</div>
      <div style={{ display: 'flex', gap: 48, marginTop: 28, color: '#536471', fontSize: 30 }}>
        <span>💬 2.1K</span><span>🔁 8.4K</span><span>♥ 41K</span>
      </div>
      {lostAt != null && <LostStamp label={tout.result} delay={lostAt} />}
    </div>
  );
}

/** Beat 1: the feed. Tweets fly in; later the same cards get stamped. */
export function TweetStorm({ stampFrom }: { stampFrom?: number }) {
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 60, gap: 40 }}>
      {TOUTS.map((tout, i) => (
        <Tweet
          key={tout.handle}
          tout={tout}
          delay={stampFrom != null ? -100 : i * 10}
          lostAt={stampFrom != null ? stampFrom + i * 8 : undefined}
          tilt={i % 2 === 0 ? -2 : 2}
        />
      ))}
    </AbsoluteFill>
  );
}

/**
 * Beat 2: a TikTok-style "trust me" post. Pass `videoSrc` (a file in public/)
 * to drop in real, licensed footage; otherwise it shows a mock talking-head card.
 */
export function TrustMeTok({ tout, caption, videoSrc }: { tout: Tout; caption: string; videoSrc?: string }) {
  const frame = useCurrentFrame();
  const t = usePop(0);
  const pulse = 1 + Math.sin(frame / 4) * 0.03;

  return (
    <AbsoluteFill style={{ transform: `scale(${interpolate(t, [0, 1], [1.15, 1])})`, opacity: Math.min(t, 1) }}>
      {videoSrc ? (
        <OffthreadVideo src={staticFile(videoSrc)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <AbsoluteFill style={{ background: `linear-gradient(160deg, ${tout.tint}, #0b0b0b 70%)`, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ transform: `scale(${pulse})` }}><Avatar tout={tout} size={360} /></div>
        </AbsoluteFill>
      )}
      <div
        style={{
          position: 'absolute', top: 360, left: 60, right: 60, textAlign: 'center',
          fontFamily: FONT_SANS, fontWeight: 900, fontSize: 92, lineHeight: 1.05, color: '#fff',
          whiteSpace: 'pre-line', textShadow: '0 6px 0 #000, 0 0 30px rgba(0,0,0,0.6)', transform: `scale(${pulse})`,
        }}
      >
        {caption}
      </div>
      <div style={{ position: 'absolute', right: 40, bottom: 420, display: 'flex', flexDirection: 'column', gap: 44, alignItems: 'center', color: '#fff', fontFamily: FONT_SANS, fontSize: 30, fontWeight: 700 }}>
        <div style={{ fontSize: 72 }}>♥</div><div>1.2M</div>
        <div style={{ fontSize: 72 }}>💬</div><div>18K</div>
        <div style={{ fontSize: 72 }}>↗</div><div>94K</div>
      </div>
      <div style={{ position: 'absolute', left: 48, bottom: 260, right: 200, color: '#fff', fontFamily: FONT_SANS }}>
        <div style={{ fontWeight: 800, fontSize: 40 }}>{tout.handle}</div>
        <div style={{ fontSize: 34, marginTop: 12, opacity: 0.9 }}>link in bio for VIP 🔥 #picks #money</div>
      </div>
    </AbsoluteFill>
  );
}

/** Beat 3: a portfolio line falling off a cliff. */
export function Crash() {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });
  const pts = Array.from({ length: 40 }, (_, i) => {
    const x = i / 39;
    const y = x < 0.45 ? 0.3 - x * 0.25 + Math.sin(i * 1.7) * 0.03 : 0.2 + (x - 0.45) * 1.35 + Math.sin(i * 2.3) * 0.04;
    return [60 + x * 840, 80 + y * 700] as const;
  }).slice(0, Math.max(2, Math.round(40 * p)));
  const value = Math.round(interpolate(p, [0, 0.45, 1], [5000, 5600, 740]));

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', paddingTop: 200 }}>
      <div style={{ fontFamily: FONT_SANS, fontWeight: 900, fontSize: 150, color: p > 0.5 ? C.negative : C.text }}>
        ${value.toLocaleString()}
      </div>
      <svg width={960} height={900}>
        <polyline points={pts.map((q) => q.join(',')).join(' ')} fill="none" stroke={p > 0.5 ? C.negative : C.positive} strokeWidth={12} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
}

/** Big centred statement, used for the turn from problem to product. */
export function Statement({ lines, accent }: { lines: string[]; accent?: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 80, gap: 24 }}>
      {lines.map((line, i) => {
        const o = interpolate(frame, [i * 14, i * 14 + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <div key={line} style={{ fontFamily: FONT_SERIF, fontWeight: 700, fontSize: 104, lineHeight: 1.05, color: i === accent ? C.brand : C.text, opacity: o, transform: `translateY(${(1 - o) * 30}px)` }}>
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}

/** Shared opener for both variants so the A/B test isolates the solution. */
export const PROBLEM_BEATS = [
  { seconds: 2.5, render: () => <TweetStorm /> },
  { seconds: 1.5, render: () => <TrustMeTok tout={TOUTS[0]} caption={'TRUST ME\nYOU CAN’T LOSE 🔒'} /> },
  { seconds: 1.3, render: () => <TrustMeTok tout={TOUTS[1]} caption={'50X BY FRIDAY 🚀'} /> },
  { seconds: 2.5, render: () => <TweetStorm stampFrom={6} /> },
  { seconds: 1.8, render: () => <Crash /> },
  { seconds: 2.6, render: () => <Statement lines={['They sell certainty.', 'Nobody has it.']} accent={1} /> },
  { seconds: 2.8, render: () => <Statement lines={['Why listen', 'to advice', 'when you can', 'listen to', 'the math?']} accent={4} /> },
];
