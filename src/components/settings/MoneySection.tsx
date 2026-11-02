import { useRouter } from 'expo-router';
import React, { useState } from 'react';

import { useBankConnect } from '@/api/hooks/useBankConnect';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useSavingsGoal } from '@/api/hooks/useSavingsGoal';
import { useSpendingCuts } from '@/api/hooks/useSpendingCuts';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import { ThemedText } from '@/components/themed-text';
import { SettingsChoiceRow, SettingsRow, SettingsSection } from '@/components/ui/settings';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CURRENCIES, currencyMeta, type CurrencyCode, type Preferences } from '@/lib/preferences';

const CURRENCY_OPTIONS = CURRENCIES.map((entry) => ({
  value: entry.code as CurrencyCode,
  label: `${entry.symbol} ${entry.code}`,
}));

/** Currency, bank connection, statement import and goals. */
export function MoneySection({
  preferences,
  update,
}: {
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
}): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { goals, achievedCount } = useSavingsGoal();
  const { profile, checkFailed: profileUnreachable } = useUserProfile();
  const { profile: onboarding } = useOnboardingProfile();
  const bank = useBankConnect();
  const { imported: importedCuts } = useSpendingCuts();
  // The stored answer is the durable one; the hook only knows about a connection
  // made on this mount, and the profile read is what survives a relaunch. The quiz's
  // own record is the fallback when the server can't be reached, so an offline
  // Settings screen doesn't offer a second Plaid link for a bank already connected.
  const bankConnected =
    profile?.bankConnected === true || bank.connected || onboarding.answers.bankConnected;
  // Unknown rather than "not connected" when the profile couldn't be read: the row
  // says so instead of inviting a duplicate connection.
  const bankStatusUnknown = !bankConnected && profileUnreachable;
  const [currencyOpen, setCurrencyOpen] = useState(false);

  return (
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
      <SettingsRow
        icon="🏦"
        label="Bank account"
        description={
          bank.error
            ? bank.error
            : bankStatusUnknown
              ? "Couldn't check your connection. Try again when you're back online."
              : bankConnected
              ? 'Connected — real spending counts alongside every pick'
              : 'Weighs real spending — a subscription, a coffee habit — alongside every pick'
        }
        chevron={!bankConnected && !bankStatusUnknown}
        disabled={bank.connecting || bankStatusUnknown}
        onPress={bankConnected || bankStatusUnknown ? undefined : () => void bank.connect()}
        accessory={
          bankConnected ? (
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>Connected</ThemedText>
          ) : (
            <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>
              {bank.connecting ? 'Connecting…' : bankStatusUnknown ? '—' : 'Connect'}
            </ThemedText>
          )
        }
      />
      {/* Under bank connect, not beside it: an Apple Card is the account Plaid
          covers worst, and this is the same signal arriving by the only road
          that works for it. */}
      <SettingsRow
        icon="📄"
        label="Apple Card statement"
        description={
          importedCuts
            ? `${importedCuts.cuts.length} cuts from ${importedCuts.monthsCovered} months of spending`
            : 'Import a CSV export — finds what repeats and scores it as routes'
        }
        onPress={() => router.push('/import-statement')}
        accessory={
          <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500] }}>
            {importedCuts ? 'Imported' : 'Import'}
          </ThemedText>
        }
      />
      <SettingsRow
        icon={goals[0]?.emoji ?? '🎯'}
        label="Goals"
        description={
          goals.length === 0
            ? 'None yet'
            : goals.length === 1
              ? goals[0].label
              : `${goals[0].label} + ${goals.length - 1} more`
        }
        value={achievedCount > 0 ? `${achievedCount} reached` : undefined}
        onPress={() => router.push('/(tabs)/goals')}
      />
    </SettingsSection>
  );
}
