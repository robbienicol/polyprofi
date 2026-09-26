import { neon } from '@neondatabase/serverless';

import type { CardRewardsProfile } from '@/lib/card-reward-routes';
import { identifyCard } from '@/lib/card-rewards/catalog';
import type { AccountSpend } from '@/lib/card-rewards/optimizer';
import { cardCategoryFor } from '@/lib/card-rewards/plaid-categories';
import type { CardCategory } from '@/lib/card-rewards/types';
import { isRecord, responseJson } from '@/lib/runtime-validation';
import { authenticatedUserId } from '@/lib/server-auth';

const sql = neon(process.env.NEON_DATABASE_URL!);

/** Plaid's default history for a new item, and what the rewards math annualizes from. */
const WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1_000;
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string | null;
  mask?: string | null;
  type: string;
  subtype?: string | null;
}

interface PlaidTransaction {
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string | null;
  pending: boolean;
  iso_currency_code?: string | null;
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null;
}

class NotReady extends Error {}

async function plaid<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const env = process.env.PLAID_ENV ?? 'sandbox';
  const response = await fetch(`https://${env}.plaid.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.PLAID_CLIENT_ID, secret: process.env.PLAID_SECRET, ...body }),
  });
  const payload = await responseJson(response).catch(() => null);
  if (!response.ok) {
    // A just-linked item takes a little while to pull its history.
    if (isRecord(payload) && payload.error_code === 'PRODUCT_NOT_READY') throw new NotReady();
    throw new Error(`Plaid ${path} ${response.status}${isRecord(payload) ? ` ${String(payload.error_code)}` : ''}`);
  }
  return payload as T;
}

async function itemHistory(accessToken: string, start: string, end: string) {
  let offset = 0;
  let accounts: PlaidAccount[] = [];
  const transactions: PlaidTransaction[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await plaid<{ accounts: PlaidAccount[]; transactions: PlaidTransaction[]; total_transactions: number }>(
      '/transactions/get',
      {
        access_token: accessToken,
        start_date: start,
        end_date: end,
        options: { count: PAGE_SIZE, offset, include_personal_finance_category: true },
      },
    );
    accounts = result.accounts ?? accounts;
    transactions.push(...(result.transactions ?? []));
    offset += result.transactions?.length ?? 0;
    if (offset >= result.total_transactions || (result.transactions?.length ?? 0) === 0) break;
  }
  return { accounts, transactions };
}

/**
 * Where the user's card spending goes, per linked account, for the card-rewards
 * routes. Reads the accounts and last 90 days of transactions from every item the
 * user linked, names each account's card from its own account name, and returns
 * annualized spend by rewards category. Only those totals leave the server — no
 * merchant, no transaction, no balance.
 */
export async function GET(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return Response.json({ status: 'none' });
  }

  const items = await sql`SELECT access_token FROM plaid_items WHERE clerk_id = ${userId}` as { access_token: string }[];
  if (items.length === 0) return Response.json({ status: 'none' });

  const now = Date.now();
  const end = new Date(now).toISOString().slice(0, 10);
  const start = new Date(now - WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);

  const accounts: CardRewardsProfile['accounts'] = [];
  const raw = new Map<string, Partial<Record<CardCategory, number>>>();
  let earliest = now;
  let pending = false;

  for (const item of items) {
    try {
      const history = await itemHistory(item.access_token, start, end);
      const kept = new Set<string>();
      for (const account of history.accounts) {
        // Cards and checking are where purchases happen; savings and loans are not.
        if (account.type !== 'credit' && !(account.type === 'depository' && account.subtype !== 'savings')) continue;
        const cardId = identifyCard({ name: account.name, officialName: account.official_name, type: account.type });
        kept.add(account.account_id);
        accounts.push({
          accountId: account.account_id,
          label: `${account.official_name || account.name}${account.mask ? ` ····${account.mask}` : ''}`,
          cardId,
          identified: !cardId.startsWith('generic-'),
        });
      }
      for (const transaction of history.transactions) {
        if (transaction.pending || transaction.amount <= 0 || !kept.has(transaction.account_id)) continue;
        if ((transaction.iso_currency_code ?? 'USD') !== 'USD') continue;
        const category = cardCategoryFor({
          merchant: transaction.merchant_name || transaction.name || '',
          primary: transaction.personal_finance_category?.primary,
          detailed: transaction.personal_finance_category?.detailed,
        });
        if (!category) continue;
        const byCategory = raw.get(transaction.account_id) ?? {};
        byCategory[category] = (byCategory[category] ?? 0) + transaction.amount;
        raw.set(transaction.account_id, byCategory);
        earliest = Math.min(earliest, Date.parse(transaction.date));
      }
    } catch (error) {
      if (error instanceof NotReady) {
        pending = true;
        continue;
      }
      console.warn(`[api:plaid/card-rewards] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (accounts.length === 0) return Response.json({ status: pending ? 'pending' : 'none' });

  // A card opened last month has a month of history, not three; annualize by what
  // was actually seen, with a floor so one week does not become a year.
  const windowDays = Math.max(30, Math.min(WINDOW_DAYS, (now - earliest) / DAY_MS));
  const annualize = 365 / windowDays;
  const spend: AccountSpend[] = accounts.flatMap((account) => {
    const byCategory = raw.get(account.accountId);
    if (!byCategory) return [];
    return [{
      accountId: account.accountId,
      cardId: account.cardId,
      byCategory: Object.fromEntries(
        Object.entries(byCategory).map(([category, amount]) => [category, Math.round((amount ?? 0) * annualize)]),
      ),
    }];
  });

  const profile: CardRewardsProfile = { windowDays: Math.round(windowDays), accounts, spend, asOf: end };
  return Response.json({ status: 'ready', profile });
}
