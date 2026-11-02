import { usePreferences } from '@/api/hooks/usePreferences';
import { useQuizAnswers } from '@/api/hooks/useQuizAnswers';
import { useSavedRoutes } from '@/api/hooks/useSavedRoutes';
import { useOnboardingProfile } from '@/api/hooks/useOnboardingProfile';
import { useUserProfile } from '@/api/hooks/useUserProfile';
import {
  excludedSearchCategoriesFor,
  riskToleranceFor,
  searchCategoriesFor,
  searchTimeframeFor,
} from '@/lib/onboarding-profile';
import { buildRouteParams, referenceStakeFor, surveyAmountCeiling } from '@/lib/quiz-profile';
import type { QuizAnswers } from '@/types/bets';

/** Profit a first search aims at when nothing else says otherwise. Same as the quiz's. */
const DEFAULT_TARGET = 100;

/**
 * The search the quiz would open on, already filled in — so "Find routes" can run it
 * without asking. Same precedence as the quiz form: the last search wins, then the
 * onboarding answers, then the fallbacks. Not tied to a goal.
 */
export function useDefaultSearch(): { answers: QuizAnswers | null; isLoading: boolean } {
  const { quizAnswers, isLoading: quizLoading } = useQuizAnswers();
  const { history, isLoading: historyLoading } = useSavedRoutes();
  const { preferences, isLoading: preferencesLoading } = usePreferences();
  const { profile, isLoading: profileLoading } = useUserProfile();
  const { profile: onboarding, isLoading: onboardingLoading } = useOnboardingProfile();

  const isLoading = quizLoading || historyLoading || preferencesLoading || profileLoading || onboardingLoading;
  if (isLoading) return { answers: null, isLoading };

  const prefill = quizAnswers ?? history[0]?.quizSnapshot;
  const target = prefill?.target ?? DEFAULT_TARGET;
  const investCeiling = prefill?.investmentCeiling ?? surveyAmountCeiling(profile?.investmentAmount);

  return {
    isLoading,
    answers: buildRouteParams({
      balance: referenceStakeFor(target, investCeiling),
      investmentCeiling: investCeiling ?? undefined,
      target,
      timeframe: prefill?.timeframe ?? searchTimeframeFor(onboarding.answers),
      riskTolerance: prefill?.riskTolerance ?? riskToleranceFor(onboarding.answers),
      categories: prefill?.categories ?? searchCategoriesFor(onboarding.answers),
      excludedCategories: excludedSearchCategoriesFor(onboarding.answers),
      preferredPlatforms: preferences.preferredPlatforms,
    }),
  };
}
