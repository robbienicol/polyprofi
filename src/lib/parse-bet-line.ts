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

// Removed: extractMonitorTokens. It produced a bag of loose tokens that callers
// matched as substrings ("win" inside "Twins") with no minimum overlap, which
// bound positions to unrelated markets and games. Identity resolution now lives
// in @/lib/bet-monitor-match and matches on slug, exact question, or whole words.

export function isPredictionMarketBet(bet: { category: string; platform: string }): boolean {
  const hay = `${bet.category} ${bet.platform}`.toLowerCase();
  return hay.includes('polymarket') || hay.includes('prediction');
}
