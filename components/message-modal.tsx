'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet, apiPost } from '@/lib/api';
import { FeedItem } from '@/lib/types';
import { MediaRenderer } from '@/components/media-renderer';
import { Avatar } from '@/components/avatar';
import { ReactButton } from '@/components/react-button';
import { formatTime } from '@/lib/phases';

type Props = {
  item: FeedItem;
  onClose: () => void;
  onRepost?: () => void;
  myId?: string | null;
};

export function MessageModal({ item, onClose, myId }: Props) {
  const router = useRouter();
  const [replies, setReplies] = useState<FeedItem[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [repostCount, setRepostCount] = useState(0);
  const [reactionCount, setReactionCount] = useState(item.reaction_count ?? 0);

  const isMine = myId !== null && item.author_id === myId;

  // загружаем ветку при открытии
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ root: any; replies: any[] }>(`/api/messages/${item.id}`);
        if (!alive) return;
        if (d.replies) setReplies(d.replies);
        // счётчик репостов: считаем через API
        const feed = await apiGet<{ items: any[] }>('/api/feed?limit=50');
        if (!alive) return;
        const reposts = feed.items.filter(i => i.type === 'message' && i.repost_of_id === item.id);
        setRepostCount(reposts.length);
      } catch { /*тихо*/ }
    };
    void load();
    return () => { alive = false; };
  }, [item.id]);

  const sendReply = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const r = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim(), parentMessageId: item.id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Ошибка');
      setReplies(prev => [...prev, {
        id: d.message.id,
        type: 'message',
        content: text.trim(),
        media_url: null,
        media_type: null,
        status: 'active',
        survival_count: 0,
        reaction_count: 0,
        created_at: d.message.created_at,
        author_id: myId || '',
        username: 'я',
        display_name: 'я',
        avatar_url: null,
        reply_count: 1,
      }]);
      setText('');
    } catch { /*тихо*/ }
    setSending(false);
  };

  // клик вне модалки = закрыть
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleOverlay}
      >
        <motion.div
          className="bg-rip-panel border border-rip-line rounded-lg w-full max-w-lg mx-4 max-h-[85vh] flex flex-col"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: { type: 'spring', damping: 25 } }}
        >
          {/* Шапка: автор + крестик */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-rip-line">
            <div className="flex items-center gap-2.5">
              <button onClick={(e) => { e.stopPropagation(); router.push(`/profile/${item.username}`); }}>
                <Avatar url={item.avatar_url} username={item.username} size={32} />
              </button>
              <div>
                <button
                  className="text-sm font-semibold hover:underline"
                  onClick={(e) => { e.stopPropagation(); router.push(`/profile/${item.username}`); }}
                >
                  {item.display_name || item.username}
                </button>
                <div className="text-[10px] text-rip-dim">{formatTime(item.created_at)}</div>
              </div>
            </div>
            <button onClick={onClose} className="text-rip-dim hover:text-rip-text text-lg leading-none">✕</button>
          </div>

          {/* Контент: текст и медиа */}
          <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
            {item.content && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{item.content}</p>
            )}
            {item.media_url && (
              <MediaRenderer url={item.media_url} type={item.media_type} />
            )}

            {/* Счётчики */}
            <div className="flex items-center gap-4 text-xs text-rip-dim">
              <span>💬 {replies.length}</span>
              <span>💀 {reactionCount}</span>
              {repostCount > 0 && <span>🔁 {repostCount}</span>}
            </div>

            {/* Действия */}
            <div className="flex items-center gap-3 flex-wrap pt-1">
              <ReactButton messageId={item.id} initialCount={reactionCount} onChange={setReactionCount} />
              {item.id && (
                <button
                  className="flex items-center gap-1 text-xs text-rip-dim hover:text-rip-text"
                  onClick={async (e) => { e.stopPropagation(); await fetch('/api/messages', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId: item.id }) }); setRepostCount(c => c + 1); }}
                >
                  🔁 репост
                </button>
              )}
              {!isMine && item.username && (
                <button
                  className="flex items-center gap-1 text-xs text-rip-dim hover:text-rip-text"
                  onClick={async () => {
                    try {
                      const me = await apiGet<{ user: { id: string } }>('/api/auth/me');
                      const res = await fetch('/api/dm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipientId: item.author_id }) });
                      const d = await res.json();
                      if (d.conversationId) router.push(`/dm/${d.conversationId}`);
                    } catch { /*тихо*/ }
                  }}
                >
                  ✉ написать
                </button>
              )}
            </div>

            {/* Ответы */}
            {replies.length > 0 && (
              <div className="border-t border-rip-line/40 pt-3 space-y-2.5">
                <p className="text-[11px] text-rip-dim font-semibold">ОТВЕТЫ</p>
                {replies.map(r => (
                  <div key={r.id} className="flex items-start gap-2">
                    <button onClick={() => router.push(`/profile/${r.username}`)}>
                      <Avatar url={r.avatar_url} username={r.username} size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold">{r.username}</span>
                      <p className="text-sm">{r.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Композер ответа */}
          <div className="border-t border-rip-line px-3 py-2 flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Дропнуть в дискус..."
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-sm py-1 placeholder:text-rip-dim/50"
              maxLength={500}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) sendReply(); } }}
            />
            <button
              onClick={() => void sendReply()}
              disabled={sending || !text.trim()}
              className="shrink-0 px-3 py-1.5 bg-rip-text text-rip-bg rounded text-xs font-semibold disabled:opacity-40"
            >
              {sending ? '...' : '→'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}