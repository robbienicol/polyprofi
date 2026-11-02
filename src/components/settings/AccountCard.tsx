import { useUser } from '@clerk/clerk-expo';
import React from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The signed-in person at the top of Settings: initials, name, email, member-since. */
export function AccountCard(): React.ReactElement {
  const theme = useTheme();
  const { user } = useUser();
  const initials = ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '') || user?.primaryEmailAddress?.emailAddress?.[0] || 'P').toUpperCase();
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null;

  return (
    <View
      style={{
        borderRadius: Radius.xl,
        backgroundColor: theme.backgroundElevated,
        borderWidth: 1,
        borderColor: theme.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...Shadow.card,
      }}>
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: Radius.lg,
          backgroundColor: Brand[500],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <ThemedText style={{ fontSize: 20, fontWeight: '900', color: OnBrand }}>{initials}</ThemedText>
      </View>
      <View className="flex-1" style={{ gap: 3 }}>
        <ThemedText style={{ fontSize: 18, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }} numberOfLines={1}>
          {user?.fullName || user?.firstName || 'Pathey user'}
        </ThemedText>
        <ThemedText style={{ fontSize: 12, color: theme.textTertiary }} numberOfLines={1}>
          {user?.primaryEmailAddress?.emailAddress ?? 'Signed in'}
        </ThemedText>
        {memberSince ? (
          <View
            className="self-start"
            style={{
              marginTop: 3,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: Radius.pill,
              backgroundColor: theme.backgroundSelected,
            }}>
            <ThemedText style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: theme.textSecondary }}>
              {`MEMBER SINCE ${memberSince.toUpperCase()}`}
            </ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}
