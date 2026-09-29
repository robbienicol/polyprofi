/**
 * The clustering step @/lib/spending-cut-routes describes as "a separate, not-yet-built
 * step that would sit in front of this one": raw statement rows in, `SpendingCut[]` out.
 *
 * Two kinds come out, and they are found in that order because the second is defined by
 * what the first leaves behind:
 *
 *   subscription   one merchant charging about the same amount about once a month.
 *                  Cancellable in one action, so it is scored as near-certain.
 *   discretionary  what remains inside a spending category, averaged per month. Cutting
 *                  it is a behaviour change, so its month-to-month variance is carried
 *                  through to the score rather than averaged away.
 *
 * Recurrence is the whole claim being made, so nothing is called recurring on the
 * strength of a single month — a statement covering one month yields no cuts at all,
 * which is why `statementMonths` is exported for the import screen to say so.
 */
import type { SpendingCut } from '@/lib/spending-cut-routes';
import type { StatementTransaction } from '@/lib/apple-card-csv';

/** Below this a cut is technically real and practically not worth showing. */
const MIN_MONTHLY_SUBSCRIPTION = 1.5;
const MIN_MONTHLY_DISCRETIONARY = 20;
/** How far the per-charge amount may swing and still read as a fixed subscription price. */
const MAX_SUBSCRIPTION_VARIANCE_PCT = 12;
/**
 * How far the day of the month may drift and still read as a billing date.
 *
 * Without this, any merchant a user happens to hit once a month for about the same
 * amount — a weekly-ish takeaway, a monthly tank of fuel — is offered as "Cancel X"
 * at 97% reliability, promising a cancellation flow that does not exist. A real
 * subscription bills on its renewal date, moving only for weekends and month lengths.
 */
const MAX_BILLING_DAY_SPREAD = 3;
/**
 * Two months of a merchant charging the same amount around the same date is a
 * coincidence a year of real statement data throws up constantly — a sandwich shop,
 * a corner store, a homeware run. Three is the point where it stops being luck.
 */
const MIN_SUBSCRIPTION_MONTHS = 3;
/** Of the months it has existed, how many a subscription must actually have billed in. */
const MIN_SUBSCRIPTION_MONTH_COVERAGE = 0.6;
/**
 * A subscription that stopped billing before the statement ends was already cancelled,
 * and offering it as a saving counts money the user is no longer spending.
 */
const MAX_DAYS_SINCE_LAST_CHARGE = 45;
/**
 * Categories that are not discretionary spending, whatever the statement totals say.
 *
 * Grocery is the one that matters most and is easiest to get wrong: it is usually the
 * largest recurring line on a card, so a detector ranking by size puts "cut back on
 * Grocery" at the top of the list — telling someone to eat less to reach a savings
 * goal. Restaurants is discretionary and Grocery is not, even though both are food.
 * Medical, rent and insurance are here for the same reason.
 */
const NON_DISCRETIONARY = new Set([
  'payment', 'payments', 'other', 'transfer', 'cash', 'fees', 'interest',
  'grocery', 'groceries', 'health', 'medical', 'healthcare', 'pharmacy',
  'insurance', 'education', 'taxes', 'rent', 'mortgage', 'utilities', 'childcare',
]);

const MAX_SUBSCRIPTIONS = 8;
const MAX_DISCRETIONARY = 5;

/** Distinct calendar months the statement actually covers. 0 or 1 means nothing recurs yet. */
export function statementMonths(transactions: StatementTransaction[]): number {
  return new Set(transactions.map(monthKey)).size;
}

export function detectSpendingCuts(transactions: StatementTransaction[]): SpendingCut[] {
  if (statementMonths(transactions) < 2) return [];

  // Every "per month" figure below is measured against the end of the statement, not
  // against today: a file exported last quarter describes the months it covers.
  const statementEnd = Math.max(...transactions.map((transaction) => transaction.date));

  const subscriptions = detectSubscriptions(transactions, statementEnd);
  // A cancelled subscription is not also a category to cut back on: without this the
  // same $15.49 would be offered twice, once as Netflix and once inside Entertainment.
  const claimed = new Set(subscriptions.flatMap((entry) => entry.transactions));
  const discretionary = detectDiscretionary(transactions.filter((_, index) => !claimed.has(index)), statementEnd);

  return [...subscriptions.map((entry) => entry.cut), ...discretionary]
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

interface DetectedSubscription {
  cut: SpendingCut;
  /** Indices into the original array, so the discretionary pass can exclude them. */
  transactions: number[];
}

function detectSubscriptions(transactions: StatementTransaction[], statementEnd: number): DetectedSubscription[] {
  /*
   * Grouped by merchant AND price, not merchant alone.
   *
   * "Apple Services" is one merchant covering every Apple subscription a person has:
   * $2.99 storage on the 20th sits in the same group as a $98.99 one-off, and the
   * combined price variance buries a subscription that is perfectly regular on its
   * own. Splitting by price finds it. It also means one merchant can yield two cuts
   * — which is right, because they are two subscriptions.
   */
  const groups = new Map<string, number[]>();
  transactions.forEach((transaction, index) => {
    const key = merchantKey(transaction.merchant);
    if (!key) return;
    const priced = `${key}|${transaction.amount.toFixed(2)}`;
    const existing = groups.get(priced);
    if (existing) existing.push(index);
    else groups.set(priced, [index]);
  });

  const found: DetectedSubscription[] = [];
  for (const [key, indices] of groups) {
    const rows = indices.map((index) => transactions[index]);
    const months = new Set(rows.map(monthKey));
    if (months.size < MIN_SUBSCRIPTION_MONTHS) continue;
    // About once a month, not several times: a coffee shop visited twice a week is a
    // habit, and calling it a subscription would promise a cancellation that doesn't exist.
    if (rows.length > months.size * 1.34) continue;

    // Billing without gaps, over the months this merchant has actually existed for.
    // A charge in three scattered months out of twelve is a shop visited occasionally.
    const lastCharge = Math.max(...rows.map((row) => row.date));
    const span = monthsBetween(Math.min(...rows.map((row) => row.date)), lastCharge) + 1;
    if (months.size < span * MIN_SUBSCRIPTION_MONTH_COVERAGE) continue;
    // Still running at the end of the statement — otherwise it is already cancelled,
    // and the "saving" is money that stopped going out some time ago.
    if ((statementEnd - lastCharge) / DAY_MS > MAX_DAYS_SINCE_LAST_CHARGE) continue;

    if (billingDaySpread(rows) > MAX_BILLING_DAY_SPREAD) continue;

    const amounts = rows.map((row) => row.amount);
    const variance = variancePct(amounts);
    if (variance > MAX_SUBSCRIPTION_VARIANCE_PCT) continue;

    const monthlyAmount = mean(amounts);
    if (monthlyAmount < MIN_MONTHLY_SUBSCRIPTION) continue;

    found.push({
      cut: {
        id: `sub-${key.replace(/[^a-z0-9]+/g, '-')}`,
        // Shown to the user, so it is the name Apple printed, not the matching key.
        merchant: displayName(rows),
        kind: 'subscription',
        monthlyAmount,
        monthsObserved: months.size,
      },
      transactions: indices,
    });
  }

  return found.sort((a, b) => b.cut.monthlyAmount - a.cut.monthlyAmount).slice(0, MAX_SUBSCRIPTIONS);
}

function detectDiscretionary(transactions: StatementTransaction[], statementEnd: number): SpendingCut[] {
  const groups = new Map<string, StatementTransaction[]>();
  for (const transaction of transactions) {
    const category = transaction.category.trim();
    if (!category || NON_DISCRETIONARY.has(category.toLowerCase())) continue;
    const existing = groups.get(category);
    if (existing) existing.push(transaction);
    else groups.set(category, [transaction]);
  }

  const cuts: SpendingCut[] = [];
  for (const [category, rows] of groups) {
    const spentIn = totalsByMonth(rows);
    if (spentIn.size < 2) continue;

    /*
     * The window a monthly average is honest over: from the first charge in this
     * category to the end of the statement.
     *
     * Averaging only the months that HAD a charge is the error a year of real data
     * makes obvious — flights bought in 6 months out of 13 came out as "$216/mo,
     * cut it" when the true monthly outlay is half that, and holding that cut for
     * three months does not save three times $216. Months with no spending are part
     * of the pattern, so they are counted, both in the average and in the variance
     * that decides how reliable the cut is.
     */
    const windowMonths = monthsBetween(Math.min(...rows.map((row) => row.date)), statementEnd) + 1;
    if (windowMonths < 2) continue;

    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    const monthlyAmount = total / windowMonths;
    if (monthlyAmount < MIN_MONTHLY_DISCRETIONARY) continue;

    const monthlyTotals = [...spentIn.values()];
    while (monthlyTotals.length < windowMonths) monthlyTotals.push(0);

    cuts.push({
      id: `cat-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      merchant: category,
      kind: 'discretionary',
      monthlyAmount,
      // What the score treats as evidence: months this actually happened in, which is
      // not the same as the months it is being averaged over.
      monthsObserved: spentIn.size,
      amountVariancePct: variancePct(monthlyTotals),
    });
  }

  return cuts.sort((a, b) => b.monthlyAmount - a.monthlyAmount).slice(0, MAX_DISCRETIONARY);
}

/**
 * Collapses the ways one merchant is written across a statement onto a single key:
 * the payment processor's prefix (`SQ *`, `TST*`, `PY *`), a store or location suffix
 * (`#1234`, ` SAN FRANCISCO CA`), and case and punctuation all vary row to row for
 * what is plainly the same charge.
 */
function merchantKey(merchant: string): string {
  return merchant
    .toUpperCase()
    .replace(/^(SQ|TST|PY|PAYPAL|SP|IC)\s*\*+\s*/, '')
    // A per-charge reference: Spotify bills as "Spotify P42d1405b2", a different
    // string every month. Left in, one subscription looks like four merchants with
    // one charge each and never reaches the two months that prove it recurs.
    .replace(/\s+[A-Z]*\d[A-Z\d]{4,}$/, '')
    .replace(/\s+#?\d{3,}.*$/, '')
    .replace(/\s+[A-Z]{2}$/, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * The shortest spelling the statement used, with a store number dropped — "Jersey
 * Mikes 20362" is a branch id the user does not recognise as anything, and it is
 * being shown inside the sentence "Cancel X".
 */
function displayName(rows: StatementTransaction[]): string {
  return rows
    // Same two suffixes merchantKey drops, for the same reason: neither the branch
    // number nor the per-charge reference means anything inside "Cancel X".
    .map((row) => row.merchant.trim().replace(/\s+#?\d{3,}$/, '').replace(/\s+[A-Za-z]*\d[A-Za-z\d]{4,}$/, ''))
    .filter((name) => name !== '')
    .reduce((shortest, name) => (name.length < shortest.length ? name : shortest));
}

const DAY_MS = 24 * 60 * 60 * 1_000;

/** Whole calendar months from one date to another — March 31 to April 1 is one. */
function monthsBetween(from: number, to: number): number {
  const start = new Date(from);
  const end = new Date(to);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function totalsByMonth(rows: StatementTransaction[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = monthKey(row);
    totals.set(key, (totals.get(key) ?? 0) + row.amount);
  }
  return totals;
}

/**
 * How much the day of the month moves across a merchant's charges. Measured both
 * directly and with the early days of the month pushed past the late ones, because
 * a renewal on the 31st that lands on the 1st in a short month has moved one day,
 * not thirty — the smaller of the two is the honest answer.
 */
function billingDaySpread(rows: StatementTransaction[]): number {
  const days = rows.map((row) => new Date(row.date).getDate());
  const wrapped = days.map((day) => (day <= 15 ? day + 31 : day));
  return Math.min(spread(days), spread(wrapped));
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

function monthKey(transaction: StatementTransaction): string {
  const date = new Date(transaction.date);
  return `${date.getFullYear()}-${date.getMonth()}`;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

/** Coefficient of variation as a percentage, 0–100 — the shape `SpendingCut` wants. */
function variancePct(values: number[]): number {
  const average = mean(values);
  if (average <= 0) return 100;
  const spread = Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
  return Math.min(100, (spread / average) * 100);
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  const on = (month: number, day: number, merchant: string, category: string, amount: number): StatementTransaction => ({
    date: new Date(2026, month, day).getTime(),
    merchant,
    category,
    amount,
  });

  const netflix = [
    on(0, 14, 'Netflix', 'Entertainment', 15.49),
    on(1, 14, 'Netflix', 'Entertainment', 15.49),
    on(2, 14, 'Netflix', 'Entertainment', 15.49),
  ];
  const coffee = [
    on(0, 2, 'Blue Bottle Coffee', 'Restaurants', 12.75),
    on(0, 9, 'Blue Bottle Coffee', 'Restaurants', 13.25),
    on(0, 19, 'Blue Bottle Coffee', 'Restaurants', 12.75),
    on(1, 4, 'Blue Bottle Coffee', 'Restaurants', 13.00),
    on(1, 17, 'Blue Bottle Coffee', 'Restaurants', 12.50),
    on(2, 6, 'Blue Bottle Coffee', 'Restaurants', 13.50),
    on(2, 22, 'Blue Bottle Coffee', 'Restaurants', 12.95),
  ];

  console.assert(statementMonths(netflix) === 3, 'three calendar months are counted once each');
  console.assert(detectSpendingCuts(netflix.slice(0, 1)).length === 0, 'one month of statement proves no recurrence');

  const cuts = detectSpendingCuts([...netflix, ...coffee]);
  const subscription = cuts.find((cut) => cut.kind === 'subscription');
  console.assert(subscription?.merchant === 'Netflix', 'a flat monthly charge is a subscription');
  console.assert(subscription?.monthsObserved === 3, 'every month it charged is counted');
  console.assert(
    !cuts.some((cut) => cut.kind === 'subscription' && /blue bottle/i.test(cut.merchant)),
    'several charges a month is a habit, not a subscription',
  );

  const restaurants = cuts.find((cut) => cut.merchant === 'Restaurants');
  console.assert(restaurants?.kind === 'discretionary', 'what is left in a category becomes a discretionary cut');
  console.assert(
    restaurants !== undefined && Math.abs(restaurants.monthlyAmount - (38.75 + 25.5 + 26.45) / 3) < 0.01,
    'a discretionary cut averages the MONTHLY total, not the per-charge amount',
  );
  console.assert(restaurants?.monthsObserved === 3, 'a discretionary cut counts the months it was actually spent in');
  console.assert((restaurants?.amountVariancePct ?? 0) > 0, 'month-to-month swing is carried through, not averaged away');
  console.assert(
    !cuts.some((cut) => cut.kind === 'discretionary' && cut.merchant === 'Entertainment'),
    'a merchant already offered as a cancellation is not double-counted inside its category',
  );

  // Merchant normalisation: one charge written three ways has to group, or a
  // subscription split across spellings never reaches two months.
  const spotify = [
    on(0, 3, 'SQ *SPOTIFY', 'Entertainment', 11.99),
    on(1, 3, 'Spotify #4471', 'Entertainment', 11.99),
    on(2, 3, 'spotify', 'Entertainment', 11.99),
  ];
  const [spotifyCut] = detectSpendingCuts(spotify);
  console.assert(spotifyCut?.kind === 'subscription', 'a processor prefix, a store number and case are the same merchant');
  console.assert(spotifyCut?.merchant === 'Spotify', 'the shortest spelling wins, and its branch number is dropped');

  const gym = [on(0, 1, 'Equinox', 'Fitness', 260), on(1, 1, 'Equinox', 'Fitness', 260), on(2, 1, 'Equinox', 'Fitness', 260)];
  console.assert(detectSpendingCuts(gym)[0]?.kind === 'subscription', 'three identical months on the same date is a subscription');
  console.assert(
    detectSpendingCuts(gym.slice(0, 2)).every((cut) => cut.kind !== 'subscription'),
    'two months of the same charge is the coincidence a year of statements is full of',
  );

  // Gaps, and having stopped. Both produce a "saving" that is not there.
  const scattered = [
    on(0, 8, 'Jersey Mikes', 'Restaurants', 14.19),
    on(4, 8, 'Jersey Mikes', 'Restaurants', 14.19),
    on(9, 8, 'Jersey Mikes', 'Restaurants', 14.19),
    on(9, 20, 'Filler', 'Shopping', 30),
  ];
  console.assert(
    detectSpendingCuts(scattered).every((cut) => cut.kind !== 'subscription'),
    'three charges scattered over ten months is a shop visited occasionally, not a subscription',
  );

  const cancelled = [
    on(0, 5, 'Hulu', 'Entertainment', 17.99),
    on(1, 5, 'Hulu', 'Entertainment', 17.99),
    on(2, 5, 'Hulu', 'Entertainment', 17.99),
    on(8, 20, 'Whole Foods', 'Grocery', 140),
    on(9, 20, 'Whole Foods', 'Grocery', 140),
  ];
  console.assert(
    detectSpendingCuts(cancelled).every((cut) => cut.merchant !== 'Hulu'),
    'a subscription that stopped billing six months before the statement ends was already cancelled',
  );

  // The averaging window. Six months of flights inside a thirteen-month statement is
  // not a $216/mo habit, and holding a cut for three months does not save 3 × $216.
  const flights = [0, 2, 5, 7, 10, 12].map((month) => on(month, 12, 'United', 'Airlines', 468));
  flights.push(on(12, 28, 'Filler', 'Grocery', 200));
  const airlines = detectSpendingCuts(flights).find((cut) => cut.merchant === 'Airlines');
  console.assert(
    airlines !== undefined && Math.abs(airlines.monthlyAmount - (468 * 6) / 13) < 0.5,
    'a discretionary average divides by the months since it started, not by the months it happened in',
  );
  console.assert(airlines?.monthsObserved === 6, 'months it actually happened in is still what the score sees as evidence');
  console.assert(
    (airlines?.amountVariancePct ?? 0) > 50,
    'the months with no spending count towards the swing, so an occasional splurge scores as unreliable to cut',
  );

  console.assert(
    detectSpendingCuts([...flights, on(0, 3, 'Kaiser', 'Medical', 300), on(1, 3, 'Kaiser', 'Medical', 300)])
      .every((cut) => cut.merchant !== 'Medical'),
    'medical spending is never offered as something to cut back on',
  );

  // Billing date. A takeaway hit once a month for about the same amount looks exactly
  // like a subscription on price alone, and offering "Cancel Uber Eats" at 97% promises
  // a cancellation flow that does not exist.
  const takeaway = [
    on(0, 3, 'Uber Eats', 'Restaurants', 34.1),
    on(1, 19, 'Uber Eats', 'Restaurants', 34.1),
    on(2, 27, 'Uber Eats', 'Restaurants', 34.1),
  ];
  console.assert(
    detectSpendingCuts(takeaway).every((cut) => cut.kind !== 'subscription'),
    'a monthly charge on no fixed date is not a subscription, however steady the amount',
  );
  console.assert(
    detectSpendingCuts(takeaway)[0]?.merchant === 'Restaurants',
    'it becomes the discretionary category cut it actually is',
  );

  const renewal = [
    on(0, 31, 'Adobe', 'Software', 20.99),
    on(1, 1, 'Adobe', 'Software', 20.99),
    on(2, 31, 'Adobe', 'Software', 20.99),
  ];
  console.assert(
    detectSpendingCuts(renewal)[0]?.kind === 'subscription',
    'a renewal that lands on the 1st in a short month has moved one day, not thirty',
  );

  const erratic = [on(0, 1, 'Amazon', 'Shopping', 12), on(1, 1, 'Amazon', 'Shopping', 190)];
  console.assert(
    detectSpendingCuts(erratic).every((cut) => cut.kind !== 'subscription'),
    'a merchant whose amount swings is not a fixed price to cancel',
  );

  const tiny = [on(0, 1, 'iCloud', 'Other', 0.99), on(1, 1, 'iCloud', 'Other', 0.99)];
  console.assert(detectSpendingCuts(tiny).length === 0, 'a 99¢ charge is not a route worth showing');

  const payments = [on(0, 1, 'Chase', 'Payment', 400), on(1, 1, 'Wells Fargo', 'Payment', 400)];
  console.assert(
    detectSpendingCuts(payments).every((cut) => cut.merchant !== 'Payment'),
    'paying a card is not discretionary spending',
  );
}
