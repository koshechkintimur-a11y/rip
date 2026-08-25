'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { useLightbox } from '@/components/lightbox';
import { Avatar } from '@/components/avatar';
import { compressImage } from '@/lib/client-image';
import { formatTime } from '@/lib/phases';

type Msg = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string; sender_username: string; sender_avatar_url?: string | null; media_url?: string | null };

/** Диалог с конкретным пользователем. */
export default function DmChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const router = useRouter();
  const { refresh } = useWorld();
  const { open: openImage } = useLightbox();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'gif' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const d = await apiGet<{ messages: Msg[]; conversationId: string }>(
        `/api/dm?conversationId=${encodeURIComponent(conversationId)}`
      );
      setMessages(d.messages || []);
      // пометить прочитанным
      await apiPatch('/api/dm', { conversationId }).catch(() => {});
      void refresh();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 4000);
    return () => clearInterval(id);
  }, [conversationId]);

  // свой user id — для выравнивания своих сообщений справа
  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: { id: string } | null }>('/api/auth/me');
        setMyId(me.user?.id ?? null);
      } catch { /* тихо */ }
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Нужна картинка (PNG/JPEG/WebP/GIF/HEIC)');
      return;
    }
    const file = await compressImage(f); // сжатие больших фото
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMedia({ url: res.url, type: res.mediaType });
    } catch (e: any) {
      setError(e?.message || 'Файл не загрузился');
    }
  };

  const send = async () => {
    const content = text.trim();
    if (!content && !media) return;
    setText('');
    try {
      await apiPost('/api/dm', {
        conversationId,
        content: content || '📷',
        mediaUrl: media?.url || null,
        mediaType: media?.type || null,
      });
      setMedia(null);
      void load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="flex flex-col h-dvh">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-rip-line">
        <button onClick={() => router.push('/dm')} className="text-xs text-rip-dim hover:text-rip-text">←</button>
        <span className="text-sm font-medium">Диалог</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-rip-bg">
        {loading && <p className="text-xs text-rip-dim animate-pulse">загружаем…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-xs text-rip-dim text-center pt-8">Нет сообщений. Напиши первым.</p>
        )}
        {messages.map((m) => {
          const mine = myId !== null && m.sender_id === myId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2 items-end`}>
              {!mine && <Avatar url={m.sender_avatar_url} username={m.sender_username} size={28} />}
              <div className={`max-w-[80%] rounded-lg px-3 py-2 border ${mine ? 'bg-rip-panel2 border-rip-line' : 'bg-rip-panel border-rip-line'}`}>
                <div className="flex items-baseline gap-2 mb-0.5">
                  <button
                    onClick={() => router.push(`/profile/${m.sender_username}`)}
                    className="text-[10px] text-rip-dim hover:text-rip-text"
                  >
                    {mine ? 'я' : m.sender_username}
                  </button>
                  <span className="text-[10px] text-rip-dim/60">{formatTime(m.created_at)}</span>
                </div>
                {m.media_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.media_url}
                    alt=""
                    className="mt-1 max-h-48 rounded-md border border-rip-line cursor-zoom-in"
                    loading="lazy"
                    onClick={() => openImage(m.media_url!)}
                  />
                )}
                <p className="text-sm leading-snug break-words">{m.content}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-rip-line p-3 flex items-center gap-2 bg-rip-bg">
        {media && (
          <div className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="" className="h-10 w-10 rounded border border-rip-line object-cover" />
            <button className="absolute -top-1.5 -right-1.5 bg-rip-blood text-white rounded-full w-4 h-4 text-[10px] leading-none" onClick={() => setMedia(null)}>✕</button>
          </div>
        )}
        <button onClick={() => fileRef.current?.click()} className="text-rip-dim hover:text-rip-text text-lg" title="Прикрепить фото">🖼</button>
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
          placeholder="Написать..."
          maxLength={1000}
          className="flex-1 bg-rip-panel border border-rip-line rounded-lg px-3 py-2 text-sm outline-none focus:border-rip-text"
        />
        <button onClick={() => void send()} className="px-4 py-2 bg-rip-text text-rip-bg rounded-lg text-sm font-bold">→</button>
      </div>
      {error && <p className="px-4 pb-2 text-xs text-rip-blood bg-rip-bg">⚠️ {error}</p>}
    </div>
  );
}