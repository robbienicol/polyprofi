import { verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

import { isQuizAnswers } from '@/lib/runtime-validation';
import type { QuizAnswers } from '@/types/bets';

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

interface QuizRow {
  quiz_answers: QuizAnswers | null;
}

export interface QuizAnswersPayload {
  quizAnswers: QuizAnswers | null;
}

export async function GET(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`
    SELECT quiz_answers
    FROM users
    WHERE clerk_id = ${userId}
  ` as QuizRow[];
  const stored = rows[0]?.quiz_answers;

  return Response.json({ quizAnswers: isQuizAnswers(stored) ? stored : null });
}

export async function POST(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  if (!isQuizAnswers(body)) {
    return Response.json({ error: 'Invalid quiz answers' }, { status: 400 });
  }

  const serialized = JSON.stringify(body);
  const rows = await sql`
    INSERT INTO users (clerk_id, quiz_answers)
    VALUES (${userId}, ${serialized}::jsonb)
    ON CONFLICT (clerk_id) DO UPDATE SET
      quiz_answers = EXCLUDED.quiz_answers
    RETURNING quiz_answers
  ` as QuizRow[];

  return Response.json({ quizAnswers: rows[0]?.quiz_answers ?? body });
}

export async function DELETE(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await sql`
    UPDATE users
    SET quiz_answers = NULL
    WHERE clerk_id = ${userId}
  `;

  return Response.json({ quizAnswers: null });
}
