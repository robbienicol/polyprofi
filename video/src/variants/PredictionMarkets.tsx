import { AbsoluteFill } from 'remotion';

import { Background } from '../components/Background';
import { Caption } from '../components/Caption';
import { EndCard } from '../components/EndCard';
import { PhoneClip } from '../components/PhoneClip';
import { CalibrationScene, ComparisonScene, MarginScene } from '../components/PredictionScenes';
import { PROBLEM_BEATS, Statement } from '../components/Problem';
import { Beats, type BeatSpec } from './Beat';

// Variant B: problem (touts) → what Pathey does to a prediction-market contract
// so you can judge it yourself: calibration, de-vig, cross-venue price.
export const PREDICTION_BEATS: BeatSpec[] = [
  ...PROBLEM_BEATS,
  { seconds: 2.4, render: () => <Statement lines={['Skip the guru.', 'Read the market.']} accent={1} /> },
  { seconds: 3.4, render: () => (<><Caption text="Check every price against how it actually settled." size={64} /><CalibrationScene /></>) },
  { seconds: 3, render: () => (<><Caption text="Exchange margin, removed." /><MarginScene /></>) },
  { seconds: 3, render: () => (<><Caption text="Kalshi vs Polymarket. Side by side." /><ComparisonScene /></>) },
  { seconds: 2.6, render: () => (<><Caption text="Then you decide." /><PhoneClip src="02-prediction-filters.mp4" from={2} /></>) },
  { seconds: 3.5, render: () => <EndCard cta="usepathey.com/b" /> },
];

export function PredictionMarkets() {
  return (
    <AbsoluteFill>
      <Background />
      <Beats beats={PREDICTION_BEATS} />
    </AbsoluteFill>
  );
}
