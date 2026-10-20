import type { StatementTransaction } from '@/lib/apple-card-csv';
import { statementMonths, detectSpendingCuts } from '@/lib/spending-cut-detect';

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
