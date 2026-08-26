import { Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface RouteSearchBarProps {
  value: string;
  onChange: (keyword: string) => void;
  /** True while either live search is still resolving. */
  isSearching?: boolean;
  /** Routes pulled in from outside this goal's pool by the current keyword. */
  pulledInCount?: number;
}

/**
 * Free-text search over every route we can price. It sits above the filter chips
 * rather than inside the prediction panel because naming what you want is the most
 * direct filter there is, and it is not a prediction-market idea: "VOO", "gold" and
 * "US Open" are the same gesture.
 *
 * It reaches past the goal-scoped pool on both sides — the whole Polymarket catalog,
 * and the whole curated asset universe — so a market or fund the goal filter dropped
 * still shows when the user asks for it by name. The score is what tells the truth
 * about whether it gets them there; the search's job is only to find it.
 */
export function RouteSearchBar({
  value,
  onChange,
  isSearching = false,
  pulledInCount = 0,
}: RouteSearchBarProps): React.ReactElement {
  const theme = useTheme();
  const active = value.trim().length > 0;
  const status = !active
    ? null
    : isSearching
      ? 'Searching markets, funds and coins…'
      : pulledInCount > 0
        ? `${pulledInCount} pulled in from outside this goal's shortlist`
        : null;

  return (
    <View style={{ gap: 6 }}>
      <View
        className="flex-row items-center"
        style={{
          gap: 8,
          paddingHorizontal: 12,
          borderRadius: Radius.md,
          borderWidth: 1.5,
          borderColor: active ? Brand[500] : theme.borderStrong,
          backgroundColor: theme.backgroundElement,
        }}>
        <ThemedText style={{ fontSize: 14, color: theme.textTertiary }}>🔎</ThemedText>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Search anything — US Open, Tesla, gold, doge…"
          placeholderTextColor={theme.textTertiary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search all routes by keyword"
          style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600', paddingVertical: 11 }}
        />
        {value.length > 0 ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={8}
            className="active:opacity-60">
            <ThemedText style={{ fontSize: 15, color: theme.textTertiary }}>✕</ThemedText>
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <ThemedText style={{ fontSize: 11, color: theme.textTertiary, paddingHorizontal: 4 }}>
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}
