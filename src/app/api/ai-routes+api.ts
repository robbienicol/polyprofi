import { isRecord, responseJson } from '@/lib/runtime-validation';
import { authenticatedUserId } from '@/lib/server-auth';

const MAX_SYSTEM_PROMPT_LENGTH = 20_000;
const MAX_USER_PROMPT_LENGTH = 120_000;

export async function POST(request: Request): Promise<Response> {
  const userId = await authenticatedUserId(request);
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as unknown;
  if (!isRecord(body)
    || typeof body.systemPrompt !== 'string'
    || typeof body.userPrompt !== 'string'
    || body.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH
    || body.userPrompt.length > MAX_USER_PROMPT_LENGTH) {
    return Response.json({ error: 'Invalid prompt' }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: 'AI is not configured' }, { status: 503 });

  try {
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 5_000,
        messages: [
          { role: 'system', content: body.systemPrompt },
          { role: 'user', content: body.userPrompt },
        ],
      }),
    });
    if (!openAiResponse.ok) {
      console.warn(`[api:ai-routes] OpenAI error ${openAiResponse.status}`);
      return Response.json({ error: 'AI request failed' }, { status: 502 });
    }

    const payload = await responseJson(openAiResponse);
    const content = readAssistantContent(payload);
    if (!content) return Response.json({ error: 'AI returned no content' }, { status: 502 });
    return Response.json({ content });
  } catch (error) {
    console.warn(`[api:ai-routes] ${error instanceof Error ? error.message : String(error)}`);
    return Response.json({ error: 'AI request failed' }, { status: 502 });
  }
}

function readAssistantContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices)) return null;
  const choice = value.choices[0];
  return isRecord(choice) && isRecord(choice.message) && typeof choice.message.content === 'string'
    ? choice.message.content
    : null;
}
