import { View } from 'react-native';

import { InvestmentAmountControl } from '@/components/routes/InvestmentAmountControl';
import { Radius, Shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RouteParams } from '@/types/routes';

/**
 * On the list, not behind Filters: the amounts are what people reach for
 * to see which bets fit their budget. One line each, so it stays short.
 */
export function RouteBudgetControls({
  sessionParams,
  baseParams,
  onTargetChange,
  investment,
  investmentMaximum,
  onInvestmentChange,
  maxLoss,
  onMaxLossChange,
}: {
  sessionParams: RouteParams | null;
  baseParams: RouteParams | null;
  onTargetChange: (base: number, amount: number) => void;
  investment: number;
  investmentMaximum: number;
  onInvestmentChange: (amount: number) => void;
  maxLoss: number;
  onMaxLossChange: (amount: number) => void;
}): React.ReactElement {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: Radius.xl, backgroundColor: theme.backgroundElevated, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 4, gap: 0, ...Shadow.card }}>
      {sessionParams && baseParams ? (
        <InvestmentAmountControl
          amount={sessionParams.target}
          maximum={Math.max(baseParams.target * 4, 1_000)}
          onAmountChange={(amount) => onTargetChange(baseParams.target, amount)}
          label="Make"
          spokenLabel="Profit you want to make"
        />
      ) : null}
      <InvestmentAmountControl amount={investment} maximum={investmentMaximum} onAmountChange={onInvestmentChange} label="Invest" />
      {/* Every route is sized so its bad case stays under this. A bet that would
          need more is shrunk to fit, and says how far that gets you. */}
      <InvestmentAmountControl
        amount={maxLoss}
        maximum={investment}
        onAmountChange={(amount) => onMaxLossChange(Math.min(amount, investment))}
        label="Max loss"
        spokenLabel="Most you are OK losing"
      />
    </View>
  );
}
