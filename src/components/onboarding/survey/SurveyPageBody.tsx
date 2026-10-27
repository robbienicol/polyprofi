import React from 'react';
import { View } from 'react-native';

import { Choice, Options } from '@/components/onboarding/quiz-kit';
import {
  AMOUNTS,
  MARKETS,
  OUTCOMES,
  scanTasks,
  SKIP,
  SOMETHING_ELSE,
  type PageId,
} from '@/components/onboarding/quiz-pages';
import { FreeText } from '@/components/onboarding/survey/FreeText';
import { NotificationAsk } from '@/components/onboarding/survey/NotificationAsk';
import { ResidencePicker } from '@/components/onboarding/survey/ResidencePicker';
import { ReviewPage } from '@/components/onboarding/survey/ReviewPage';
import { LoaderPage } from '@/components/onboarding/survey/ScanLoader';
import { ServicesStep } from '@/components/onboarding/survey/ServicesStep';
import { HORIZONS, type SurveyAnswers } from '@/lib/onboarding-profile';

export interface BodyProps {
  id: PageId;
  answers: SurveyAnswers;
  compact: boolean;
  /** True only for the page currently on screen — animations idle otherwise. */
  active: boolean;
  askingPermission: boolean;
  set: <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) => void;
  toggleIn: (key: 'markets' | 'avoidPlatforms', value: string) => void;
  onScanDone: () => void;
  onBankConnected: () => void;
  onEnableNotifications: () => void;
  onSkipNotifications: () => void;
  onJumpTo: (index: number) => void;
}

export function renderPageBody(props: BodyProps): React.ReactElement | null {
  const { id, answers, set, toggleIn } = props;

  switch (id) {
    case 'outcome':
      return (
        <View style={{ gap: 12 }}>
          <Options>
            {OUTCOMES.map((option) => (
              <Choice
                key={option.label}
                label={option.label}
                emoji={option.emoji}
                selected={answers.outcome === option.label}
                onPress={() => set('outcome', option.label)}
              />
            ))}
          </Options>
          {answers.outcome === SOMETHING_ELSE ? (
            <FreeText
              value={answers.outcomeOther}
              placeholder="What is it?"
              maxLength={60}
              onChangeText={(text) => set('outcomeOther', text)}
            />
          ) : null}
        </View>
      );

    case 'capital':
      return (
        <Options>
          {AMOUNTS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              note={option.note}
              wide={option.label === SKIP}
              selected={answers.amount === option.label}
              onPress={() => set('amount', option.label)}
            />
          ))}
        </Options>
      );

    case 'horizon':
      return (
        <Options>
          {HORIZONS.map((option) => (
            <Choice
              key={option.value}
              label={option.label}
              note={option.note}
              selected={answers.horizon === option.value}
              onPress={() => set('horizon', option.value)}
            />
          ))}
        </Options>
      );

    case 'residence':
      return (
        <ResidencePicker
          value={answers.residenceState}
          onChange={(code) => set('residenceState', code)}
        />
      );

    case 'markets':
      return (
        <Options>
          {MARKETS.map((option) => (
            <Choice
              key={option.label}
              label={option.label}
              emoji={option.emoji}
              multi
              selected={answers.markets.includes(option.label)}
              onPress={() => toggleIn('markets', option.label)}
            />
          ))}
        </Options>
      );

    case 'platforms':
      return (
        <ServicesStep
          avoidPlatforms={answers.avoidPlatforms}
          bankConnected={answers.bankConnected}
          onTogglePlatform={(value) => toggleIn('avoidPlatforms', value)}
          onBankConnected={props.onBankConnected}
        />
      );

    case 'scan':
      return <LoaderPage tasks={scanTasks(answers)} active={props.active} onDone={props.onScanDone} />;

    case 'notifications':
      return (
        <NotificationAsk
          busy={props.askingPermission}
          onEnable={props.onEnableNotifications}
          onSkip={props.onSkipNotifications}
        />
      );

    case 'review':
      return <ReviewPage answers={answers} onJumpTo={props.onJumpTo} />;

    default:
      return null;
  }
}
