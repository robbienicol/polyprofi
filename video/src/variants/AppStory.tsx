import { AbsoluteFill } from 'remotion';

import { Background } from '../components/Background';
import { Caption } from '../components/Caption';
import { EndCard } from '../components/EndCard';
import { PhoneClip } from '../components/PhoneClip';
import { PROBLEM_BEATS, Statement } from '../components/Problem';
import { Beats, type BeatSpec } from './Beat';

// Variant A: problem (touts) → Pathey as a whole: you set the goal, it prices every route.
// Tune `from` to land on the best moment of each capture.
export const APP_STORY_BEATS: BeatSpec[] = [
  ...PROBLEM_BEATS,
  { seconds: 2.4, render: () => <Statement lines={['Pathey doesn’t pick.', 'You do.']} accent={1} /> },
  { seconds: 3.2, render: () => (<><Caption text="Set the goal. It prices every route." /><PhoneClip src="05-home-goals.mp4" from={2} /></>) },
  { seconds: 3.2, render: () => (<><Caption text="Safest first. Scored out of 100." sub="Every score opens into its working." /><PhoneClip src="01-routes-list.mp4" from={1} /></>) },
  { seconds: 3.2, render: () => (<><Caption text="Including what could go wrong." /><PhoneClip src="06-coach.mp4" from={5} /></>) },
  { seconds: 3.5, render: () => <EndCard cta="usepathey.com/a" /> },
];

export function AppStory() {
  return (
    <AbsoluteFill>
      <Background />
      <Beats beats={APP_STORY_BEATS} />
    </AbsoluteFill>
  );
}
