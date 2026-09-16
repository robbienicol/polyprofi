import { createClerkClient, verifyToken } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

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

/**
 * Permanently deletes the signed-in user's account: their `users` row in
 * Neon and their Clerk identity itself. Required for Apple guideline
 * 5.1.1(v) — apps that support account creation must let users delete
 * their account in-app.
 */
export async function DELETE(request: Request): Promise<Response> {
  const userId = await requireUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  await sql`DELETE FROM users WHERE clerk_id = ${userId}`;
  await clerkClient.users.deleteUser(userId);

  return Response.json({ deleted: true });
}
