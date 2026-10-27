import React, { useState } from 'react';
import { View } from 'react-native';

import { Choice, Options } from '@/components/onboarding/quiz-kit';
import { FreeText } from '@/components/onboarding/survey/FreeText';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { SurveyAnswers } from '@/lib/onboarding-profile';
import { matchStates, NON_US } from '@/lib/us-states';

/**
 * Fifty-one options is too many to scan as chips, so the list narrows as they
 * type — "new" leaves the four New states, "fl" leaves Florida. Nothing is
 * autofocused: most people scroll to their own state faster than they type it.
 */
export function ResidencePicker({
  value,
  onChange,
}: {
  value: SurveyAnswers['residenceState'];
  onChange: (code: NonNullable<SurveyAnswers['residenceState']>) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const matches = matchStates(query);

  return (
    <View style={{ gap: 12 }}>
      <FreeText value={query} placeholder="Search states" maxLength={24} onChangeText={setQuery} />
      {matches.length > 0 ? (
        <Options>
          {matches.map((state) => (
            <Choice
              key={state.code}
              label={state.name}
              selected={value === state.code}
              onPress={() => onChange(state.code)}
            />
          ))}
        </Options>
      ) : (
        <ThemedText style={{ fontSize: 13, color: theme.textTertiary }}>No state matches that.</ThemedText>
      )}
      <Options>
        <Choice
          label="I live outside the US"
          wide
          selected={value === NON_US}
          onPress={() => onChange(NON_US)}
        />
      </Options>
    </View>
  );
}
