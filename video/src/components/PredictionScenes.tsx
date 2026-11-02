import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { C, FONT_SANS, FONT_SERIF } from '../theme';

const card: React.CSSProperties = {
  background: C.card,
  border: `2px solid ${C.border}`,
  borderRadius: 48,
  padding: 56,
  fontFamily: FONT_SANS,
  color: C.text,
};

function useIn(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping: 200 } });
}

/**
 * Real numbers from src/lib/calibration-data.ts (built 2026-09-07): the 35–50¢
 * bucket averages a 43¢ price across 1,655 settled markets and resolved Yes 38%
 * of the time. Rebuild these if the calibration table is regenerated.
 */
export function CalibrationScene() {
  const price = useIn(10);
  const actual = useIn(40);
  const note = useIn(70);
  const bar = (label: string, pct: number, t: number, color: string) => (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 40, marginBottom: 20 }}>
        <span style={{ color: C.muted }}>{label}</span>
        <span style={{ fontWeight: 800 }}>{Math.round(pct * t)}%</span>
      </div>
      <div style={{ height: 36, borderRadius: 18, background: C.border }}>
        <div style={{ width: `${pct * t}%`, height: '100%', borderRadius: 18, background: color }} />
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 72, paddingTop: 420 }}>
      <div style={card}>
        {bar('Market price', 43, price, C.muted)}
        {bar('Actually happened', 38, actual, C.brand)}
        <div style={{ fontSize: 34, color: C.muted, opacity: note }}>1,655 settled markets priced like this one.</div>
      </div>
    </AbsoluteFill>
  );
}

/** Illustrative de-vig: Yes 53¢ + No 50¢ = 103¢ → the 3¢ is the house's. */
export function MarginScene() {
  const frame = useCurrentFrame();
  const sum = useIn(20);
  const strip = useIn(55);
  const yes = interpolate(strip, [0, 1], [53, 51.5]);

  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: 72, paddingTop: 420 }}>
      <div style={{ ...card, fontSize: 48 }}>
        <Row label="Yes" value={`${yes.toFixed(1)}¢`} />
        <Row label="No" value={`${interpolate(strip, [0, 1], [50, 48.5]).toFixed(1)}¢`} />
        <div style={{ height: 2, background: C.border, margin: '32px 0' }} />
        <div style={{ opacity: sum }}>
          <Row
            label="Total"
            value={`${Math.round(interpolate(strip, [0, 1], [103, 100]))}¢`}
            color={strip > 0.5 ? C.positive : C.negative}
          />
        </div>
        <div style={{ marginTop: 40, fontSize: 36, color: C.muted, opacity: interpolate(frame, [70, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          The extra 3¢ is the exchange's cut. We take it out.
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Row({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0' }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

/** Mirrors MarketComparisonCard in the app. Prices are illustrative. */
export function ComparisonScene() {
  const k = useIn(10);
  const p = useIn(25);
  const badge = useIn(55);
  const venue = (name: string, price: string, t: number, win: boolean) => (
    <div
      style={{
        ...card,
        flex: 1,
        padding: 44,
        textAlign: 'center',
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [60, 0])}px)`,
        borderColor: win && badge > 0.5 ? C.positive : C.border,
      }}
    >
      <div style={{ fontSize: 36, color: C.muted }}>{name}</div>
      <div style={{ fontFamily: FONT_SERIF, fontSize: 110, fontWeight: 700, marginTop: 16 }}>{price}</div>
      <div style={{ fontSize: 30, color: C.muted }}>Yes</div>
    </div>
  );

  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: 72, paddingTop: 420, gap: 56 }}>
      <div style={{ display: 'flex', gap: 32, width: '100%' }}>
        {venue('Kalshi', '58¢', k, true)}
        {venue('Polymarket', '61¢', p, false)}
      </div>
      <div
        style={{
          padding: '22px 44px',
          borderRadius: 999,
          background: `${C.positive}30`,
          color: C.positive,
          fontFamily: FONT_SANS,
          fontWeight: 900,
          fontSize: 44,
          transform: `scale(${badge})`,
        }}
      >
        +3¢ ON KALSHI
      </div>
    </AbsoluteFill>
  );
}
