import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBiometricLock } from '@/api/hooks/useBiometricLock';
import { useDeleteAccount } from '@/api/hooks/useDeleteAccount';
import { usePreferences } from '@/api/hooks/usePreferences';
import { AccountCard } from '@/components/settings/AccountCard';
import { MoneySection } from '@/components/settings/MoneySection';
import { ThemedText } from '@/components/themed-text';
import {
  SettingsChoiceRow,
  SettingsRow,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/ui/settings';
import { Brand, Semantic } from '@/constants/theme';
import { useDevSeedDemoData } from '@/hooks/use-dev-seed-demo-data';
import { useTheme } from '@/hooks/use-theme';
import { requestAppRating } from '@/lib/app-rating';
import { requestNotificationPermission, syncWeeklyReminder } from '@/lib/notifications';
import { ACQUISITION_PLATFORMS, APPEARANCE_OPTIONS } from '@/lib/preferences';
import { withTabSkeleton } from '@/components/ui/with-tab-skeleton';
import type { AcquisitionPlatform } from '@/types/bets';

const SUPPORT_EMAIL = 'team@usepathey.com';

function SettingsScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const { preferences, update } = usePreferences();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    setEnabled: setBiometricEnabled,
  } = useBiometricLock();
  const { deleteAccount, isDeleting } = useDeleteAccount();
  const [deleteError, setDeleteError] = useState('');
  const devSeed = useDevSeedDemoData();

  const togglePlatform = (platform: AcquisitionPlatform, enabled: boolean) => {
      const next = enabled
        ? ACQUISITION_PLATFORMS.map((entry) => entry.value).filter(
            (value) => value === platform || preferences.preferredPlatforms.includes(value))
        : preferences.preferredPlatforms.filter((value) => value !== platform);
      update({ preferredPlatforms: next });
    };

  const version = Constants.expoConfig?.version ?? '1.0.0';

  const queryClient = useQueryClient();
  const handleSignOut = async () => {
    await signOut();
    // The cache outlives the session (gcTime), so the next account to sign in on this
    // phone would otherwise be served this one's data from memory.
    queryClient.clear();
    router.replace('/sign-in');
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
    ]);
  };

  const performDelete = async () => {
    setDeleteError('');
    try {
      await deleteAccount();
    } catch {
      setDeleteError('Could not delete your account. Please try again.');
      return;
    }
    // The Clerk user is already gone, so signOut's session-end call can reject;
    // that must not surface as a failed deletion.
    await AsyncStorage.clear().catch(() => {});
    await signOut().catch(() => {});
    // Storage is wiped; the in-memory copies must go too or they reappear for
    // whoever signs up next without a relaunch.
    queryClient.clear();
    router.replace('/sign-in');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account',
      'This permanently deletes your account, profile, and everything saved on this device. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ],
    );
  };

  // A stored "on" that the OS will never deliver is worse than an honest off, so
  // a declined permission prompt flips the switch straight back.
  const enableNotification = async (key: 'positionAlerts' | 'weeklyReminder', next: boolean) => {
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
    };

  const contactSupport = () => {
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Pathey%20support%20(v${version})`);
  };

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
          <AccountCard />

          {/* Money */}
          <MoneySection preferences={preferences} update={update} />

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

          {/* Ranking */}
          <SettingsSection
            title="Ranking"
            footer="Routes are ranked by your chance of hitting the goal, each sized so its bad case stays under what you're OK losing.">
            <SettingsRow
              icon="🧭"
              label="Retake priorities quiz"
              description="Answer again to update your risk level and markets"
              onPress={() => router.push('/profile-survey' as Href)}
            />
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

          <SettingsSection title="Learn">
            <SettingsRow
              icon="🧠"
              label="Investing FAQ"
              description="Diversifying, T-bills, ETFs, risk and more, in plain English"
              onPress={() => router.push('/learn' as Href)}
            />
          </SettingsSection>

          {/* Appearance */}
          <SettingsSection title="Appearance">
            <SettingsChoiceRow
              options={APPEARANCE_OPTIONS}
              selected={preferences.appearance}
              onSelect={(appearance) => update({ appearance })}
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

          {/* Developer — never renders in a release build */}
          {devSeed.available ? (
            <SettingsSection
              title="Developer"
              footer="Fills this account with two goals and eight aged positions — some up, some down, some flat — so the used-for-weeks screens have something real to show.">
              <SettingsRow
                icon="🧪"
                label="Seed demo data"
                disabled={devSeed.loading}
                chevron={false}
                onPress={() => void devSeed.run()}
                accessory={devSeed.loading ? <ActivityIndicator color={Brand[500]} /> : undefined}
              />
              <SettingsRow
                icon="🧹"
                label="Clear demo data"
                disabled={devSeed.loading}
                chevron={false}
                onPress={() => void devSeed.clear()}
                accessory={devSeed.loading ? <ActivityIndicator color={Brand[500]} /> : undefined}
              />
            </SettingsSection>
          ) : null}

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
              accessory={isDeleting ? <ActivityIndicator color={Semantic.negative} /> : undefined}
            />
          </SettingsSection>

          {!!deleteError && (
            <ThemedText type="small" className="text-center" style={{ color: Semantic.negative }}>
              {deleteError}
            </ThemedText>
          )}

          <ThemedText
            style={{ fontSize: 11, color: theme.textTertiary, textAlign: 'center', opacity: 0.6 }}>
            AI-generated · Not financial advice · Informational only
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

export default withTabSkeleton(SettingsScreen, 'settings');
