import { Sequence } from 'remotion';

import { s } from '../theme';

export interface BeatSpec {
  seconds: number;
  render: () => React.ReactNode;
}

/** Lays beats end to end. Total length = sum of beat seconds. */
export function Beats({ beats }: { beats: BeatSpec[] }) {
  let at = 0;
  return (
    <>
      {beats.map((beat, i) => {
        const from = at;
        at += s(beat.seconds);
        return (
          <Sequence key={i} from={from} durationInFrames={s(beat.seconds)}>
            {beat.render()}
          </Sequence>
        );
      })}
    </>
  );
}

export const totalFrames = (beats: BeatSpec[]) => beats.reduce((n, b) => n + s(b.seconds), 0);
