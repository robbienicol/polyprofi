import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { useBankConnect } from '@/api/hooks/useBankConnect';
import { CheckBadge, IconTile } from '@/components/onboarding/survey/service-parts';
import { ThemedText } from '@/components/themed-text';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The fourth card: bank connect, folded in here rather than a page of its own.
 * Opens Plaid Link on "Connect" and writes `bankConnected` on a real success;
 * a plain user-closed-Link exit is neither an error nor a state change.
 *
 * `connected` comes from the stored answer, not only from this mount's own
 * hook state — someone who connects, backs up a page, and returns should see
 * the done state rather than the connect button again.
 */
export function BankServiceCard({
  connected,
  onConnected,
}: {
  connected: boolean;
  onConnected: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const bank = useBankConnect();
  const done = connected || bank.connected;

  useEffect(() => {
    if (bank.connected) onConnected();
  }, [bank.connected, onConnected]);

  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: Radius.lg,
        borderWidth: 1.5,
        borderColor: done ? Brand[500] + '55' : theme.border,
        backgroundColor: theme.backgroundElevated,
        ...Shadow.card,
      }}>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <IconTile glyph="💳" color={done ? Brand[500] : theme.textSecondary} backgroundColor={done ? Brand[500] + '18' : theme.backgroundSelected} />
        <View style={{ flex: 1, gap: 1 }}>
          <ThemedText style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>Bank & credit cards</ThemedText>
          <ThemedText style={{ fontSize: 12, color: theme.textSecondary }}>
            {done
              ? bank.linkedCount > 1
                ? `${bank.linkedCount} linked. Add any other card you use so we see all of your spending.`
                : 'Linked. Add any other card you use so we see all of your spending.'
              : 'Link your bank and every card you use. We check which card each purchase should go on, and what you could cut.'}
          </ThemedText>
        </View>
        {done ? <CheckBadge /> : null}
      </View>
      {/* Each Link run connects one bank or card issuer, so after the first there is
          always a way to add the next one — cards are what the card-rewards routes
          are built from, and a wallet is rarely one issuer. */}
      <View style={{ gap: 8 }}>
        {bank.error ? (
          <ThemedText style={{ fontSize: 12, color: Semantic.negative }}>{bank.error}</ThemedText>
        ) : null}
        <Pressable
          onPress={() => void bank.connect()}
          disabled={bank.connecting}
          accessibilityRole="button"
          className="py-3 items-center active:opacity-85"
          style={{
            borderRadius: Radius.md,
            backgroundColor: done ? 'transparent' : Brand[500],
            borderWidth: done ? 1.5 : 0,
            borderColor: Brand[500],
            opacity: bank.connecting ? 0.6 : 1,
          }}>
          <ThemedText style={{ fontSize: 14, fontWeight: '800', color: done ? Brand[500] : OnBrand }}>
            {bank.connecting ? 'Connecting…' : done ? 'Add another card' : 'Connect a bank or card'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}
