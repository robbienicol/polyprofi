import { verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

import { isRecord } from '@/lib/runtime-validation';

const sql = neon(process.env.NEON_DATABASE_URL!);

async function requireUserId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY! });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

interface UserProfileRow {
  age_range: string | null;
  country: string | null;
  financial_goal: string | null;
  investing_experience: string | null;
  markets_interested: string[] | null;
  signup_reason: string | null;
  investment_amount: string | null;
  profile_completed_at: string | null;
}

export interface UserProfilePayload {
  ageRange: string | null;
  country: string | null;
  financialGoal: string | null;
  investingExperience: string | null;
  marketsInterested: string[];
  signupReason: string | null;
  investmentAmount: string | null;
  completed: boolean;
}

function toPayload(row: UserProfileRow | undefined): UserProfilePayload {
  return {
    ageRange: row?.age_range ?? null,
    country: row?.country ?? null,
    financialGoal: row?.financial_goal ?? null,
    investingExperience: row?.investing_experience ?? null,
    marketsInterested: row?.markets_interested ?? [],
    signupReason: row?.signup_reason ?? null,
    investmentAmount: row?.investment_amount ?? null,
    completed: row?.profile_completed_at != null,
  };
}

export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT age_range, country, financial_goal, investing_experience, markets_interested,
      signup_reason, investment_amount, profile_completed_at
    FROM users WHERE clerk_id = ${userId}
  ` as UserProfileRow[];

  return Response.json(toPayload(rows[0]));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return Response.json({ error: 'Invalid body' }, { status: 400 });

  const ageRange = stringOrNull(body.ageRange);
  const country = stringOrNull(body.country);
  const financialGoal = stringOrNull(body.financialGoal);
  const investingExperience = stringOrNull(body.investingExperience);
  const marketsInterested = stringArray(body.marketsInterested);
  const signupReason = stringOrNull(body.signupReason);
  const investmentAmount = stringOrNull(body.investmentAmount);

  const rows = await sql`
    INSERT INTO users (
      clerk_id, age_range, country, financial_goal, investing_experience, markets_interested,
      signup_reason, investment_amount, profile_completed_at
    )
    VALUES (
      ${userId}, ${ageRange}, ${country}, ${financialGoal}, ${investingExperience}, ${marketsInterested},
      ${signupReason}, ${investmentAmount}, now()
    )
    ON CONFLICT (clerk_id) DO UPDATE SET
      age_range = EXCLUDED.age_range,
      country = EXCLUDED.country,
      financial_goal = EXCLUDED.financial_goal,
      investing_experience = EXCLUDED.investing_experience,
      markets_interested = EXCLUDED.markets_interested,
      signup_reason = EXCLUDED.signup_reason,
      investment_amount = EXCLUDED.investment_amount,
      profile_completed_at = EXCLUDED.profile_completed_at
    RETURNING age_range, country, financial_goal, investing_experience, markets_interested,
      signup_reason, investment_amount, profile_completed_at
  ` as UserProfileRow[];

  return Response.json(toPayload(rows[0]));
}
