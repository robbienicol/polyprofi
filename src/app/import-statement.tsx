import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSpendingCuts } from '@/api/hooks/useSpendingCuts';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/Icon';
import { KEYBOARD_AWARE_SCROLL_PROPS } from '@/constants/keyboard';
import { Brand, OnBrand, Radius, Semantic, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STEPS = [
  'Open Wallet and tap your Apple Card.',
  'Tap ⋯, then Card Details → Export Transactions.',
  'Pick a few months — one month can’t show what repeats — and save the CSV.',
  'Come back here and choose that file.',
];

/**
 * Apple Card's statement export, read on the device. This exists because Plaid
 * covers Apple Card poorly and FinanceKit needs an entitlement Apple grants case
 * by case: a CSV is the one route to spending routes an Apple Card user has today.
 *
 * Reached from both the profile survey and Settings, and deliberately the same
 * screen from either — the second visit is a re-import, which is the same flow.
 */
export default function ImportStatementScreen(): React.ReactElement {
  const theme = useTheme();
  const router = useRouter();
  const { imported, importing, error, pickAndImport, importCsv, clear } = useSpendingCuts();
  const [paste, setPaste] = useState('');
  const [pasting, setPasting] = useState(false);

  const cuts = imported?.cuts ?? [];
  const monthlyTotal = cuts.reduce((total, cut) => total + cut.monthlyAmount, 0);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background }}>
      <Stack.Screen options={{ title: 'Import statement', headerShown: true }} />
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-5 py-6" showsVerticalScrollIndicator={false} {...KEYBOARD_AWARE_SCROLL_PROPS}>
          <ThemedText style={{ fontSize: 22, fontWeight: '800', color: theme.text }}>
            Import an Apple Card statement
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ lineHeight: 20, marginTop: 8 }}>
            We read the file on this phone, score what repeats in it as routes, and keep only the
            result. The statement itself is never uploaded or stored.
          </ThemedText>

          {cuts.length > 0 ? (
            <View
              style={{
                marginTop: 18,
                padding: 14,
                gap: 10,
                borderRadius: Radius.lg,
                borderWidth: 1.5,
                borderColor: Brand[500] + '55',
                backgroundColor: theme.backgroundElevated,
                ...Shadow.card,
              }}>
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <Icon glyph="✂️" size={20} color={Brand[500]} />
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: theme.text, flex: 1 }}>
                  ${monthlyTotal.toFixed(0)}/mo found across {cuts.length} {cuts.length === 1 ? 'cut' : 'cuts'}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                From {imported?.transactionCount} charges over {imported?.monthsCovered} months. These are
                scored against every other route on your next search.
              </ThemedText>
              {cuts.map((cut) => (
                <View key={cut.id} className="flex-row items-center" style={{ gap: 10 }}>
                  <ThemedText style={{ fontSize: 14, color: theme.text, flex: 1 }} numberOfLines={1}>
                    {cut.merchant}
                    <ThemedText type="small" themeColor="textTertiary">
                      {cut.kind === 'subscription' ? '  cancel' : '  cut back'}
                    </ThemedText>
                  </ThemedText>
                  <ThemedText style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>
                    ${cut.monthlyAmount.toFixed(2)}/mo
                  </ThemedText>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={() => clear()} className="active:opacity-70">
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: Semantic.negative }}>
                  Remove imported spending
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: theme.text, marginTop: 22 }}>
            {cuts.length > 0 ? 'Import another export' : 'How to get the file'}
          </ThemedText>
          {STEPS.map((step, index) => (
            <View key={step} className="flex-row" style={{ gap: 10, marginTop: 10 }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '800', color: Brand[500], width: 16 }}>
                {index + 1}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, lineHeight: 20 }}>
                {step}
              </ThemedText>
            </View>
          ))}

          {error ? (
            <ThemedText style={{ fontSize: 13, color: Semantic.negative, marginTop: 16 }}>{error}</ThemedText>
          ) : null}

          {/* Web has no document picker, and a paste box is also the fastest way to
              retry a file the picker refused to hand over. */}
          {Platform.OS === 'web' || pasting ? (
            <View style={{ gap: 10, marginTop: 16 }}>
              <TextInput
                value={paste}
                onChangeText={setPaste}
                multiline
                placeholder="Paste the contents of the CSV here"
                placeholderTextColor={theme.textTertiary}
                style={{
                  minHeight: 120,
                  padding: 12,
                  borderRadius: Radius.md,
                  borderWidth: 1,
                  borderColor: theme.border,
                  color: theme.text,
                  backgroundColor: theme.backgroundElevated,
                  fontSize: 13,
                }}
              />
              <Pressable
                accessibilityRole="button"
                disabled={importing || paste.trim() === ''}
                onPress={() => {
                  void importCsv(paste).then((done) => {
                    if (done) setPaste('');
                  });
                }}
                className="py-3.5 items-center active:opacity-85"
                style={{
                  borderRadius: Radius.md,
                  backgroundColor: Brand[500],
                  opacity: importing || paste.trim() === '' ? 0.5 : 1,
                }}>
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: OnBrand }}>
                  {importing ? 'Reading…' : 'Import pasted statement'}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10, marginTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                disabled={importing}
                onPress={() => {
                  void pickAndImport().then((done) => {
                    if (done) router.back();
                  });
                }}
                className="py-3.5 items-center active:opacity-85"
                style={{ borderRadius: Radius.md, backgroundColor: Brand[500], opacity: importing ? 0.6 : 1 }}>
                <ThemedText style={{ fontSize: 15, fontWeight: '800', color: OnBrand }}>
                  {importing ? 'Reading…' : 'Choose CSV file'}
                </ThemedText>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setPasting(true)} className="items-center active:opacity-70">
                <ThemedText style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>
                  Paste it instead
                </ThemedText>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
