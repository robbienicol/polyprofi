/**
 * The 50 states plus DC, as the residence question offers them. Stored on the
 * onboarding profile by `code`, so a label change never orphans an answer.
 *
 * `NON_US` is a real answer rather than a skip: someone abroad has no state
 * tax to estimate, which is different from someone who has not said.
 *
 * Pure module — no React, no storage.
 */

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
] as const;

export type UsStateCode = (typeof US_STATES)[number]['code'];

/** Stored in place of a state code for someone who lives outside the US. */
export const NON_US = 'NON_US';

export type ResidenceCode = UsStateCode | typeof NON_US;

export const RESIDENCE_CODES: readonly ResidenceCode[] = [...US_STATES.map((state) => state.code), NON_US];

/** "Florida", "Outside the US", or null for no answer / an unknown code. */
export function residenceLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code === NON_US) return 'Outside the US';
  return US_STATES.find((state) => state.code === code)?.name ?? null;
}

/** States matching a typed query, by name prefix, word prefix, or exact code. */
export function matchStates(query: string): (typeof US_STATES)[number][] {
  const q = query.trim().toLowerCase();
  if (!q) return [...US_STATES];
  return US_STATES.filter(
    (state) =>
      state.code.toLowerCase() === q ||
      state.name.toLowerCase().startsWith(q) ||
      state.name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q)),
  );
}
