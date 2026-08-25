/**
 * Survival Engine v1 — построение персональной ленты.
 * 70/20/10 (релевантные / exploration / эхо) + diversity по автору.
 */
import { q } from '@/lib/db';
import { personalScore, freshnessScore, urgencyScore, normalizeGlobalSurvival, conversationValue, diversityBlocked } from './survival';

type FeedItem = {
  id: string;
  type: string;
  author_id: string | null;
  created_at: string;
  reaction_count: number;
  reply_count: number;
  repost_count: number;
  [key: string]: unknown;
};

/**
 * Построить персональную ленту для пользователя.
 * @param userId — для кого строим
 * @param seasonId — текущий сезон
 * @param limit — сколько сообщений
 * @param nowMs — момент «сейчас»
 * @param waveAtMs — время следующей волны (для urgency)
 */
export async function buildPersonalFeed(
  userId: string,
  seasonId: string,
  limit: number,
  nowMs: number,
  waveAtMs: number | null
): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  // 1. Пул кандидатов из двух источников (ТЗ п.25): топ-глобальные + свежие
  const half = Math.ceil((Math.min(limit * 3, 120)) / 2);
  const candidates = await q<FeedItem>(
    `select * from (
      select
        'message' as type, m.id, m.content, m.media_url, m.media_type, m.status,
        m.survival_count::int, m.reaction_count::int, m.created_at, m.author_id,
        p.username, p.display_name, p.avatar_url, m.branch_id,
        m.repost_of_id,
        coalesce((select b.reply_count from branches b where b.root_message_id = m.id), 0)::int as reply_count,
        (select count(*) from messages r where r.repost_of_id = m.id)::int as repost_count,
        null::text as event_kind
       from messages m
       join profiles p on p.id = m.author_id
       where m.season_id = $1 and m.parent_message_id is null
         and m.status in ('active','legendary') and m.feed_hidden = false
       order by (m.reaction_count + m.survival_count * 2) desc, m.created_at desc
       limit $2
    ) top_global
    union
    select * from (
      select
        'message' as type, m.id, m.content, m.media_url, m.media_type, m.status,
        m.survival_count::int, m.reaction_count::int, m.created_at, m.author_id,
        p.username, p.display_name, p.avatar_url, m.branch_id,
        m.repost_of_id,
        coalesce((select b.reply_count from branches b where b.root_message_id = m.id), 0)::int as reply_count,
        (select count(*) from messages r where r.repost_of_id = m.id)::int as repost_count,
        null::text as event_kind
       from messages m
       join profiles p on p.id = m.author_id
       where m.season_id = $1 and m.parent_message_id is null
         and m.status in ('active','legendary') and m.feed_hidden = false
       order by m.created_at desc
       limit $2
    ) recent`,
    [seasonId, half]
  );

  if (candidates.length === 0) {
    return { items: [], hasMore: false };
  }

  // дедупликация: top_global и recent пересекаются
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // 2. Аффинити пользователя к авторам
  const affinities = await q<{ author_id: string; score: number }>(
    `select author_id, score from author_affinities where user_id = $1`,
    [userId]
  );
  const affinityMap = new Map<string, number>();
  for (const a of affinities) {
    affinityMap.set(a.author_id, a.score);
  }

  // 3. Максимальные значения для нормализации
  const maxReactions = Math.max(...unique.map(c => c.reaction_count ?? 0), 1);
  const maxReplies = Math.max(...unique.map(c => c.reply_count ?? 0), 1);

  // 4. Считаем скор каждому кандидату
  const scored = unique.map((c) => {
    const authorAffinity = affinityMap.get(c.author_id ?? '') ?? 0.05;
    const globalSurvival = normalizeGlobalSurvival(c.reaction_count ?? 0, maxReactions);
    const freshness = freshnessScore(new Date(c.created_at).getTime(), nowMs);
    const urgency = urgencyScore(new Date(c.created_at).getTime(), waveAtMs, nowMs);
    const convValue = conversationValue(c.reply_count ?? 0, c.repost_count ?? 0, maxReplies);
    const score = personalScore(authorAffinity, globalSurvival, convValue, freshness, urgency);
    return { ...c, score };
  });

  // 5. Сортируем по скору
  scored.sort((a, b) => b.score - a.score);

  // 6. Применяем diversity (не > 3 одного автора)
  const pickedAuthors = new Map<string, number>();
  const result: FeedItem[] = [];
  for (const c of scored) {
    if (result.length >= limit) break;
    if (c.author_id && diversityBlocked(c.author_id, pickedAuthors)) continue;
    result.push(c);
    if (c.author_id) {
      pickedAuthors.set(c.author_id, (pickedAuthors.get(c.author_id) ?? 0) + 1);
    }
  }

  // 7. Exploration: если не хватило до limit, добиваем свежими (не попавшими в diversity)
  if (result.length < limit) {
    const freshCandidates = unique
      .filter(c => !result.find(r => r.id === c.id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    for (const c of freshCandidates) {
      if (result.length >= limit) break;
      if (c.author_id && diversityBlocked(c.author_id, pickedAuthors)) continue;
      result.push(c);
      if (c.author_id) pickedAuthors.set(c.author_id, (pickedAuthors.get(c.author_id) ?? 0) + 1);
    }
  }

  return { items: result, hasMore: false };
}