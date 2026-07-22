import { MetaculusQuestion } from '@/api/client/market-data';
import type { MetaculusEdge, PolymarketPickBundle, TaggedPolymarketEvent } from '@/api/client/polymarket-pick-types';
import { fetchWhaleTrades } from '@/api/client/polymarket-whales';
import { createInFlightCache } from '@/lib/in-flight-cache';
import { isRecord, parseJson, responseJson } from '@/lib/runtime-validation';
import type { RawPick } from '@/types/picks';

export type * from '@/api/client/polymarket-pick-types';
export * from '@/api/client/polymarket-pick-formatters';
export { whaleTradesToPicks } from '@/api/client/polymarket-whales';

const GAMMA = 'https://gamma-api.polymarket.com';
const METACULUS_TOKEN = process.env.EXPO_PUBLIC_METACULUS_API_TOKEN ?? '';
let metaculusTokenWarned = false;

const PM_TAGS = ['politics', 'weather', 'geopolitics'] as const;
const EVENTS_PER_TAG = 3;
const COMMENTS_PER_EVENT = 6;
const REQUEST_GAP_MS = 350;

const STOP_WORDS = new Set([
  'will', 'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
  'are', 'was', 'were', 'any', 'all', 'not', 'but', 'can', 'may', 'who', 'what',
  'when', 'where', 'how', 'before', 'after', 'into', 'than', 'then', 'over', 'under',
]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parsePrices(raw: string | string[] | undefined): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number);
  const parsed = parseJson(raw);
  return Array.isArray(parsed) ? parsed.map(Number) : [];
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function titleTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

function overlapScore(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared;
}

interface RawEventMarket {
  question?: string;
  active?: boolean;
  closed?: boolean;
  outcomePrices?: string | string[];
  volumeNum?: number;
  volume?: string;
}

interface RawEvent {
  id?: string | number;
  title?: string;
  volume?: number;
  markets?: RawEventMarket[];
}

function primaryOpenMarket(event: RawEvent): { question: string; yesPrice: number | null } {
  const candidates = (event.markets ?? [])
    .filter((m) => m.active && !m.closed)
    .map((m) => {
      const prices = parsePrices(m.outcomePrices);
      const vol = m.volumeNum ?? Number(m.volume ?? 0);
      return { question: m.question ?? event.title ?? '', yesPrice: prices[0] ?? null, vol };
    })
    .filter((m) => m.yesPrice != null && m.yesPrice > 0 && m.yesPrice < 1);

  if (candidates.length === 0) {
    return { question: event.title ?? '', yesPrice: null };
  }
  candidates.sort((a, b) => b.vol - a.vol);
  return { question: candidates[0].question, yesPrice: candidates[0].yesPrice };
}

async function fetchTaggedEvents(tag: string): Promise<TaggedPolymarketEvent[]> {
  try {
    const res = await fetch(
      `${GAMMA}/events?active=true&closed=false&limit=${EVENTS_PER_TAG * 2}&tag_slug=${tag}`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      console.warn(`[pm:picks] ✗ events tag=${tag} ${res.status}`);
      return [];
    }
    const raw: RawEvent[] = await res.json();
    const events = raw
      .filter((e) => (e.volume ?? 0) > 10_000)
      .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
      .slice(0, EVENTS_PER_TAG)
      .map((e) => {
        const { question, yesPrice } = primaryOpenMarket(e);
        return {
          id: String(e.id),
          title: e.title ?? question,
          tag,
          volume: e.volume ?? 0,
          yesPrice,
          marketQuestion: question,
        };
      });
    console.log(`[pm:picks] tag=${tag}: ${events.length} events`);
    return events;
  } catch (e) {
    console.warn(`[pm:picks] ✗ events tag=${tag} ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

interface RawComment {
  body?: string;
  parentCommentID?: string;
  reactionCount?: number;
  profile?: { name?: string; pseudonym?: string };
}

const PICK_SIGNAL =
  /\b(yes|no)\b|\b(buy|sell|long|short)\b|\b\d{1,2}[¢%]\b|\bedge\b|\bmispric/i;

async function fetchEventComments(event: TaggedPolymarketEvent): Promise<RawPick[]> {
  try {
    const res = await fetch(
      `${GAMMA}/comments?parent_entity_type=Event&parent_entity_id=${event.id}&limit=40&get_positions=true`,
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) {
      console.warn(`[pm:picks] ✗ comments event=${event.id} ${res.status}`);
      return [];
    }

    const payload = await responseJson(res);
    const raw = Array.isArray(payload) ? payload.filter(isRawComment) : [];
    const roots = raw
      .flatMap((comment) => comment.body && !comment.parentCommentID
        ? [{ ...comment, text: clean(comment.body) }]
        : [])
      .filter((c) => c.text.length >= 30)
      .sort(
        (a, b) =>
          Number(PICK_SIGNAL.test(b.text)) - Number(PICK_SIGNAL.test(a.text)) ||
          (b.reactionCount ?? 0) - (a.reactionCount ?? 0)
      )
      .slice(0, COMMENTS_PER_EVENT);

    const priceHint =
      event.yesPrice != null ? ` (market Yes ${(event.yesPrice * 100).toFixed(0)}¢)` : '';

    return roots.map((c) => {
      const author = c.profile?.name ?? c.profile?.pseudonym ?? 'anon';
      const quality: RawPick['sourceQuality'] =
        (c.reactionCount ?? 0) >= 5 ? 'high' : (c.reactionCount ?? 0) >= 2 ? 'medium' : 'low';
      return {
        category: 'Polymarket',
        pick: `${event.title}${priceHint} — ${c.text.slice(0, 140)}`,
        reasoning: c.text.slice(0, 300),
        source: `Polymarket comment · ${author} · ${c.reactionCount ?? 0} reactions · r/${event.tag}`,
        sourceQuality: quality,
      };
    });
  } catch (e) {
    console.warn(`[pm:picks] ✗ comments event=${event.id} ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

async function fetchMetaculusQuestions(): Promise<MetaculusQuestion[]> {
  if (!METACULUS_TOKEN) {
    if (!metaculusTokenWarned) {
      metaculusTokenWarned = true;
      console.warn('[pm:picks] no EXPO_PUBLIC_METACULUS_API_TOKEN — Metaculus edges skipped');
    }
    return [];
  }
  try {
    const res = await fetch(
      'https://www.metaculus.com/api2/questions/?order_by=-activity&type=forecast&status=open&limit=40',
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${METACULUS_TOKEN}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[pm:picks] ✗ Metaculus ${res.status}`);
      return [];
    }

    const payload = await responseJson(res);
    const results = isRecord(payload) && Array.isArray(payload.results) ? payload.results : [];
    const questions = results.flatMap((question) => {
      if (!isRecord(question)
        || typeof question.title !== 'string'
        || !isRecord(question.community_prediction)
        || !isRecord(question.community_prediction.full)
        || typeof question.community_prediction.full.q2 !== 'number') return [];
      return [{
        question: question.title,
        probability: question.community_prediction.full.q2,
        url: typeof question.page_url === 'string' ? question.page_url : '',
      }];
    });
    console.log(`[pm:picks] Metaculus: ${questions.length} questions with community prediction`);
    return questions;
  } catch (e) {
    console.warn(`[pm:picks] ✗ Metaculus ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

function isRawComment(value: unknown): value is RawComment {
  return isRecord(value)
    && (value.body === undefined || typeof value.body === 'string')
    && (value.parentCommentID === undefined || typeof value.parentCommentID === 'string')
    && (value.reactionCount === undefined || typeof value.reactionCount === 'number')
    && (value.profile === undefined || isRecord(value.profile));
}

function buildMetaculusEdges(
  events: TaggedPolymarketEvent[],
  metaculus: MetaculusQuestion[]
): MetaculusEdge[] {
  const edges: MetaculusEdge[] = [];
  const usedMeta = new Set<string>();

  for (const event of events) {
    if (event.yesPrice == null) continue;
    const pmTitle = event.marketQuestion || event.title;

    let best: { q: MetaculusQuestion; score: number } | null = null;
    for (const q of metaculus) {
      if (usedMeta.has(q.question)) continue;
      const score = overlapScore(pmTitle, q.question);
      if (score >= 3 && (!best || score > best.score)) best = { q, score };
    }
    if (!best) continue;

    usedMeta.add(best.q.question);
    const pmYesPct = event.yesPrice * 100;
    const metaYesPct = best.q.probability * 100;
    const edgePts = metaYesPct - pmYesPct;

    if (Math.abs(edgePts) < 5) continue;

    edges.push({
      polymarketQuestion: pmTitle,
      metaculusQuestion: best.q.question,
      pmYesPct,
      metaculusYesPct: metaYesPct,
      edgePts,
      direction: edgePts > 0 ? 'buy_yes' : 'buy_no',
    });
  }

  return edges.sort((a, b) => Math.abs(b.edgePts) - Math.abs(a.edgePts)).slice(0, 12);
}

const getPolymarketPickBundle = createInFlightCache<PolymarketPickBundle>(90 * 1000);

export async function fetchPolymarketPickBundle(): Promise<PolymarketPickBundle> {
  return getPolymarketPickBundle(fetchPolymarketPickBundleInner, 'pm:picks');
}

async function fetchPolymarketPickBundleInner(): Promise<PolymarketPickBundle> {
  const taggedEvents: TaggedPolymarketEvent[] = [];
  for (const tag of PM_TAGS) {
    const batch = await fetchTaggedEvents(tag);
    taggedEvents.push(...batch);
    await sleep(REQUEST_GAP_MS);
  }

  const commentPicks: RawPick[] = [];
  for (const event of taggedEvents) {
    const batch = await fetchEventComments(event);
    commentPicks.push(...batch);
    await sleep(REQUEST_GAP_MS);
  }

  const [metaculus, whaleTrades] = await Promise.all([
    fetchMetaculusQuestions(),
    fetchWhaleTrades(),
  ]);
  const edges = buildMetaculusEdges(taggedEvents, metaculus);
  if (metaculus.length > 0) {
    console.log(`[pm:picks] Metaculus edges: ${edges.length} matches (≥5pt gap)`);
  }

  console.log(
    `[pm:picks] ✓ ${taggedEvents.length} tagged events, ${commentPicks.length} comment picks, ${edges.length} Metaculus edges, ${whaleTrades.length} whale trades`
  );

  return {
    taggedEvents,
    commentPicks,
    edges,
    whaleTrades,
  };
}
