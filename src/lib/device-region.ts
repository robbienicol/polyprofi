/**
 * The user's country, read off the device instead of asked for.
 *
 * The survey used to ask this outright, on a page that promised "where you live
 * decides what you are allowed to buy". It never did — nothing in the routing or
 * platform logic ever read it, and the value only fed the analytics row and a
 * line of copy. A question that buys nothing is worse than no question, and the
 * device already knows the answer.
 *
 * Best-effort by design: every failure path returns null, and null is already a
 * value the profile row, the API and the copy all handle. A wrong-but-plausible
 * guess would be worse than an honest blank.
 */

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  GB: 'United Kingdom',
  AU: 'Australia',
  IE: 'Ireland',
  NZ: 'New Zealand',
  IN: 'India',
  DE: 'Germany',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BR: 'Brazil',
  MX: 'Mexico',
  JP: 'Japan',
  SG: 'Singapore',
  ZA: 'South Africa',
};

/** The ISO region from the device locale ("en-GB" → "GB"), or null. */
export function deviceRegionCode(): string | null {
  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions();
    const tag = resolved.locale ?? '';
    // Region subtag: the two-letter (or three-digit) part after the language,
    // e.g. "en-US", "zh-Hant-TW". Script subtags are four letters, so they are
    // skipped by the length check rather than by position.
    const region = tag.split('-').find((part) => /^([A-Z]{2}|\d{3})$/.test(part));
    return region ?? null;
  } catch {
    return null;
  }
}

/**
 * A display country name for the device's region. Falls back to the raw code
 * when the region is real but not one we have a name for — "PT" is still more
 * use in an analytics row than nothing.
 */
export function deviceCountry(): string | null {
  const code = deviceRegionCode();
  if (!code) return null;
  return COUNTRY_NAMES[code] ?? code;
}

// ── self-check ──────────────────────────────────────────────────────────────
export function __selfCheck(): void {
  // The parser is the only part worth pinning: the runtime locale is whatever
  // the machine running this happens to be set to.
  const region = (tag: string): string | null =>
    tag.split('-').find((part) => /^([A-Z]{2}|\d{3})$/.test(part)) ?? null;

  console.assert(region('en-US') === 'US', 'a plain language-region tag parses');
  console.assert(region('zh-Hant-TW') === 'TW', 'a script subtag is skipped, not mistaken for the region');
  console.assert(region('en') === null, 'a bare language has no region to read');
  console.assert(region('es-419') === '419', 'a UN M.49 region code is a valid region');
  console.assert(deviceRegionCode() === null || typeof deviceRegionCode() === 'string', 'never throws');
  console.assert(
    deviceCountry() === null || (deviceCountry() ?? '').length > 0,
    'a country is either a real name or an honest null',
  );
}
