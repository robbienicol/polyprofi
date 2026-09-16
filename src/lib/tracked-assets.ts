import { Route } from '@/types/routes';

const TRACKED_SYMBOLS = [
  'BRK-B', 'AAPL', 'AMZN', 'META', 'MSFT', 'NVDA', 'TSLA',
  'BND', 'DIA', 'GLD', 'IWM', 'QQQ', 'SGOV', 'SHY', 'SPY', 'TLT', 'VOO', 'VTI',
] as const;

export function isStockOrEtfCategory(category: string): boolean {
  return /stock|etf|equity|s&p/i.test(category);
}

export function isSavingsOrTreasuryCategory(category: string): boolean {
  return /saving|treasur|t-bill|hysa|cash/i.test(category);
}

export function inferAssetSymbol(...parts: (string | undefined)[]): string | undefined {
  const text = parts.filter(Boolean).join(' ').toUpperCase();
  return TRACKED_SYMBOLS.find((symbol) => {
    const escaped = symbol.replace('-', '[- ]?');
    return new RegExp(`(^|[^A-Z])${escaped}([^A-Z]|$)`).test(text);
  });
}

export function inferAssetEntryPrice(...parts: (string | undefined)[]): number | undefined {
  const text = parts.filter(Boolean).join(' ');
  const matches = [...text.matchAll(/\$([\d,]+(?:\.\d{1,4})?)/g)]
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter((value) => Number.isFinite(value) && value > 0);

  // Route copy usually names the allocation first and the quote second.
  return matches.length > 1 ? matches[1] : matches[0];
}

export function inferAnnualYieldPct(...parts: (string | undefined)[]): number | undefined {
  const text = parts.filter(Boolean).join(' ');
  const values = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 25);
  return values[0];
}

export function inferMaturityDays(...parts: (string | undefined)[]): number | undefined {
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  const match = text.match(/(\d+(?:\.\d+)?)\s*[- ]?(day|week|month|year|d|w|mo|yr)s?\b/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'day' || unit === 'd') return Math.round(amount);
  if (unit === 'week' || unit === 'w') return Math.round(amount * 7);
  if (unit === 'month' || unit === 'mo') return Math.round(amount * 30);
  return Math.round(amount * 365);
}

export function trackedAssetFields(route: Route): {
  assetSymbol?: string;
  assetEntryPrice?: number;
  annualYieldPct?: number;
  maturesInDays?: number;
} {
  const stock = isStockOrEtfCategory(route.category);
  return {
    assetSymbol: stock
      ? inferAssetSymbol(route.description, route.strategy, route.line)
      : undefined,
    assetEntryPrice: stock
      ? inferAssetEntryPrice(route.description, route.strategy)
      : undefined,
    annualYieldPct: route.investmentFacts?.yieldPct ?? (
      isSavingsOrTreasuryCategory(route.category)
        ? inferAnnualYieldPct(route.description, route.strategy)
        : undefined
    ),
    maturesInDays: route.maturesInDays,
  };
}

export function trackedPositionFields(route: Route, amount: number, openedAt: string): ReturnType<typeof trackedAssetFields> & {
  assetQuantity?: number;
  costBasis: number;
  positionOpenedAt: string;
} {
  const asset = trackedAssetFields(route);
  const costBasis = Math.max(0, amount);
  return {
    ...asset,
    assetQuantity: asset.assetEntryPrice && asset.assetEntryPrice > 0
      ? costBasis / asset.assetEntryPrice
      : undefined,
    costBasis,
    positionOpenedAt: openedAt,
  };
}
