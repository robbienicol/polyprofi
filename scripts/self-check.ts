import { __selfCheck as checkPlaybook } from '@/api/client/playbook';
import { __selfCheck as checkPolymarketRoutes } from '@/lib/polymarket-routes';
import { __selfCheck as checkPortfolio } from '@/lib/portfolio';
import { __selfCheck as checkQuizProfile } from '@/lib/quiz-profile';
import { __selfCheck as checkScore } from '@/lib/score';
import { __selfCheck as checkStakeRescore } from '@/lib/stake-rescore';
import { __selfCheck as checkVolatilityProbability } from '@/lib/volatility-probability';

const checks = [
  ['playbook', checkPlaybook],
  ['polymarket routes', checkPolymarketRoutes],
  ['portfolio math', checkPortfolio],
  ['quiz profile', checkQuizProfile],
  ['goal score', checkScore],
  ['stake rescore', checkStakeRescore],
  ['volatility probability', checkVolatilityProbability],
] as const;

for (const [name, check] of checks) {
  check();
  console.log(`✓ ${name}`);
}
