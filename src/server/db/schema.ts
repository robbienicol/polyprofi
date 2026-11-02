import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Every table the server uses. This file is the source of truth: change a table here,
 * then `npm run db:push` to apply it to the database.
 *
 * Timestamps come back as ISO strings (`mode: 'string'`), the shape the API already sends.
 */

const createdAt = () => timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull();

/** One row per account, keyed by Clerk user id. */
export const users = pgTable('users', {
  clerkId: text('clerk_id').primaryKey(),
  subscribed: boolean().default(false).notNull(),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: createdAt(),
  ageRange: text('age_range'),
  country: text(),
  financialGoal: text('financial_goal'),
  investingExperience: text('investing_experience'),
  marketsInterested: text('markets_interested').array(),
  profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true, mode: 'string' }),
  signupReason: text('signup_reason'),
  investmentAmount: text('investment_amount'),
  quizAnswers: jsonb('quiz_answers'),
  savingsGoalState: jsonb('savings_goal_state'),
  bankConnected: boolean('bank_connected').default(false).notNull(),
});

/** Device blobs mirrored per account: bets, saved routes, settings (see user-data-sync). */
export const userData = pgTable('user_data', {
  clerkId: text('clerk_id').notNull(),
  key: text().notNull(),
  value: jsonb().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.clerkId, table.key], name: 'user_data_pkey' }),
]);

/** Bank connections made through Plaid. */
export const plaidItems = pgTable('plaid_items', {
  id: bigserial({ mode: 'bigint' }).primaryKey(),
  clerkId: text('clerk_id').notNull(),
  itemId: text('item_id').notNull(),
  accessToken: text('access_token').notNull(),
  institutionId: text('institution_id'),
  institutionName: text('institution_name'),
  createdAt: createdAt(),
}, (table) => [
  index('plaid_items_clerk_id_idx').on(table.clerkId),
  unique('plaid_items_item_id_key').on(table.itemId),
]);

/** Shared server cache: market data, route pools, the AI slate (see shared/cache). The table name predates it. */
export const cacheEntries = pgTable('polymarket_pick_cache', {
  key: text().primaryKey(),
  bundle: jsonb().notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

/** Expo push tokens, one per device, so alerts reach users with the app closed. */
export const pushTokens = pgTable('push_tokens', {
  token: text().primaryKey(),
  clerkId: text('clerk_id').notNull(),
  platform: text().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('push_tokens_clerk_id_idx').on(table.clerkId),
]);

/** What the server has already alerted each user about, and when they were last checked. */
export const alertState = pgTable('alert_state', {
  clerkId: text('clerk_id').primaryKey(),
  ledger: jsonb().default({}).notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true, mode: 'string' }),
});

/** Unused — bets live in user_data ('bets'). Declared so `db:push` never drops it. */
export const trackedBets = pgTable('tracked_bets', {
  id: uuid().defaultRandom().primaryKey(),
  clerkId: text('clerk_id').notNull(),
  category: text().notNull(),
  emoji: text().notNull(),
  description: text().notNull(),
  platform: text().notNull(),
  strategy: text().notNull(),
  riskLevel: integer('risk_level').notNull(),
  probability: integer().notNull(),
  expectedReturn: numeric('expected_return', { precision: 10, scale: 2 }).notNull(),
  amountWagered: numeric('amount_wagered', { precision: 10, scale: 2 }).notNull(),
  status: text().default('active').notNull(),
  createdAt: createdAt(),
}, (table) => [
  index('tracked_bets_clerk_id_idx').on(table.clerkId),
  foreignKey({ columns: [table.clerkId], foreignColumns: [users.clerkId], name: 'tracked_bets_clerk_id_fkey' }).onDelete('cascade'),
  check('tracked_bets_risk_level_check', sql`(risk_level >= 1) AND (risk_level <= 5)`),
  check('tracked_bets_probability_check', sql`(probability >= 0) AND (probability <= 100)`),
  check('tracked_bets_status_check', sql`status = ANY (ARRAY['active'::text, 'won'::text, 'lost'::text])`),
]);
