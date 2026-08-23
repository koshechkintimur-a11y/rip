'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { plural, formatTime } from '@/lib/phases';
import type { FeedItem } from '@/lib/types';

/** Ветка: корневое сообщение + ответы + «дроп» в любую точку дискуссии. */
export default function BranchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { season } = useWorld();
  const [root, setRoot] = useState<FeedItem | null>(null);
  const [replies, setReplies] = useState<FeedItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seasonChanged, setSeasonChanged] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGet<{ root: FeedItem | null; replies: FeedItem[]; season: any }>(
        `/api/messages/${id}`
      );
      setRoot(data.root);
      setReplies(data.replies || []);
      if (data.season && season && data.season.id !== season.id) setSeasonChanged(true);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  }, [id, season]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  // свой id — для подсветки своих сообщений
  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: { id: string } | null }>('/api/auth/me');
        setMyId(me.user?.id ?? null);
      } catch { /* тихо */ }
    })();
  }, []);

  const sendReply = async () => {
    const content = replyText.trim();
    if (!content) return;
    try {
      // дропаем в ответ на конкретное сообщение (или в корень)
      await apiPost('/api/messages', {
        content,
        parentMessageId: replyTo?.id ?? id,
      });
      setReplyText('');
      setReplyTo(null);
      void load();
    } catch (e: any) {
      setError(e.message || 'Не отправилось');
    }
  };

  if (loading) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем ветку…</div>;

  if (error && !root) return (
    <div className="p-4">
      <div className="border border-rip-warn/40 bg-rip-warn/5 rounded-lg p-4 text-sm text-rip-warn">⚠️ {error}</div>
      <button onClick={() => router.push('/feed')} className="mt-3 text-xs text-rip-dim">← на главную</button>
    </div>
  );

  return (
    <div>
      <button onClick={() => router.push('/feed')} className="px-4 pt-3 pb-1 text-xs text-rip-dim hover:text-rip-text">
        ← чат
      </button>

      {seasonChanged && (
        <div className="mx-4 mb-2 border border-rip-warn/40 bg-rip-warn/5 rounded-lg p-2 text-[11px] text-rip-warn">
          ⚠️ Это сообщение из прошлого сезона. Мир уже другой.
        </div>
      )}

      {root && (
        <BranchMessage
          item={root}
          isRoot
          mine={myId !== null && root.author_id === myId}
          onDrop={(username) => setReplyTo({ id: root.id, username })}
        />
      )}

      {/* ответы */}
      <div className="px-4 pb-32">
        <p className="py-2 text-[11px] text-rip-dim tracking-wider">
          {replies.length} {plural(replies.length, ['ответ', 'ответа', 'ответов'])}
        </p>
        {replies.map((r) => (
          <BranchMessage
            key={r.id}
            item={r}
            mine={myId !== null && r.author_id === myId}
            onDrop={(username) => setReplyTo({ id: r.id, username })}
          />
        ))}
        {replies.length === 0 && (
          <p className="py-8 text-center text-xs text-rip-dim">Пусто. Будь первым, кто дропнет в эту дискуссию.</p>
        )}
      </div>

      {/* композер дропа — над нижней навигацией */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-xl z-30 border-t border-rip-line bg-rip-bg/95 backdrop-blur px-4 py-2">
        {replyTo && (
          <div className="flex items-center justify-between mb-1 text-[11px] text-rip-dim">
            <span>дроп в ответ @{replyTo.username}</span>
            <button onClick={() => setReplyTo(null)} className="text-rip-dim hover:text-rip-text">✕</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void sendReply(); }}
            placeholder={replyTo ? `Дропнуть @${replyTo.username}...` : 'Дропнуть в дискус...'}
            maxLength={500}
            className="flex-1 bg-rip-panel border border-rip-line rounded-lg px-3 py-2 text-sm outline-none focus:border-rip-text"
          />
          <button
            onClick={() => void sendReply()}
            className="px-3 py-2 bg-rip-text text-rip-bg rounded-lg text-sm font-bold"
          >↓</button>
        </div>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-rip-blood">⚠️ {error}</p>}
    </div>
  );
}

/** Одно сообщение в ветке: подсветка своих, бейдж «дискус», кнопка дропа. */
function BranchMessage({ item, isRoot, mine, onDrop }: {
  item: FeedItem;
  isRoot?: boolean;
  mine: boolean;
  onDrop: (username: string) => void;
}) {
  const isDead = item.status === 'dead';
  const isLegendary = item.status === 'legendary' || (item.survival_count ?? 0) >= 5;

  return (
    <div className={`border-b border-rip-line/50 py-2.5 pl-1 ${mine ? 'bg-rip-panel/50 border-l-2 border-l-rip-warn' : ''}`}>
      <div className="flex items-baseline gap-2 text-sm flex-wrap">
        <span className="text-rip-dim">{item.username}</span>
        <span className="text-[11px] text-rip-dim/60">{formatTime(item.created_at)}</span>
        {isRoot && <span className="text-[9px] tracking-wider text-rip-dim border border-rip-line rounded px-1">ДИСКУС</span>}
        {isLegendary && <span className="text-[10px] text-rip-gold">⭐ {item.survival_count}</span>}
        {isDead && <span className="text-[10px] text-rip-dim/70">💀</span>}
        {mine && <span className="text-[9px] text-rip-warn/80">ты</span>}
      </div>
      <p className={`mt-0.5 text-[14px] leading-snug break-words ${isDead ? 'line-through decoration-rip-dim/40 text-rip-dim' : ''}`}>
        {item.content}
      </p>
      {item.media_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.media_url} alt="" className="mt-1.5 max-h-48 rounded-md border border-rip-line" loading="lazy" />
      )}
      <button
        onClick={() => onDrop(item.username || '?')}
        className="mt-1 text-[11px] text-rip-dim hover:text-rip-warn transition-colors"
      >
        ↓ дропнуть в ответ
      </button>
    </div>
  );
}