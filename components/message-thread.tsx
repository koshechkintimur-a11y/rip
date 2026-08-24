'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { AttentionBuy } from '@/components/attention-buy';
import { ReactButton } from '@/components/react-button';
import { MediaRenderer } from '@/components/media-renderer';
import { plural, formatTime } from '@/lib/phases';
import type { FeedItem } from '@/lib/types';

/**
 * ОБЩАЯ логика ветки сообщения: root + ответы + поллинг + дроп с медиа +
 * reply-to + черепок + репост + продвижение в внимание.
 *
 * Используется ДВУМЯ способами:
 *  1. Страница /message/[id] (из чата) — полноэкранно, с backLabel/onBack
 *  2. Модалка поверх ленты (из ленты внимания) — без back, закрытие через onClose
 *
 * Никакого хардкода «Лента»/«Чат» внутри — контекст задаётся пропсами.
 */
export function MessageThread({ messageId, backLabel, onBack, onClose }: {
  messageId: string;
  /** текст кнопки назад (напр. «← Чат») — если передан, рендерится шапка с back */
  backLabel?: string;
  onBack?: () => void;
  /** если передано — рендерится кнопка ✕ (режим модалки) */
  onClose?: () => void;
}) {
  const { season } = useWorld();
  const [root, setRoot] = useState<FeedItem | null>(null);
  const [replies, setReplies] = useState<FeedItem[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [replyMedia, setReplyMedia] = useState<{ url: string; type: 'image' | 'gif' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seasonChanged, setSeasonChanged] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const replyFileRef = useRef<HTMLInputElement>(null);
  const loadSeq = useRef(0); // защита от race: применяем только последний ответ

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const data = await apiGet<{ root: FeedItem | null; replies: FeedItem[]; season: any }>(
        `/api/messages/${messageId}`
      );
      if (seq !== loadSeq.current) return; // пришёл устаревший ответ — игнорируем
      setRoot(data.root);
      setReplies(data.replies || []);
      if (data.season && season) setSeasonChanged(data.season.id !== season.id);
      setError(null);
    } catch (e: any) {
      if (seq !== loadSeq.current) return;
      setError(e.message || 'Ошибка');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [messageId, season]);

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
    if (!content && !replyMedia) return;
    try {
      // ПЛОСКАЯ ветка: parent всегда root (messageId), replyTo — только визуальная пометка.
      // Иначе ответ на reply (parent=reply) не попадёт в выборку (load смотрит parent=root).
      await apiPost('/api/messages', {
        content: content || '📷',
        parentMessageId: messageId,
        mediaUrl: replyMedia?.url || null,
        mediaType: replyMedia?.type || null,
      });
      setReplyText('');
      setReplyTo(null);
      setReplyMedia(null);
      void load();
    } catch (e: any) {
      setError(e.message || 'Не отправилось');
    }
  };

  const onReplyFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Нужна картинка (PNG/JPEG/WebP/GIF/HEIC)');
      return;
    }
    const form = new FormData();
    form.append('file', f);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setReplyMedia({ url: res.url, type: res.mediaType });
    } catch (e: any) {
      setError(e?.message || 'Файл не загрузился');
    }
  };

  if (loading) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем ветку…</div>;

  if (error && !root) return (
    <div className="p-4">
      <div className="border border-rip-warn/40 bg-rip-warn/5 rounded-lg p-4 text-sm text-rip-warn">⚠️ {error}</div>
      {onBack && <button onClick={onBack} className="mt-3 text-xs text-rip-dim">← назад</button>}
    </div>
  );

  // защита от пустого экрана: API вернул root=null без ошибки
  if (!loading && !root) return (
    <div className="p-4">
      <div className="border border-rip-line rounded-lg p-4 text-sm text-rip-dim">☠ Сообщение не найдено или умерло.</div>
      {onBack && <button onClick={onBack} className="mt-3 text-xs text-rip-dim hover:text-rip-text">← назад</button>}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* шапка: back (страница) или ✕ (модалка) */}
      {(backLabel || onClose) && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-rip-line shrink-0">
          {backLabel && onBack ? (
            <button onClick={onBack} className="text-xs text-rip-dim hover:text-rip-text">
              {backLabel}
            </button>
          ) : <span />}
          {onClose && (
            <button onClick={onClose} className="text-rip-dim hover:text-rip-text text-lg leading-none">✕</button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
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
            onPromote={() => setShowPromote(true)}
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
      </div>

      {/* композер дропа */}
      <div className="border-t border-rip-line bg-rip-bg/95 backdrop-blur px-4 py-2 shrink-0">
        {replyTo && (
          <div className="flex items-center justify-between mb-1 text-[11px] text-rip-dim">
            <span>дроп в ответ @{replyTo.username}</span>
            <button onClick={() => setReplyTo(null)} className="text-rip-dim hover:text-rip-text">✕</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {replyMedia && (
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={replyMedia.url} alt="" className="h-9 w-9 rounded border border-rip-line object-cover" />
              <button className="absolute -top-1.5 -right-1.5 bg-rip-blood text-white rounded-full w-4 h-4 text-[10px] leading-none" onClick={() => setReplyMedia(null)}>✕</button>
            </div>
          )}
          <button onClick={() => replyFileRef.current?.click()} className="text-rip-dim hover:text-rip-text text-lg shrink-0" title="Прикрепить фото">🖼</button>
          <input ref={replyFileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void onReplyFile(e.target.files?.[0])} />
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

      {/* продвинуть сообщение в ленту внимания */}
      {showPromote && root && (
        <AttentionBuy
          onClose={() => setShowPromote(false)}
          initialContent={root.content || undefined}
          messageId={root.id}
        />
      )}
    </div>
  );
}

/** Одно сообщение в ветке: автор, статус, контент, медиа, черепок, репост, дроп. */
function BranchMessage({ item, isRoot, mine, onDrop, onPromote }: {
  item: FeedItem;
  isRoot?: boolean;
  mine: boolean;
  onDrop: (username: string) => void;
  onPromote?: () => void;
}) {
  const isDead = item.status === 'dead';
  const isLegendary = item.status === 'legendary' || (item.survival_count ?? 0) >= 5;
  const replyCount = item.reply_count ?? 0;
  const repostCount = item.repost_count ?? 0;

  const repost = async () => {
    try {
      await fetch('/api/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: item.id }),
      });
    } catch { /* тихо */ }
  };

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
      {item.content && (
        <p className={`mt-0.5 text-[14px] leading-snug break-words ${isDead ? 'line-through decoration-rip-dim/40 text-rip-dim' : ''}`}>
          {item.content}
        </p>
      )}
      {item.media_url && (
        <MediaRenderer url={item.media_url} type={item.media_type} />
      )}

      {/* действия: ответы, черепок, репост, дроп, продвижение */}
      <div className="mt-1 flex items-center gap-4 text-xs text-rip-dim">
        <span className="flex items-center gap-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>
          {replyCount}
        </span>
        <ReactButton messageId={item.id} initialCount={item.reaction_count ?? 0} />
        <button
          className="flex items-center gap-1 hover:text-rip-text transition-colors"
          onClick={() => void repost()}
          title="Репостнуть"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
          {repostCount > 0 && <span>{repostCount}</span>}
        </button>
        <button
          onClick={() => onDrop(item.username || '?')}
          className="text-rip-dim hover:text-rip-warn transition-colors"
        >
          ↓ дропнуть
        </button>
        {isRoot && onPromote && (
          <button
            onClick={onPromote}
            className="text-rip-warn hover:text-rip-warn/80 transition-colors"
          >
            ⚡ продвинуть
          </button>
        )}
      </div>
    </div>
  );
}
