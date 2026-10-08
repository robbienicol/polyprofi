import { isRecord, responseJson } from '@/lib/runtime-validation';

/**
 * Server-only chat completion. Tries Ollama Cloud first (open models, faster and
 * cheaper) and falls back to OpenAI when Ollama isn't configured or fails, so an
 * Ollama outage or rate limit never takes AI down. Both speak the OpenAI chat API.
 */
export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export interface ChatResult {
  content: string;
  provider: 'ollama' | 'openai';
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
}

interface Provider {
  name: ChatResult['provider'];
  url: string;
  apiKey: string | undefined;
  model: string;
}

const OLLAMA_MODEL = 'gemma4:31b';

export async function chatCompletion(options: {
  tag: string;
  messages: ChatMessage[];
  maxTokens: number;
  openAiModel: string;
  /** Rejects unusable output (e.g. JSON that doesn't parse) so the next provider gets a try. */
  accept?: (content: string) => boolean;
}): Promise<ChatResult | null> {
  const providers: Provider[] = [
    {
      name: 'ollama',
      url: 'https://ollama.com/v1/chat/completions',
      apiKey: process.env.OLLAMA_API_KEY,
      model: process.env.OLLAMA_MODEL || OLLAMA_MODEL,
    },
    {
      name: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      model: options.openAiModel,
    },
  ];

  for (const provider of providers) {
    if (!provider.apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.apiKey}` },
        body: JSON.stringify({ model: provider.model, max_tokens: options.maxTokens, messages: options.messages }),
      });
      if (!response.ok) {
        console.warn(`[${options.tag}] ${provider.name} error ${response.status}`);
        continue;
      }
      const payload = await responseJson(response);
      const content = readAssistantContent(payload)?.trim();
      if (!content) {
        console.warn(`[${options.tag}] ${provider.name} returned no content`);
        continue;
      }
      if (options.accept && !options.accept(content)) {
        console.warn(`[${options.tag}] ${provider.name} output rejected`);
        continue;
      }
      return { content, provider: provider.name, model: provider.model, usage: readUsage(payload) };
    } catch (error) {
      console.warn(`[${options.tag}] ${provider.name} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return null;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY);
}

function readAssistantContent(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.choices)) return null;
  const choice = value.choices[0];
  return isRecord(choice) && isRecord(choice.message) && typeof choice.message.content === 'string'
    ? choice.message.content
    : null;
}

function readUsage(value: unknown): ChatResult['usage'] {
  const usage = isRecord(value) && isRecord(value.usage) ? value.usage : null;
  if (!usage || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') return null;
  return { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens };
}
