import { __selfCheck as checkPlaybook } from '@/api/client/playbook';
import { __selfCheck as checkBetMonitorMatch } from '@/lib/bet-monitor-match';
import { __selfCheck as checkEtfRoutes } from '@/lib/etf-routes';
import { __selfCheck as checkMethodology } from '@/lib/methodology';
import { __selfCheck as checkPolymarketMarketQuality } from '@/lib/polymarket-market-quality';
import { __selfCheck as checkRouteResults } from '@/lib/route-results';
import { __selfCheck as checkRouteActions } from '@/lib/acquisition-routing';
import { __selfCheck as checkPolymarketRoutes } from '@/lib/polymarket-routes';
import { __selfCheck as checkPredictionSwing } from '@/lib/prediction-swing';
import { __selfCheck as checkPlatformFees } from '@/lib/platform-fees';
import { __selfCheck as checkPortfolio } from '@/lib/portfolio';
import { __selfCheck as checkPortfolioProgress } from '@/lib/portfolio-progress';
import { __selfCheck as checkQuizProfile } from '@/lib/quiz-profile';
import { __selfCheck as checkSavingsTreasuryRoutes } from '@/lib/savings-treasury-routes';
import { __selfCheck as checkScore } from '@/lib/score';
import { __selfCheck as checkSavingsGoal } from '@/lib/savings-goal';
import { __selfCheck as checkSportsMarketMatch } from '@/lib/sports-market-match';
import { __selfCheck as checkStakeRescore } from '@/lib/stake-rescore';
import { __selfCheck as checkVolatilityProbability } from '@/lib/volatility-probability';

const checks = [
  ['playbook', checkPlaybook],
  ['bet monitor matching', checkBetMonitorMatch],
  ['etf routes', checkEtfRoutes],
  ['methodology', checkMethodology],
  ['polymarket market quality', checkPolymarketMarketQuality],
  ['route results', checkRouteResults],
  ['route actions', checkRouteActions],
  ['polymarket routes', checkPolymarketRoutes],
  ['prediction swing math', checkPredictionSwing],
  ['platform fees', checkPlatformFees],
  ['portfolio math', checkPortfolio],
  ['portfolio goal progress', checkPortfolioProgress],
  ['quiz profile', checkQuizProfile],
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
