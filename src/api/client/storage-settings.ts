import AsyncStorage from '@react-native-async-storage/async-storage';

import { KEYS } from '@/api/client/storage-keys';
import { noteLocalWrite } from '@/api/client/user-data-sync';
import { EMPTY_LEDGER, type AlertLedger } from '@/lib/gain-alerts';
import type { SpendingCut } from '@/lib/spending-cut-routes';
import { sanitizePreferences, type Preferences } from '@/lib/preferences';
import { isArrayOf, isRecord, isSpendingCut, parseJson } from '@/lib/runtime-validation';

// ── Settings ─────────────────────────────────────────────────────────────────
// One blob, sanitized on read, so a new setting needs no key and no migration.

/**
 * What good news has already been pushed. Local-only and deliberately so: it
 * exists to stop the same alert firing twice on this device, and a fresh install
 * announcing a milestone again is a far smaller problem than a server round-trip
 * on every price refresh.
 */
export async function getAlertLedger(): Promise<AlertLedger> {
  const raw = await AsyncStorage.getItem(KEYS.ALERT_LEDGER);
  const parsed = raw ? parseJson(raw) : null;
  if (!isRecord(parsed)) return EMPTY_LEDGER;
  return {
    lastSentDay: typeof parsed.lastSentDay === 'string' ? parsed.lastSentDay : null,
    betTier: numberMap(parsed.betTier),
    goalMilestone: numberMap(parsed.goalMilestone),
  };
}

export async function saveAlertLedger(ledger: AlertLedger): Promise<void> {
  await AsyncStorage.setItem(KEYS.ALERT_LEDGER, JSON.stringify(ledger));
}

/** Drops anything that is not a plain id → number pair, so a corrupt blob cannot
 *  make a tier comparison return NaN and re-announce everything. */
function numberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return Object.fromEntries(entries);
}

export async function getPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(KEYS.PREFERENCES);
  return sanitizePreferences(raw ? parseJson(raw) : null);
}

/** Merge a patch over what's stored and return the resulting full object. */
export async function updatePreferences(patch: Partial<Preferences>): Promise<Preferences> {
  const next = sanitizePreferences({ ...(await getPreferences()), ...patch });
  await AsyncStorage.setItem(KEYS.PREFERENCES, JSON.stringify(next));
  await noteLocalWrite('preferences');
  return next;
}

/**
 * What the last statement import found. The cuts are kept, the statement is not:
 * detection already consumed the rows, and there is no second question worth
 * holding thousands of individual charges on the device to answer. Device-local
 * for the same reason — nothing here is ever sent to a server.
 */
export interface ImportedSpendingCuts {
  cuts: SpendingCut[];
  /** When the import ran, epoch ms — shown as "imported 3 Mar". */
  importedAt: number;
  /** Distinct calendar months the statement covered, for the "one month" warning. */
  monthsCovered: number;
  /** Spending rows read. A count only, never the rows. */
  transactionCount: number;
}

export async function getSpendingCuts(): Promise<ImportedSpendingCuts | null> {
  const raw = await AsyncStorage.getItem(KEYS.SPENDING_CUTS);
  const parsed = raw ? parseJson(raw) : null;
  if (!isRecord(parsed) || !isArrayOf(isSpendingCut)(parsed.cuts)) return null;
  return {
    cuts: parsed.cuts,
    importedAt: typeof parsed.importedAt === 'number' ? parsed.importedAt : 0,
    monthsCovered: typeof parsed.monthsCovered === 'number' ? parsed.monthsCovered : 0,
    transactionCount: typeof parsed.transactionCount === 'number' ? parsed.transactionCount : 0,
  };
}

export async function saveSpendingCuts(imported: ImportedSpendingCuts): Promise<void> {
  await AsyncStorage.setItem(KEYS.SPENDING_CUTS, JSON.stringify(imported));
}

export async function clearSpendingCuts(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.SPENDING_CUTS);
}
