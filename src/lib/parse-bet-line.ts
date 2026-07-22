/** Parse a Polymarket-style entry price from a route line string. */
export function parseEntryPrice(line?: string): number | null {
  if (!line) return null;

  const centMatch = line.match(/(\d+(?:\.\d+)?)\s*¢/);
  if (centMatch) {
    const cents = Number(centMatch[1]);
    return cents > 1 ? cents / 100 : cents;
  }

  const yesMatch = line.match(/\byes\b[^0-9]*(\d+(?:\.\d+)?)/i);
  if (yesMatch) {
    const v = Number(yesMatch[1]);
    return v > 1 ? v / 100 : v;
  }

  return null;
}

/** Distinctive tokens for matching live ESPN games / Polymarket questions. */
export function extractMonitorTokens(...parts: (string | undefined)[]): string[] {
  const STOP = new Set(['fc', 'cf', 'sc', 'afc', 'the', 'club', 'city', 'united', 'real', 'yes', 'moneyline', 'draftkings', 'fanduel', 'polymarket']);
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  return [...new Set(
    text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
  )];
}

export function isPredictionMarketBet(bet: { category: string; platform: string }): boolean {
  const hay = `${bet.category} ${bet.platform}`.toLowerCase();
  return hay.includes('polymarket') || hay.includes('prediction');
}
