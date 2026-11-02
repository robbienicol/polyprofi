import React, { useState } from 'react';
import { TextInput } from 'react-native';

import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FreeText({
  value,
  placeholder,
  maxLength,
  onChangeText,
}: {
  value: string;
  placeholder: string;
  maxLength: number;
  onChangeText: (text: string) => void;
}): React.ReactElement {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={theme.textTertiary}
      maxLength={maxLength}
      returnKeyType="done"
      style={{
        borderWidth: 1.5,
        borderRadius: Radius.md,
        borderColor: focused ? Brand[500] : theme.borderStrong,
        backgroundColor: theme.backgroundElement,
        color: theme.text,
        fontSize: 15,
        fontWeight: '600',
        paddingVertical: 13,
        paddingHorizontal: 14,
      }}
    />
  );
}
