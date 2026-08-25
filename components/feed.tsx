'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorld } from '@/components/world-provider';
import { formatCountdown, plural } from '@/lib/phases';
import { apiPost } from '@/lib/api';
import type { FeedItem } from '@/lib/types';
import { Composer } from '@/components/composer';
import { MediaRenderer } from '@/components/media-renderer';
import { SurvivalChance } from '@/components/survival-chance';
import { Avatar } from '@/components/avatar';
import { ReactButton } from '@/components/react-button';
import { LinkPreview } from '@/components/link-preview';

const ITEMS_PER_PAGE = 30;

/** Репост сообщения: мягкое обновление без полной перезагрузки страницы. */
async function repostMessage(messageId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId }) });
    const d = await res.json().catch(() => null);
    if (!res.ok) throw new Error(d?.error || 'Ошибка репоста');
    return true;
  } catch (e: any) {
    alert(e.message || 'Не удалось репостнуть');
    return false;
  }
}

export function FeedList({ onDiscusChange }: { onDiscusChange?: (count: number, firstId: string | null) => void }) {
  const { season, phase } = useWorld();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageSeq = useRef(0); // защита от race поллинга: применяем только последний ответ

  const mergeItems = useCallback((incoming: FeedItem[], replace: boolean) => {
    setItems((prev) => {
      const base = replace ? [] : prev;
      const map = new Map<string, FeedItem>();
      for (const it of [...incoming, ...base]) {
        map.set(it.id, it);
        seen.current.add(it.id);
      }
      return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }, []);

  const loadPage = useCallback(async (before?: string) => {
    const seq = ++pageSeq.current;
    const qs = before ? `?before=${encodeURIComponent(before)}&limit=${ITEMS_PER_PAGE}` : `?limit=${ITEMS_PER_PAGE}`;
    try {
      const data = await fetch(`/api/feed${qs}`).then((r) => r.json());
      if (seq !== pageSeq.current) return; // устаревший ответ — игнорируем
      if (data.error) throw new Error(data.error);
      // Первая страница ВСЕГДА заменяет ленту: новые сообщения появляются,
      // погибшие (dead) исчезают без ручного refresh. Пагинация (before) — мержит в конец.
      const shouldReplace = !before;
      mergeItems(data.items || [], shouldReplace);
      setHasMore(data.hasMore);
      setError(null);
    } catch (e: any) {
      if (seq !== pageSeq.current) return;
      setError(e.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [mergeItems]);

  // поллинг новых сообщений
  useEffect(() => {
    void loadPage();
    timer.current = setInterval(() => {
      void loadPage();
    }, 3500);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loadPage]);

  // ленивая подгрузка при скролле
  useEffect(() => {
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 600) {
        if (hasMore && !loading && !refreshing) {
          setRefreshing(true);
          const last = items[items.length - 1];
          if (last) void loadPage(last.created_at).finally(() => setRefreshing(false));
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [hasMore, loading, refreshing, items, loadPage]);

  // сообщаем наверх: новые ответы в дискуссиях, где я участвовал
  useEffect(() => {
    if (!onDiscusChange) return;
    const withNew = items.filter((it) => it.type === 'message' && (it.new_after_me ?? 0) > 0);
    const total = withNew.reduce((s, it) => s + (it.new_after_me ?? 0), 0);
    const first = withNew[0]?.id ?? null;
    onDiscusChange(total, first);
  }, [items, onDiscusChange]);

  if (loading && items.length === 0) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-3 w-24 bg-rip-line rounded mb-2" />
            <div className="h-3 w-2/3 bg-rip-line rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (error && items.length === 0) {
    return (
      <div className="p-4 text-rip-warn border border-rip-warn/40 bg-rip-warn/5 rounded-lg m-4 text-sm">
        ⚠️ Техническая ошибка (не сезон умирает — просто сломалось). {error}
      </div>
    );
  }

  return (
    <div className="px-3 pb-4">

      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs text-rip-dim">
          {items.length} {plural(items.length, ['сообщение', 'сообщения', 'сообщений'])}
        </span>
        <span className="text-xs text-rip-dim font-mono">
          {season ? `СЕЗОН #${season.number}` : ''}
        </span>
      </div>

      <div className="space-y-0">
        {items.map((it) => (
          <FeedRow key={it.id} item={it} phase={phase} />
        ))}
      </div>

      {refreshing && <div className="py-4 text-center text-xs text-rip-dim animate-pulse">погибает… нет, загружается…</div>}
      {!hasMore && items.length > 0 && (
        <div className="py-6 text-center text-xs text-rip-dim">
          — здесь начинается конец сезона —
        </div>
      )}

    </div>
  );
}

/** Плавающая иконка справа: прыжок по веткам, где я участвовал; подсвечивается при новых ответах. */

function FeedRow({ item, phase, onOpen }: { item: FeedItem; phase: string; onOpen?: () => void }) {
  const router = useRouter();

  if (item.type === 'system') {
    return <SystemRow item={item} />;
  }

  const isDead = item.status === 'dead' || item.status === 'archived';
  const isLegendary = item.status === 'legendary' || (item.survival_count ?? 0) >= 5;
  const replyCount = item.reply_count ?? 0;
  const repostCount = item.repost_count ?? 0;
  const critical = phase === 'emergency' || phase === 'final';
  const newAfterMe = item.new_after_me ?? 0;

  return (
    <div
      className={`py-3 cursor-pointer hover:bg-rip-panel/30 transition-colors ${isDead ? 'opacity-40' : ''} ${critical ? 'group/fade' : ''}`}
      onClick={() => router.push(`/message/${item.id}`)}
    >
      <div className="flex items-start gap-2.5">
        <button onClick={(e) => { e.stopPropagation(); router.push(`/profile/${item.username}`); }} className="shrink-0">
          <Avatar url={item.avatar_url} username={item.username} size={36} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="font-semibold text-[15px] hover:underline cursor-pointer"
              onClick={(e) => { e.stopPropagation(); router.push(`/profile/${item.username}`); }}
            >
              {item.username}
            </span>
            {isLegendary && <span className="text-xs text-rip-gold" title="Легендарное">⭐</span>}
            <span className="text-xs text-rip-dim/60">
              {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isDead && !item.repost_of_id && <SurvivalChance item={item} legendary={isLegendary} />}
          </div>
          {item.repost_of_id ? (
            // РЕПОСТ: только рамка с оригиналом, без дублирования контента
            <div className="mt-1.5 border border-rip-line rounded-md bg-rip-panel/40 p-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); router.push(`/message/${item.repost_of_id}`); }}>
              <span className="text-[10px] text-rip-dim">🔁 репост @{item.repost_username}</span>
              {item.repost_content && <p className="mt-0.5 text-sm">{item.repost_content}</p>}
              {item.repost_media_url && <MediaRenderer url={item.repost_media_url} type={item.repost_media_type} />}
            </div>
          ) : (
            <>
              {item.content && (
                <p className={`mt-0.5 text-[15px] leading-snug break-words ${isDead ? 'line-through decoration-rip-dim/40' : ''}`}>
                  {item.content}
                </p>
              )}
              {!item.media_url && item.content && <LinkPreview text={item.content} />}
              {item.media_url && (
                <MediaRenderer url={item.media_url} type={item.media_type} />
              )}
            </>
          )}
          <div className="mt-1 flex items-center gap-4 text-xs text-rip-dim" onClick={(e) => e.stopPropagation()}>
            <button
              className={`flex items-center gap-1 hover:text-rip-text transition-colors ${newAfterMe > 0 ? 'text-rip-warn font-medium' : ''}`}
              onClick={() => void router.push(`/message/${item.id}`)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>
              {replyCount}
              {newAfterMe > 0 && <span className="text-[10px] font-bold">+{newAfterMe}</span>}
            </button>
            <ReactButton messageId={item.id} initialCount={item.reaction_count ?? 0} />
            <button
              className="flex items-center gap-1 hover:text-rip-text transition-colors"
              onClick={async (e) => { e.stopPropagation(); const ok = await repostMessage(item.id); if (ok) { /* лента обновится поллингом */ } }}
              title="Репостнуть"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              {repostCount > 0 && <span>{repostCount}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemRow({ item }: { item: FeedItem }) {
  const kind = item.event_kind;
  // без эмодзи и без зелёного — как в концепте: нейтральный тон
  const icon = kind === 'season_ended' ? '☠' : kind === 'season_warning' ? '⚠️' : '◆';
  const accent = kind === 'season_ended' ? 'text-rip-blood' : kind === 'season_warning' ? 'text-rip-warn' : 'text-rip-dim/60';

  return (
    <div className="py-3 flex gap-2 items-start">
      <span className={accent}>{icon}</span>
      <div>
        <p className={`text-[13px] leading-snug ${accent}`}>{item.content}</p>
        <p className="mt-0.5 text-[10px] text-rip-dim/60">
          {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
