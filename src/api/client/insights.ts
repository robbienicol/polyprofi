import { Route } from '@/types/routes';
import { isRecord } from '@/lib/runtime-validation';

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? '';

export async function fetchRouteCoachReply(route: Route, question: string): Promise<string> {
  const fallback = `This route ranks well because it combines a ${route.probability}% hit chance with a $${route.expectedReturn} upside. Main watch-out: ${route.lossProfile === 'binary' ? 'it can lose the full stake if wrong' : 'the capital is less binary, but timing still matters'}.`;
  if (!API_KEY) return fallback;

  const prompt = `You are PolyProfit's AI coach. Answer in plain English, no financial-advice language beyond a short caution.

Route:
Category: ${route.category}
Platform: ${route.platform}
Description: ${route.description}
Line: ${route.line ?? 'none'}
Strategy: ${route.strategy}
Risk: ${route.riskLevel}/5
Probability: ${route.probability}%
Potential profit: $${route.expectedReturn}
Loss profile: ${route.lossProfile}

User question: ${question}

Answer in 3-5 concise sentences. Be specific to this route.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 260,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) return fallback;
  return readChatContent(await res.json())?.trim() || fallback;
}

function readChatContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices)) return null;
  const choice = value.choices[0];
  return isRecord(choice) && isRecord(choice.message) && typeof choice.message.content === 'string'
    ? choice.message.content
    : null;
}
