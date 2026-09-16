import Slider from '@react-native-community/slider';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, Semantic } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { normalizeScoreWeights, SCORE_WEIGHT_KEYS, type ScoreWeights } from '@/lib/score';

const MONO = { fontVariant: ['tabular-nums' as const] };

/**
 * What each slider is actually asking for, in the user's terms rather than the
 * component's name. `raises` and `lowers` name the routes that move up and down the
 * list as it goes right — the honest way to explain a weight, because a weight can
 * only ever trade one kind of route against another.
 */
const SLIDER_COPY: Record<keyof ScoreWeights, {
  label: string;
  question: string;
  raises: string;
  lowers: string;
}> = {
  reliability: {
    label: 'Chance of hitting it',
    question: 'How much does the odds of actually reaching the goal matter?',
    raises: 'favours high-probability routes',
    lowers: 'lets long shots compete on their other merits',
  },
  principalProtection: {
    label: 'Protecting your money',
    question: 'How much does keeping your stake when it goes wrong matter?',
    raises: 'favours T-bills, index funds and routes with a stop',
    lowers: 'lets all-or-nothing contracts rank on odds alone',
  },
  capitalEfficiency: {
    label: 'Using less cash',
    question: 'How much does reaching the goal on a small stake matter?',
    raises: 'favours routes that need less money up front',
    lowers: 'stops big-stake safe routes being penalised for their size',
  },
  timeEfficiency: {
    label: 'Getting there sooner',
    question: 'How much does finishing early rather than at the deadline matter?',
    raises: 'favours routes that resolve well before your deadline',
    lowers: 'treats anything inside the deadline as equally soon',
  },
};

interface ScoreWeightSlidersProps {
  /** Raw slider positions, 0-100 each. See Preferences.scoreWeights. */
  weights: ScoreWeights;
  onChange: (weights: ScoreWeights) => void;
  onReset: () => void;
  isDefault: boolean;
}

/**
 * The score, made by the person it is for. The four weights were fixed constants,
 * so "best route" meant one thing for everyone; these sliders hand that judgement
 * over and re-rank the list live.
 *
 * Every slider shows the share of the score it currently owns, because that — not
 * its own position — is what actually changed: the weights are normalised, so
 * raising one lowers the other three. Saying so out loud is the only way the
 * control is honest about what it does.
 */
export function ScoreWeightSliders({
  weights,
  onChange,
  onReset,
  isDefault,
}: ScoreWeightSlidersProps): React.ReactElement {
  const theme = useTheme();
  // Where the thumbs are mid-drag. `onChange` persists to storage and re-ranks the
  // whole pool, so it fires once per drag rather than on every event a drag emits —
  // otherwise the sliders stutter against their own disk writes.
  const [dragging, setDragging] = useState<ScoreWeights | null>(null);
  const shown = dragging ?? weights;
  const shares = normalizeScoreWeights(shown);
  const allZero = SCORE_WEIGHT_KEYS.every((key) => (shown[key] ?? 0) <= 0);

  return (
    <View
      style={{
        borderRadius: Radius.lg,
        backgroundColor: theme.backgroundElement,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 14,
      }}>
      <View className="flex-row items-start justify-between" style={{ gap: 10 }}>
        <View className="flex-1">
          <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 0.8 }}>
            YOUR SCORE
          </ThemedText>
          <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textSecondary, marginTop: 3 }}>
            Every route is scored out of 100 on these four things. Decide how much each one
            counts and the list re-ranks when you let go.
          </ThemedText>
        </View>
        {isDefault ? null : (
          <Pressable
            onPress={() => {
              setDragging(null);
              onReset();
            }}
            accessibilityRole="button"
            accessibilityLabel="Reset the score to its default weighting"
            hitSlop={8}
            className="active:opacity-70">
            <ThemedText style={{ fontSize: 12, fontWeight: '800', color: Brand[500] }}>Reset</ThemedText>
          </Pressable>
        )}
      </View>

      {allZero ? (
        <ThemedText style={{ fontSize: 11, lineHeight: 15, color: Semantic.caution, fontWeight: '700' }}>
          Everything is at zero, so there is nothing to rank on — the default weighting is
          being used until you raise one of these.
        </ThemedText>
      ) : null}

      {SCORE_WEIGHT_KEYS.map((key) => {
        const copy = SLIDER_COPY[key];
        const value = Math.max(0, Math.min(100, Math.round(shown[key] ?? 0)));
        const share = Math.round(shares[key] * 100);
        return (
          <View key={key} style={{ gap: 1 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 10 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
                {copy.label}
              </ThemedText>
              {/* The share, not the slider position: this is the number that moves the
                  ranking, and it changes when any OTHER slider moves too. */}
              <ThemedText
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  color: value === 0 ? theme.textTertiary : Brand[500],
                  ...MONO,
                }}>
                {value === 0 ? 'Ignored' : `${share}% of score`}
              </ThemedText>
            </View>
            <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
              {copy.question}
            </ThemedText>
            <Slider
              style={{ width: '100%', height: 32 }}
              minimumValue={0}
              maximumValue={100}
              step={5}
              value={value}
              onValueChange={(next) => setDragging({ ...shown, [key]: Math.round(next) })}
              onSlidingComplete={(next) => {
                setDragging(null);
                onChange({ ...weights, [key]: Math.round(next) });
              }}
              minimumTrackTintColor={Brand[500]}
              maximumTrackTintColor={theme.backgroundSelected}
              thumbTintColor={value === 0 ? theme.textTertiary : Brand[500]}
              accessibilityLabel={`${copy.label}: ${copy.question}`}
            />
            <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textSecondary }}>
              <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>Right: </ThemedText>
              {copy.raises}
              {'.  '}
              <ThemedText style={{ fontSize: 11, fontWeight: '800', color: theme.text }}>Left: </ThemedText>
              {copy.lowers}
              {'.'}
            </ThemedText>
          </View>
        );
      })}

      {/* The one thing sliders cannot do, said before someone tries. */}
      <ThemedText style={{ fontSize: 11, lineHeight: 15, color: theme.textTertiary }}>
        Only the balance between these counts, so raising all four changes nothing. A route
        you cannot afford, or one that resolves after your deadline, stays capped whatever
        you set here.
      </ThemedText>
    </View>
  );
}
