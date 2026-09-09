import { verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

import { isSavingsGoalState } from '@/lib/runtime-validation';
import type { SavingsGoalState } from '@/types/bets';

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

interface SavingsGoalRow {
  savings_goal_state: SavingsGoalState | null;
}

export interface SavingsGoalPayload {
  savingsGoalState: SavingsGoalState | null;
}

export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT savings_goal_state
    FROM users
    WHERE clerk_id = ${userId}
  ` as SavingsGoalRow[];
  const stored = rows[0]?.savings_goal_state;

  return Response.json({ savingsGoalState: isSavingsGoalState(stored) ? stored : null });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!isSavingsGoalState(body)) {
    return Response.json({ error: 'Invalid savings goal' }, { status: 400 });
  }

  const serialized = JSON.stringify(body);
  const rows = await sql`
    INSERT INTO users (clerk_id, savings_goal_state)
    VALUES (${userId}, ${serialized}::jsonb)
    ON CONFLICT (clerk_id) DO UPDATE SET
      savings_goal_state = EXCLUDED.savings_goal_state
    RETURNING savings_goal_state
  ` as SavingsGoalRow[];

  return Response.json({ savingsGoalState: rows[0]?.savings_goal_state ?? body });
}
