'use client';

import { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useWorld } from '@/components/world-provider';
import { apiPost } from '@/lib/api';
import { GifPicker } from '@/components/gif-picker';
import { motion } from 'framer-motion';

/** Модалка создания поста (вместо композера в ленте, как в Threads).
 *  >200 символов → «дискус»: пост открывает тред, следующие сообщения
 *  дополняют его (ветка родителя), при открытии — полная ветка автора. */
type ComposerCtx = {
  openComposer: () => void;
};
const Ctx = createContext<ComposerCtx>({ openComposer: () => {} });
export const useComposer = () => useContext(Ctx);

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  const { refresh } = useWorld();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'gif' | 'video' } | null>(null);
  const [showGif, setShowGif] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // режим «дискус»: id корневого сообщения треда (дополняем его)
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [threadParts, setThreadParts] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const openComposer = useCallback(() => {
    setText('');
    setMedia(null);
    setThreadRootId(null);
    setThreadParts(0);
    setError(null);
    setOpen(true);
  }, []);

  const close = () => { setOpen(false); setThreadRootId(null); setThreadParts(0); };

  const send = async (opts?: { continueThread?: boolean }) => {
    const content = text.trim();
    if (!content && !media) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ message: { id: string } }>('/api/messages', {
        content,
        mediaUrl: media?.url || null,
        mediaType: media?.type || null,
        parentMessageId: threadRootId || null,
      });
      // первый пост треда: запоминаем корень, открываем режим дополнения
      if (!threadRootId && opts?.continueThread) {
        setThreadRootId(res.message.id);
        setThreadParts(1);
        setText('');
        setMedia(null);
      } else if (threadRootId) {
        // дополнение треда: остаёмся в модалке, считаем части
        setThreadParts((n) => n + 1);
        setText('');
        setMedia(null);
      } else {
        close();
      }
      void refresh();
    } catch (e: any) {
      setError(e?.code === 'world_dead' ? 'Мир мёртв. Дождись нового сезона.' : (e?.message || 'Не получилось отправить'));
    }
    setBusy(false);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type === 'video/mp4' || f.type === 'video/webm';
    if (!isImage && !isVideo) { setError('Нужна картинка (PNG/JPEG/WebP/GIF/HEIC) или видео (MP4/WebM)'); return; }
    const form = new FormData();
    form.append('file', f);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setMedia({ url: res.url, type: res.mediaType });
    } catch (e: any) { setError(e?.message || 'Файл не загрузился'); }
  };

  const isLong = text.trim().length > 200;

  return (
    <Ctx.Provider value={{ openComposer }}>
      {children}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[300] bg-black/70 flex items-end sm:items-center justify-center"
          onClick={close}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-rip-panel border border-rip-line rounded-t-2xl sm:rounded-2xl p-5 pb-8"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="rip-serif text-sm tracking-wider text-rip-bone">
                {threadRootId ? `ДИСКУС · ${threadParts + 1} ЧАСТЬ` : 'НОВЫЙ ПОСТ'}
              </h3>
              <button onClick={close} className="text-rip-dim hover:text-rip-text">✕</button>
            </div>

            {threadRootId && (
              <p className="mb-2 text-[10px] text-rip-dim border border-rip-rust/40 rounded px-2 py-1.5">
                ⚰️ Тред начат — каждое следующее сообщение продолжает его. <button className="text-rip-rust underline" onClick={close}>опубликовать тред</button>
              </p>
            )}

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={threadRootId ? 'Продолжение треда...' : 'Что хочешь сказать миру? Оно умрёт.'}
              rows={4}
              autoFocus
              className="w-full bg-rip-bg border border-rip-line rounded-lg px-3 py-2.5 text-sm outline-none focus:border-rip-rust resize-none"
            />
            <p className={`text-right text-[10px] mt-1 font-mono ${text.length > 200 ? 'text-rip-rust' : 'text-rip-faint'}`}>
              {text.length}/200 {isLong && '· длинный пост'}
            </p>

            {media && (
              <div className="relative mt-2 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={media.url} alt="" className="h-24 rounded border border-rip-line" />
                <button className="absolute -top-1.5 -right-1.5 bg-rip-blood text-white rounded-full w-5 h-5 text-xs" onClick={() => setMedia(null)}>✕</button>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3">
              <button onClick={() => fileRef.current?.click()} className="text-rip-dim hover:text-rip-text text-lg" title="Фото">🖼</button>
              <button onClick={() => setShowGif(!showGif)} className="text-rip-dim hover:text-rip-text text-lg" title="Гифка">🎞</button>
              <input ref={fileRef} type="file" accept="image/*,.heic,.heif,video/mp4,video/webm" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
              <div className="flex-1" />
              {isLong && !threadRootId && (
                <button
                  onClick={() => void send({ continueThread: true })}
                  disabled={busy}
                  className="px-3 py-2 border border-rip-rust/50 text-rip-rust rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  ⚰️ дискус
                </button>
              )}
              <button
                onClick={() => void send(threadRootId ? { continueThread: true } : undefined)}
                disabled={busy || (!text.trim() && !media)}
                className="px-4 py-2 bg-rip-text text-rip-bg rounded-lg text-sm font-bold disabled:opacity-40"
              >
                {busy ? '...' : threadRootId ? 'дополнить ↓' : 'опубликовать'}
              </button>
            </div>

            {showGif && <GifPicker onPick={(url) => { onGifPick(url); setShowGif(false); }} onClose={() => setShowGif(false)} />}
            {error && <p className="mt-2 text-xs text-rip-blood">⚠️ {error}</p>}
          </motion.div>
        </motion.div>
      )}
    </Ctx.Provider>
  );

  function onGifPick(url: string) {
    setMedia({ url, type: 'gif' });
  }
}
