import { SYNCED_STORAGE_KEYS } from '@/api/client/user-data-sync';

// Keep the pre-rebrand namespace so an app update retains existing user data.
export const KEYS = {
  SUBSCRIBED: 'polyprofit:subscribed',
  QUIZ: 'polyprofit:quiz',
  QUIZ_OWNER: 'polyprofit:quizOwner',
  BETS: SYNCED_STORAGE_KEYS.bets,
  ONBOARDING: 'polyprofit:onboardingComplete',
  EARLY_ACCESS: 'polyprofit:earlyAccessGranted',
  SAVED_ROUTES: SYNCED_STORAGE_KEYS.savedRoutes,
  DAILY_POOL: 'polyprofit:dailyPool',
  PORTFOLIO_PROGRESS: SYNCED_STORAGE_KEYS.portfolioProgress,
  SAVINGS_GOAL: 'polyprofit:savingsGoal',
  SAVINGS_GOAL_OWNER: 'polyprofit:savingsGoalOwner',
  SAVINGS_GOAL_UNSYNCED: 'polyprofit:savingsGoalUnsynced',
  SPORTS_MATCHES: 'polyprofit:sportsMatches',
  GENERIC_MATCHES: 'polyprofit:genericMatches',
  BIOMETRIC_LOCK: 'polyprofit:biometricLockEnabled',
  PREFERENCES: SYNCED_STORAGE_KEYS.preferences,
  ONBOARDING_PROFILE: SYNCED_STORAGE_KEYS.onboardingProfile,
  DEV_REPLAY_FUNNEL: 'polyprofit:devReplayFunnel',
  PROFILE_COMPLETE: 'polyprofit:profileComplete',
  PROFILE_COMPLETE_OWNER: 'polyprofit:profileCompleteOwner',
  ALERT_LEDGER: 'polyprofit:alertLedger',
  SPENDING_CUTS: 'polyprofit:spendingCuts',
} as const;
