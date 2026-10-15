import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useCallback, useState } from 'react';

import {
  clearSpendingCuts,
  getSpendingCuts,
  saveSpendingCuts,
  type ImportedSpendingCuts,
} from '@/api/client/storage';
import { parseAppleCardCsv } from '@/lib/apple-card-csv';
import { detectSpendingCuts, statementMonths } from '@/lib/spending-cut-detect';

function spendingCutsQueryKey() {
  return ['SPENDING_CUTS'] as const;
}

/**
 * The Apple Card statement import, end to end: pick a CSV, read it, detect the
 * recurring spending in it, keep the cuts on this device.
 *
 * Statement text never leaves the phone and is never stored — `importCsv` is
 * exported separately from `pickAndImport` only so the paste box on the import
 * screen can reach the same path on web, where there is no document picker.
 *
 * Bank connect (@/api/hooks/useBankConnect) writes the same kind of signal by a
 * different road; the two are independent on purpose, because Plaid covers Apple
 * Card poorly and this is the only way an Apple Card user gets spending routes.
 */
export function useSpendingCuts(): {
  imported: ImportedSpendingCuts | null;
  isLoading: boolean;
  importing: boolean;
  error: string | null;
  /** Opens the file picker, then imports. Resolves false when the user cancels. */
  pickAndImport: () => Promise<boolean>;
  /** Imports statement text directly — the paste box, and every test. */
  importCsv: (text: string) => Promise<boolean>;
  clear: () => void;
} {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, status } = useQuery({
    queryKey: spendingCutsQueryKey(),
    queryFn: getSpendingCuts,
  });

  const { mutateAsync: store, isPending: importing } = useMutation({
    mutationFn: async (imported: ImportedSpendingCuts) => {
      await saveSpendingCuts(imported);
      return imported;
    },
    onSuccess: (imported) => queryClient.setQueryData(spendingCutsQueryKey(), imported),
  });

  const { mutate: clear } = useMutation({
    mutationFn: clearSpendingCuts,
    onSuccess: () => queryClient.setQueryData(spendingCutsQueryKey(), null),
  });

  const importCsv = useCallback(async (text: string): Promise<boolean> => {
    setError(null);
    const parsed = parseAppleCardCsv(text);
    if (parsed.error) {
      setError(parsed.error);
      return false;
    }

    const months = statementMonths(parsed.transactions);
    const cuts = detectSpendingCuts(parsed.transactions);
    if (cuts.length === 0) {
      // Two different empty results, and telling them apart is the whole difference
      // between "your export was too short" and "you have nothing to cut."
      setError(months < 2
        ? 'That statement covers one month. Export a few months from Wallet so a charge can be seen repeating.'
        : 'No recurring spending big enough to be worth cutting.');
      return false;
    }

    await store({
      cuts,
      importedAt: Date.now(),
      monthsCovered: months,
      transactionCount: parsed.transactions.length,
    });
    return true;
  }, [store]);

  const pickAndImport = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      // Apple's export is text/csv, but a file that has been through Files, Mail or
      // AirDrop often arrives as public.data — accepting both beats a picker that
      // greys out the user's own statement.
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.[0]) return false;

      const text = await new FileSystem.File(picked.assets[0].uri).text();
      return await importCsv(text);
    } catch (thrown) {
      console.warn(`[spending-cuts] ${thrown instanceof Error ? thrown.message : String(thrown)}`);
      setError('Could not read that file.');
      return false;
    }
  }, [importCsv]);

  return {
    imported: data ?? null,
    isLoading: status === 'pending',
    importing,
    error,
    pickAndImport,
    importCsv,
    clear,
  };
}
