import { Composition } from 'remotion';

import './fonts';
import { FPS, H, W } from './theme';
import { totalFrames } from './variants/Beat';
import { APP_STORY_BEATS, AppStory } from './variants/AppStory';
import { PREDICTION_BEATS, PredictionMarkets } from './variants/PredictionMarkets';

export function Root() {
  return (
    <>
      <Composition id="AppStory" component={AppStory} durationInFrames={totalFrames(APP_STORY_BEATS)} fps={FPS} width={W} height={H} />
      <Composition id="PredictionMarkets" component={PredictionMarkets} durationInFrames={totalFrames(PREDICTION_BEATS)} fps={FPS} width={W} height={H} />
    </>
  );
}
