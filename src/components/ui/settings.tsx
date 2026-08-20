import React from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const ICON_TILE = 32;
const ROW_PADDING = 14;
/** Hairlines start after the icon tile, iOS-style, so groups read as one list. */
const DIVIDER_INSET = ICON_TILE + ROW_PADDING + 12;

export type RowTone = 'default' | 'brand' | 'danger';

/**
 * A titled group of rows rendered as one card with inset hairlines between
 * children. Falsy children are skipped so a conditional row (Face ID on a
 * device without it) doesn't leave a stray divider behind.
 */
export function SettingsSection({
  title,
  footer,
  children,
}: React.PropsWithChildren<{ title?: string; footer?: string }>): React.ReactElement {
  const theme = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <ThemedText
          style={{
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.9,
            color: theme.textTertiary,
            paddingHorizontal: 6,
          }}>
          {title.toUpperCase()}
        </ThemedText>
      ) : null}

      <View
        style={{
          borderRadius: Radius.xl,
          backgroundColor: theme.backgroundElevated,
          borderWidth: 1,
          borderColor: theme.border,
          overflow: 'hidden',
          ...Shadow.card,
        }}>
        {rows.map((row, index) => (
          <View key={index}>
            {index > 0 ? (
              <View style={{ height: 1, marginLeft: DIVIDER_INSET, backgroundColor: theme.border }} />
            ) : null}
            {row}
          </View>
        ))}
      </View>

      {footer ? (
        <ThemedText
          style={{ fontSize: 11, lineHeight: 16, color: theme.textTertiary, paddingHorizontal: 6 }}>
          {footer}
        </ThemedText>
      ) : null}
    </View>
  );
}

interface SettingsRowProps {
  icon?: string;
  label: string;
  description?: string;
  /** Right-aligned current value, e.g. the selected currency. */
  value?: string;
  onPress?: () => void;
  /** Replaces the chevron — a Switch, a spinner, a badge. */
  accessory?: React.ReactNode;
  /** Off for rows that act in place (confirm dialogs, sheets) rather than navigate. */
  chevron?: boolean;
  tone?: RowTone;
  disabled?: boolean;
}

export function SettingsRow({
  icon,
  label,
  description,
  value,
  onPress,
  accessory,
  chevron = true,
  tone = 'default',
  disabled = false,
}: SettingsRowProps): React.ReactElement {
  const theme = useTheme();
  const tint = tone === 'danger' ? Accent.red : tone === 'brand' ? Brand[500] : theme.textSecondary;
  const labelColor = tone === 'danger' ? Accent.red : theme.text;

  const body = (
    <View
      className="flex-row items-center"
      style={{
        paddingHorizontal: ROW_PADDING,
        paddingVertical: 12,
        minHeight: 58,
        gap: 12,
        opacity: disabled ? 0.45 : 1,
      }}>
      {icon ? (
        <View
          style={{
            width: ICON_TILE,
            height: ICON_TILE,
            borderRadius: Radius.sm,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tone === 'default' ? theme.backgroundSelected : tint + '1F',
          }}>
          <ThemedText style={{ fontSize: 15 }}>{icon}</ThemedText>
        </View>
      ) : null}

      <View className="flex-1" style={{ gap: 2 }}>
        <ThemedText style={{ fontSize: 15, fontWeight: '600', color: labelColor }}>{label}</ThemedText>
        {description ? (
          <ThemedText style={{ fontSize: 12, lineHeight: 16, color: theme.textTertiary }}>
            {description}
          </ThemedText>
        ) : null}
      </View>

      {value ? (
        <ThemedText style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary }}>
          {value}
        </ThemedText>
      ) : null}

      {accessory ??
        (onPress && chevron ? (
          <ThemedText style={{ fontSize: 19, color: theme.textTertiary, marginRight: -2 }}>›</ThemedText>
        ) : null)}
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      android_ripple={{ color: theme.backgroundSelected }}
      style={({ pressed }) => ({ backgroundColor: pressed ? theme.backgroundSelected : 'transparent' })}>
      {body}
    </Pressable>
  );
}

/** A row whose accessory is a themed Switch. Tapping the row label also toggles. */
export function SettingsSwitchRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: {
  icon?: string;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <SettingsRow
      icon={icon}
      label={label}
      description={description}
      disabled={disabled}
      accessory={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: theme.backgroundSelected, true: Brand[500] }}
          thumbColor={Platform.OS === 'android' ? (value ? '#FFFFFF' : theme.textTertiary) : undefined}
          ios_backgroundColor={theme.backgroundSelected}
          accessibilityLabel={label}
        />
      }
    />
  );
}

/** Inline chip picker used inside a section for short option lists. */
export function SettingsChoiceRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly { value: T; label: string; hint?: string }[];
  selected: T;
  onSelect: (value: T) => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View className="flex-row flex-wrap" style={{ padding: 12, gap: 8 }}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            className="active:opacity-70"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 9,
              borderRadius: Radius.md,
              borderWidth: 1,
              borderColor: active ? Brand[500] : theme.border,
              backgroundColor: active ? Brand[500] + '1A' : theme.backgroundElement,
            }}>
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: '700',
                color: active ? Brand[500] : theme.textSecondary,
              }}>
              {option.label}
            </ThemedText>
            {option.hint ? (
              <ThemedText style={{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }}>
                {option.hint}
              </ThemedText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
