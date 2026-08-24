'use client';

import { useState, useRef } from 'react';
import { apiPost } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { motion } from 'framer-motion';

/** Покупка места в ленте внимания: текст + слоты + длительность + фото. */
export function AttentionBuy({ onClose, initialContent, messageId }: {
  onClose: () => void;
  /** предзаполнить текст (при продвижении сообщения из ветки) */
  initialContent?: string;
  /** привязать слот к сообщению — карточка внимания откроет ветку по клику */
  messageId?: string;
}) {
  const { refresh } = useWorld();
  const [content, setContent] = useState(initialContent || '');
  const [slots, setSlots] = useState(1);
  const [minutes, setMinutes] = useState(10);
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'gif' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cost = 20 * (minutes / 10) * slots;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMedia({ url: res.url, type: res.mediaType });
    } catch (e: any) {
      setError(e?.message || 'Файл не загрузился');
    }
  };

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/attention', {
        content,
        slots,
        minutes,
        mediaUrl: media?.url || null,
        mediaType: media?.type || null,
        messageId: messageId || null,
      });
      setDone(true);
      void refresh();
    } catch (e: any) {
      setError(e.message || 'Не получилось');
    }
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-rip-panel border border-rip-line rounded-t-2xl sm:rounded-2xl p-5 pb-8"
      >
        {done ? (
          <div className="text-center py-6">
            <p className="text-2xl mb-2">⚡</p>
            <p className="font-bold text-rip-text">Твой крик в эфире!</p>
            <p className="text-xs text-rip-dim mt-1">Слот появится в ленте внимания.</p>
            <button onClick={onClose} className="mt-5 w-full bg-rip-text text-rip-bg rounded-lg py-2.5 text-sm font-bold">
              Ок
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm tracking-wider">⚡ КУПИТЬ ВНИМАНИЕ</h3>
              <button onClick={onClose} className="text-rip-dim hover:text-rip-text">✕</button>
            </div>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Что крикнуть миру? (макс 80)"
              maxLength={80}
              rows={2}
              className="w-full bg-rip-bg border border-rip-line rounded-lg px-3 py-2 text-sm outline-none focus:border-rip-warn resize-none"
            />

            {/* фото */}
            {media && (
              <div className="relative mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media.url} alt="" className="h-20 rounded border border-rip-line" />
                <button className="absolute -top-1.5 -right-1.5 bg-rip-blood text-white rounded-full w-5 h-5 text-xs" onClick={() => setMedia(null)}>✕</button>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs text-rip-dim hover:text-rip-text border border-rip-line rounded px-2 py-1"
            >
              {media ? '📷 заменить фото' : '📷 прикрепить фото'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-rip-dim mb-1">СЛОТОВ</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSlots(n)}
                      className={`flex-1 py-1.5 rounded text-xs border transition-colors ${slots === n ? 'border-rip-warn text-rip-warn' : 'border-rip-line text-rip-dim'}`}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-rip-dim mb-1">МИНУТ</p>
                <div className="flex gap-1">
                  {[10, 30, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => setMinutes(m)}
                      className={`flex-1 py-1.5 rounded text-xs border transition-colors ${minutes === m ? 'border-rip-warn text-rip-warn' : 'border-rip-line text-rip-dim'}`}
                    >{m}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-rip-dim">Стоимость: <b className="text-rip-text">{cost} монет</b></span>
              <button
                onClick={() => void buy()}
                disabled={busy || !content.trim()}
                className="bg-rip-warn text-black rounded-lg px-5 py-2.5 text-sm font-bold disabled:opacity-40"
              >
                {busy ? '...' : '⚡ КРИЧАТЬ'}
              </button>
            </div>
            {error && <p className="mt-2 text-xs text-rip-blood">⚠️ {error}</p>}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}