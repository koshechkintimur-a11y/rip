/**
 * Survival Engine v1 — единый алгоритм RIP (без ML).
 *
 * Философия: пользователь не «потребляет», он голосует за жизнь контента.
 * 💀 = голос за жизнь. Каждое действие усиливает аффинити к автору,
 * и алгоритм показывает больше контента, которому пользователь помогает жить.
 *
 * Все веса — конфигурируемые (стартовые из ТЗ).
 */
export const SURVIVAL_CONFIG = {
  // веса действий (signal weights)
  weights: {
    impression: 0.01,
    open: 0.05,
    thread_open: 0.15,
    read_5s: 0.10,
    read_15s: 0.15,
    reply: 0.40,
    skull: 0.50,
    repost: 0.70,
  },
  // формула персонального скора (из ТЗ п.10)
  score: {
    personal_interest: 0.35,
    author_affinity: 0.15,
    global_survival: 0.15,
    freshness: 0.10,
    urgency: 0.15,
    conversation_value: 0.10,
  },
  // микс выдачи (из ТЗ п.18)
  mix: {
    relevant: 0.70,  // персонально релевантные
    exploration: 0.20, // новое, что может захотеть спасти
    echo: 0.10,      // исторически сильные / эхо
  },
  diversity: {
    max_per_author: 3, // не больше N постов одного автора в выдаче
  },
  decay: {
    affinity_halflife_hours: 24 * 14, // аффинити затухает за ~2 недели
    freshness_halflife_minutes: 60,   // свежесть поста затухает за час
  },
} as const;

/** Нормализованная свежесть: 1 = только что, → 0 за ~2 часа. */
export function freshnessScore(createdAtMs: number, nowMs: number): number {
  const ageMin = Math.max(0, (nowMs - createdAtMs) / 60000);
  const hl = SURVIVAL_CONFIG.decay.freshness_halflife_minutes;
  return Math.pow(0.5, ageMin / hl);
}

/** Срочность: контент, который скоро умрёт, важнее (пик ~60 мин до волны). */
export function urgencyScore(createdAtMs: number, waveAtMs: number | null, nowMs: number): number {
  if (!waveAtMs) return 0.1; // волны нет — срочность низкая
  const toWaveMin = Math.max(0, (waveAtMs - nowMs) / 60000);
  // от 1 (30 мин до волны) к 0.2 (далеко от волны)
  const score = Math.max(0.2, Math.min(1, 30 / Math.max(toWaveMin, 5)));
  return score;
}

/**
 * Персональный скор сообщения (ТЗ п.10).
 * @param authorAffinity аффинити пользователя к автору (0..1)
 * @param globalSurvival глобальная выживаемость (нормализованная 0..1)
 * @param conversationValue диалоговая ценность (ответы/ветка, 0..1)
 * @param freshness 0..1
 * @param urgency 0..1
 */
export function personalScore(
  authorAffinity: number,
  globalSurvival: number,
  conversationValue: number,
  freshness: number,
  urgency: number
): number {
  const c = SURVIVAL_CONFIG.score;
  // без NLP-тем personal_interest ≈ author_affinity (первая версия без ML)
  const personalInterest = authorAffinity;
  return (
    personalInterest * c.personal_interest +
    authorAffinity * c.author_affinity +
    globalSurvival * c.global_survival +
    freshness * c.freshness +
    urgency * c.urgency +
    conversationValue * c.conversation_value
  );
}

/** Нормализация глобальной выживаемости к 0..1 (по логарифму реакций). */
export function normalizeGlobalSurvival(reactionCount: number, maxReactions: number): number {
  if (maxReactions <= 0) return 0.1;
  return Math.min(1, Math.log1p(reactionCount) / Math.log1p(maxReactions));
}

/** Диалоговая ценность: ответы/репосты поста (0..1). */
export function conversationValue(replies: number, reposts: number, maxReplies: number): number {
  if (maxReplies <= 0) return 0.05;
  return Math.min(1, (replies + reposts * 2) / Math.max(maxReplies, 1));
}

/**
 * Diversity-штраф: не больше N постов одного автора подряд в выдаче.
 * Возвращает true, если автора уже хватает — кандидата надо отложить.
 */
export function diversityBlocked(authorId: string, pickedAuthors: Map<string, number>): boolean {
  const n = pickedAuthors.get(authorId) ?? 0;
  return n >= SURVIVAL_CONFIG.diversity.max_per_author;
}
