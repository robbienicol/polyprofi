import { __selfCheck as checkPlaybook } from '@/api/client/playbook';
import { __selfCheck as checkAssetSearch } from '@/lib/asset-search';
import { __selfCheck as checkBetMonitorMatch } from '@/lib/bet-monitor-match';
import { __selfCheck as checkDeviceRegion } from '@/lib/device-region';
import { __selfCheck as checkGainAlerts } from '@/lib/gain-alerts';
import { __selfCheck as checkEtfRoutes } from '@/lib/etf-routes';
import { __selfCheck as checkMetricGlossary } from '@/lib/metric-glossary';
import { __selfCheck as checkMethodology } from '@/lib/methodology';
import { __selfCheck as checkPolymarketMarketQuality } from '@/lib/polymarket-market-quality';
import { __selfCheck as checkRouteResults } from '@/lib/route-results';
import { __selfCheck as checkRouteActions } from '@/lib/acquisition-routing';
import { __selfCheck as checkPolymarketRoutes } from '@/lib/polymarket-routes';
import { __selfCheck as checkPredictionSwing } from '@/lib/prediction-swing';
import { __selfCheck as checkPredictionTopics } from '@/lib/prediction-topics';
import { __selfCheck as checkRouteInvestmentMetrics } from '@/lib/route-investment-metrics';
import { __selfCheck as checkOnboardingProfile } from '@/lib/onboarding-profile';
import { __selfCheck as checkPlatformFees } from '@/lib/platform-fees';
import { __selfCheck as checkPortfolio } from '@/lib/portfolio';
import { __selfCheck as checkPortfolioProgress } from '@/lib/portfolio-progress';
import { __selfCheck as checkPortfolioShape } from '@/lib/portfolio-shape';
import { __selfCheck as checkQuizProfile } from '@/lib/quiz-profile';
import { __selfCheck as checkRouteExpectedValue } from '@/lib/route-expected-value';
import { __selfCheck as checkSavingsTreasuryRoutes } from '@/lib/savings-treasury-routes';
import { __selfCheck as checkScore } from '@/lib/score';
import { __selfCheck as checkSavingsGoal } from '@/lib/savings-goal';
import { __selfCheck as checkSportsMarketMatch } from '@/lib/sports-market-match';
import { __selfCheck as checkStakeRescore } from '@/lib/stake-rescore';
import { __selfCheck as checkVolatilityProbability } from '@/lib/volatility-probability';

const checks = [
  ['playbook', checkPlaybook],
  ['asset search', checkAssetSearch],
  ['bet monitor matching', checkBetMonitorMatch],
  ['gain alerts', checkGainAlerts],
  ['device region', checkDeviceRegion],
  ['etf routes', checkEtfRoutes],
  ['methodology', checkMethodology],
  ['metric glossary', checkMetricGlossary],
  ['polymarket market quality', checkPolymarketMarketQuality],
  ['route results', checkRouteResults],
  ['route actions', checkRouteActions],
  ['polymarket routes', checkPolymarketRoutes],
  ['prediction swing math', checkPredictionSwing],
  ['prediction topics', checkPredictionTopics],
  ['route investment metrics', checkRouteInvestmentMetrics],
  ['onboarding profile', checkOnboardingProfile],
  ['platform fees', checkPlatformFees],
  ['portfolio math', checkPortfolio],
  ['portfolio goal progress', checkPortfolioProgress],
  ['portfolio shape', checkPortfolioShape],
  ['quiz profile', checkQuizProfile],
  ['route expected value', checkRouteExpectedValue],
  ['savings & treasury routes', checkSavingsTreasuryRoutes],
  ['goal score', checkScore],
  ['savings goal migration', checkSavingsGoal],
  ['sports market match', checkSportsMarketMatch],
  ['stake rescore', checkStakeRescore],
  ['volatility probability', checkVolatilityProbability],
] as const;

for (const [name, check] of checks) {
  check();
  console.log(`✓ ${name}`);
}
