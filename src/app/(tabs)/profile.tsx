import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth, useUser } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import { useRouter, type Href } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBiometricLock } from '@/api/hooks/useBiometricLock';
import { useDeleteAccount } from '@/api/hooks/useDeleteAccount';
import { useMoney, usePreferences } from '@/api/hooks/usePreferences';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useTrackedBets } from '@/api/hooks/useTrackedBets';
import { ThemedText } from '@/components/themed-text';
import {
  SettingsChoiceRow,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/ui/settings';
import { Accent, Brand, Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { requestAppRating } from '@/lib/app-rating';
import { requestNotificationPermission, syncWeeklyReminder } from '@/lib/notifications';
import { ACQUISITION_PLATFORMS, CURRENCIES, currencyMeta, type CurrencyCode } from '@/lib/preferences';
import type { AcquisitionPlatform } from '@/types/bets';

const SUPPORT_EMAIL = 'creators@tryzalt.com';

const CURRENCY_OPTIONS = CURRENCIES.map((entry) => ({
  value: entry.code as CurrencyCode,
  label: `${entry.symbol} ${entry.code}`,
}));

export default function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { history } = useSavedRoutes();
  const { bets } = useTrackedBets();
  const { goal } = useSavingsGoal();
  const { preferences, update } = usePreferences();
  const money = useMoney();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    setEnabled: setBiometricEnabled,
  } = useBiometricLock();
  const { deleteAccount, isDeleting } = useDeleteAccount();
  const [deleteError, setDeleteError] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const togglePlatform = useCallback(
    (platform: AcquisitionPlatform, enabled: boolean) => {
      const next = enabled
        ? ACQUISITION_PLATFORMS.map((entry) => entry.value).filter(
            (value) => value === platform || preferences.preferredPlatforms.includes(value))
        : preferences.preferredPlatforms.filter((value) => value !== platform);
      update({ preferredPlatforms: next });
    },
    [preferences.preferredPlatforms, update],
  );

  const activeCount = useMemo(() => bets.filter((bet) => bet.status === 'active').length, [bets]);
  const latestSearch = history[0] ?? null;
  const initials = useMemo(() => {
    const first = user?.firstName?.[0] ?? '';
    const last = user?.lastName?.[0] ?? '';
    return (first + last || user?.primaryEmailAddress?.emailAddress?.[0] || 'P').toUpperCase();
  }, [user]);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const memberSince = useMemo(() => {
    const created = user?.createdAt;
    return created
      ? new Date(created).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : null;
  }, [user?.createdAt]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/sign-in');
  }, [signOut, router]);

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  }, [handleSignOut]);

  const performDelete = useCallback(async () => {
    setDeleteError('');
    try {
      await deleteAccount();
      await AsyncStorage.clear();
      await signOut();
      router.replace('/sign-in');
    } catch {
      setDeleteError('Could not delete your account. Please try again.');
    }
  }, [deleteAccount, signOut, router]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, profile, and everything saved on this device. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ],
    );
  }, [performDelete]);

  // A stored "on" that the OS will never deliver is worse than an honest off, so
  // a declined permission prompt flips the switch straight back.
  const enableNotification = useCallback(
    async (key: 'positionAlerts' | 'weeklyReminder', next: boolean) => {
      if (!next) {
        update({ [key]: false });
        if (key === 'weeklyReminder') void syncWeeklyReminder(false);
        return;
      }
      update({ [key]: true });
      const granted = await requestNotificationPermission();
      if (!granted) {
        update({ [key]: false });
        Alert.alert(
          'Notifications are off',
          'Turn on notifications for Pathey in your device settings to get these alerts.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
        return;
      }
      if (key === 'weeklyReminder') void syncWeeklyReminder(true);
    },
    [update],
  );

  const contactSupport = useCallback(() => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Pathey%20support%20(v${version})`);
  }, [version]);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pt-4 pb-16 gap-6">
          <View style={{ paddingHorizontal: 2 }}>
            <ThemedText style={{ fontSize: 11, fontWeight: '900', color: Brand[500], letterSpacing: 1.1 }}>
              PATHEY
            </ThemedText>
            <ThemedText style={{ fontSize: 26, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginTop: 3 }}>
              Settings
            </ThemedText>
          </View>

          {/* Account */}
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
              <ThemedText style={{ fontSize: 20, fontWeight: '900', color: '#06140C' }}>{initials}</ThemedText>
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

          {/* Money */}
          <SettingsSection
            title="Money"
            footer="Currency changes how amounts are written. Market prices are quoted in USD and are not converted.">
            <SettingsRow
              icon="💱"
              label="Display currency"
              value={`${currencyMeta(preferences.currency).symbol} ${preferences.currency}`}
              onPress={() => setCurrencyOpen((open) => !open)}
              accessory={
                <ThemedText style={{ fontSize: 15, color: theme.textTertiary }}>
                  {currencyOpen ? '▴' : '▾'}
                </ThemedText>
              }
            />
            {currencyOpen ? (
              <SettingsChoiceRow
                options={CURRENCY_OPTIONS}
                selected={preferences.currency}
                onSelect={(currency) => update({ currency })}
              />
            ) : null}
            <SettingsSwitchRow
              icon="🛡"
              label="Conservative projections"
              description="Assume stocks & crypto return 0% in portfolio math"
              value={preferences.conservativeProjections}
              onValueChange={(conservativeProjections) => update({ conservativeProjections })}
            />
            <SettingsRow
              icon={goal?.emoji ?? '🎯'}
              label="Profit goal"
              description={goal ? goal.label : 'Not set yet'}
              value={goal ? money(goal.targetAmount, { decimals: 0, signed: true }) : undefined}
              onPress={() => router.push('/goal-setup')}
            />
          </SettingsSection>

          {/* Where routes can be placed — applied to every search */}
          <SettingsSection
            title="Where I invest"
            footer={
              preferences.preferredPlatforms.length === 0
                ? 'No apps selected — searches will open whichever marketplace supports the route.'
                : 'Every search is steered to these apps. If a route isn\'t on any of them, we open the closest supported marketplace.'
            }>
            {ACQUISITION_PLATFORMS.map((platform) => (
              <SettingsSwitchRow
                key={platform.value}
                icon={platform.icon}
                label={platform.label}
                description={platform.description}
                value={preferences.preferredPlatforms.includes(platform.value)}
                onValueChange={(next) => togglePlatform(platform.value, next)}
              />
            ))}
          </SettingsSection>

          {/* Notifications */}
          <SettingsSection
            title="Notifications"
            footer="Alerts are scheduled on this device only — nothing is sent to a server.">
            <SettingsSwitchRow
              icon="🔔"
              label="Position alerts"
              description="Tell me when a position hits my profit goal"
              value={preferences.positionAlerts}
              onValueChange={(next) => void enableNotification('positionAlerts', next)}
            />
            <SettingsSwitchRow
              icon="🗓"
              label="Weekly route reminder"
              description="Sunday evening nudge with fresh routes"
              value={preferences.weeklyReminder}
              onValueChange={(next) => void enableNotification('weeklyReminder', next)}
            />
          </SettingsSection>

          {/* Security — only meaningful on a device with biometrics enrolled */}
          {biometricAvailable ? (
            <SettingsSection title="Security">
              <SettingsSwitchRow
                icon="🔒"
                label="Require Face ID"
                description="Lock the app when it’s reopened, no password needed"
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
              />
            </SettingsSection>
          ) : null}

          {/* Activity */}
          <SettingsSection title="Activity">
            <SettingsRow
              icon="📋"
              label="Tracked positions"
              value={activeCount > 0 ? `${activeCount} active` : 'None'}
              onPress={() => router.push('/positions')}
            />
            <SettingsRow
              icon="🧭"
              label="Latest routes"
              description={
                latestSearch
                  ? `${money(latestSearch.quizSnapshot.balance, { decimals: 0 })} → ${money(
                      latestSearch.quizSnapshot.balance + latestSearch.quizSnapshot.target,
                      { decimals: 0 },
                    )} · ${latestSearch.quizSnapshot.riskTolerance ?? 'balanced'} risk`
                  : 'Take the quiz to generate ranked routes'
              }
              value={latestSearch ? `${latestSearch.routes.length}` : undefined}
              onPress={() => router.push(latestSearch ? '/(tabs)/routes' : '/quiz')}
            />
          </SettingsSection>

          {/* About */}
          <SettingsSection title="About">
            <SettingsRow icon="⭐️" label="Rate Pathey" chevron={false} onPress={() => void requestAppRating()} />
            <SettingsRow icon="✉️" label="Contact support" description={SUPPORT_EMAIL} onPress={contactSupport} />
            <SettingsRow icon="📄" label="Privacy Policy" onPress={() => router.push('/privacy' as Href)} />
            <SettingsRow icon="⚖️" label="Terms of Service" onPress={() => router.push('/terms' as Href)} />
            <SettingsRow icon="ℹ️" label="Version" value={version} />
          </SettingsSection>

          {/* Danger zone */}
          <SettingsSection>
            <SettingsRow icon="🚪" label="Sign out" tone="danger" chevron={false} onPress={confirmSignOut} />
            <SettingsRow
              icon="🗑"
              label="Delete account"
              description="Removes your account and all local data"
              tone="danger"
              chevron={false}
              disabled={isDeleting}
              onPress={handleDeleteAccount}
              accessory={isDeleting ? <ActivityIndicator color={Accent.red} /> : undefined}
            />
          </SettingsSection>

          {!!deleteError && (
            <ThemedText type="small" className="text-center" style={{ color: Accent.red }}>
              {deleteError}
            </ThemedText>
          )}

          <ThemedText
            style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', opacity: 0.6 }}>
            AI-generated · Not financial advice · For entertainment only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
