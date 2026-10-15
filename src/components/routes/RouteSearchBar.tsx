import { Pressable, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { Brand, Radius, bodyFontFamily } from '@/constants/theme';
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
          paddingHorizontal: 14,
          borderRadius: Radius.pill,
          // Brand-edged even when idle: it is the most direct way to find a route,
          // and a grey field read as part of the furniture.
          borderWidth: 1.5,
          borderColor: active ? Brand[500] : Brand[500] + '73',
          backgroundColor: Brand[500] + '0F',
        }}>
        <Icon glyph="🔎" size={16} color={Brand[500]} />
        {/* The placeholder is drawn here, not by TextInput: on iOS (RN 0.85) the native
            placeholder rendered below the field's centre line and clipped, while typed
            text sat correctly. */}
        <View className="flex-1 justify-center" style={{ height: 44 }}>
          {value.length === 0 ? (
            <ThemedText
              numberOfLines={1}
              pointerEvents="none"
              style={{ position: 'absolute', left: 0, right: 0, fontSize: 15, fontFamily: bodyFontFamily('600'), color: theme.textSecondary }}>
              Search Tesla, gold, US Open…
            </ThemedText>
          ) : null}
          <TextInput
            value={value}
            onChangeText={onChange}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search all routes by keyword"
            style={{ color: theme.text, fontSize: 15, fontFamily: bodyFontFamily('600'), height: 44, paddingVertical: 0 }}
          />
        </View>
        {value.length > 0 ? (
          <Pressable
            onPress={() => onChange('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            className="active:opacity-60 items-center justify-center"
            style={{ minWidth: 28, minHeight: 28 }}>
            <Icon glyph="✕" size={17} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {status ? (
        <ThemedText style={{ fontSize: 11, color: theme.textSecondary, paddingHorizontal: 4 }}>
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}
