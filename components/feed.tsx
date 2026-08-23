'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorld } from '@/components/world-provider';
import { formatCountdown, plural } from '@/lib/phases';
import { apiPost } from '@/lib/api';
import type { FeedItem } from '@/lib/types';
import { useLightbox } from '@/components/lightbox';

const ITEMS_PER_PAGE = 30;

export function FeedList() {
  const { season, phase } = useWorld();
  const router = useRouter();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const firstLoad = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

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
    const qs = before ? `?before=${encodeURIComponent(before)}&limit=${ITEMS_PER_PAGE}` : `?limit=${ITEMS_PER_PAGE}`;
    try {
      const data = await fetch(`/api/feed${qs}`).then((r) => r.json());
      if (data.error) throw new Error(data.error);
      // заменяем ленту ТОЛЬКО при первом заполнении; поллинг/пагинация — мержат
      const shouldReplace = !before && firstLoad.current;
      firstLoad.current = false;
      mergeItems(data.items || [], shouldReplace);
      setHasMore(data.hasMore);
      setError(null);
    } catch (e: any) {
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
      <DiscusJump items={items} />

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
function DiscusJump({ items }: { items: FeedItem[] }) {
  const router = useRouter();
  // ветки, где я участвовал
  const myDiscs = items.filter((it) => it.type === 'message' && it.participated);
  // ветки с новыми ответами после моего последнего
  const withNew = myDiscs.filter((it) => (it.new_after_me ?? 0) > 0);
  const totalNew = withNew.reduce((s, it) => s + (it.new_after_me ?? 0), 0);

  if (myDiscs.length === 0) return null;

  const jump = () => {
    // сначала прыгаем в ветки с новыми ответами, потом в остальные
    const target = withNew.length > 0 ? withNew[0] : myDiscs[0];
    if (target) router.push(`/message/${target.id}`);
  };

  return (
    <button
      onClick={jump}
      title={`${myDiscs.length} дискуссий · ${totalNew} новых ответов`}
      className={`fixed right-3 bottom-40 z-30 w-11 h-11 rounded-full border flex items-center justify-center text-lg transition-all
        ${withNew.length > 0
          ? 'border-rip-warn bg-rip-warn/15 text-rip-warn animate-pulse'
          : 'border-rip-line bg-rip-panel/90 text-rip-dim hover:text-rip-text hover:border-rip-warn'}`}
    >
      💬
      {totalNew > 0 && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rip-blood text-white text-[10px] flex items-center justify-center">
          {totalNew > 9 ? '9+' : totalNew}
        </span>
      )}
    </button>
  );
}

function FeedRow({ item, phase }: { item: FeedItem; phase: string }) {
  const router = useRouter();
  const { open: openImage } = useLightbox();

  if (item.type === 'system') {
    return <SystemRow item={item} />;
  }

  const isDead = item.status === 'dead' || item.status === 'archived';
  const isLegendary = item.status === 'legendary' || (item.survival_count ?? 0) >= 5;
  const replyCount = item.reply_count ?? 0;
  const critical = phase === 'emergency' || phase === 'final';
  const isDiscus = replyCount > 0;
  const participated = !!item.participated;
  const newAfterMe = item.new_after_me ?? 0;

  return (
    <div
      className={`border-b border-rip-line/60 py-2.5 px-1 cursor-pointer hover:bg-rip-panel/40 transition-colors ${isDead ? 'opacity-50' : ''} ${critical ? 'group/fade' : ''}`}
      onClick={() => router.push(`/message/${item.id}`)}
    >
      <div className="flex items-baseline gap-2 text-sm flex-wrap">
        <span
          className="text-rip-dim shrink-0 hover:text-rip-text cursor-pointer"
          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${item.username}`); }}
        >
          {item.username}
        </span>
        <span className="text-[11px] text-rip-dim/60 shrink-0">
          {new Date(item.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </span>
        {isLegendary && <span className="text-[10px] text-rip-gold shrink-0">⭐ {item.survival_count}</span>}
        {item.status === 'dead' && <span className="text-[10px] text-rip-dim/70 shrink-0">💀</span>}
        {isDiscus && (
          <span className="text-[9px] tracking-wider text-rip-dim border border-rip-line rounded px-1 shrink-0">
            ДИСКУС · {replyCount}
          </span>
        )}
        {participated && (
          <span className={`text-[9px] tracking-wider border rounded px-1 shrink-0 ${newAfterMe > 0 ? 'text-rip-warn border-rip-warn/60 bg-rip-warn/10' : 'text-rip-green border-rip-green/40'}`}>
            {newAfterMe > 0 ? `+${newAfterMe} ОТВЕТА` : 'Я УЧАСТВОВАЛ'}
          </span>
        )}
      </div>
      <p className={`mt-0.5 text-[15px] leading-snug break-words ${isDead ? 'line-through decoration-rip-dim/50' : ''}`}>
        {item.content}
      </p>
      {item.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.media_url}
          alt=""
          className="mt-1.5 max-h-48 rounded-md border border-rip-line cursor-zoom-in"
          loading="lazy"
          onClick={(e) => { e.stopPropagation(); openImage(item.media_url!); }}
        />
      )}
      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-rip-dim" onClick={(e) => e.stopPropagation()}>
        <button
          className="hover:text-rip-text transition-colors"
          onClick={() => void router.push(`/message/${item.id}`)}
        >
          ↳ {replyCount} {plural(replyCount, ['ответ', 'ответа', 'ответов'])}
        </button>
        <ReactButton messageId={item.id} initialCount={item.reaction_count ?? 0} />
      </div>
    </div>
  );
}

function ReactButton({ messageId, initialCount }: { messageId: string; initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiPost<{ reaction_count: number; active: boolean }>('/api/messages/react', { messageId });
      setCount(res.reaction_count);
      setActive(res.active);
    } catch { /* молча */ }
    setBusy(false);
  };

  return (
    <button className={`hover:text-rip-blood transition-colors ${active ? 'text-rip-blood' : ''}`} onClick={() => void toggle()}>
      💀 {count}
    </button>
  );
}

function SystemRow({ item }: { item: FeedItem }) {
  const kind = item.event_kind;
  const icon = kind === 'season_ended' ? '☠' : kind === 'reset_done' ? '🟢' : kind === 'season_started' ? '🌱' : kind === 'season_warning' ? '⚠️' : '◆';
  const accent = kind === 'season_ended' ? 'text-rip-blood' : kind === 'season_warning' ? 'text-rip-warn' : 'text-rip-green';

  return (
    <div className="border-b border-rip-line/40 py-3 px-1 flex gap-2 items-start">
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
