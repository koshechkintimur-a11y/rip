'use client';

import { useState, useRef } from 'react';
import { useWorld } from '@/components/world-provider';
import { apiPost } from '@/lib/api';
import { GifPicker } from '@/components/gif-picker';

/** Композер: текст + картинка + GIF + видео. */
export function Composer({ onPosted }: { onPosted?: () => void }) {
  const { refresh } = useWorld();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'gif' | 'video' } | null>(null);
  const [showGif, setShowGif] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const post = async () => {
    const content = text.trim();
    if (!content && !media) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost('/api/messages', {
        content,
        mediaUrl: media?.url || null,
        mediaType: media?.type || null,
      });
      setText('');
      setMedia(null);
      void refresh();
      onPosted?.();
    } catch (e: any) {
      if (e?.code === 'world_dead') {
        setError('Мир мёртв. Дождись нового сезона.');
      } else {
        setError(e?.message || 'Не получилось отправить');
      }
    }
    setBusy(false);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const isImage = f.type.startsWith('image/');
    const isVideo = f.type === 'video/mp4' || f.type === 'video/webm';
    if (!isImage && !isVideo) {
      setError('Нужна картинка (PNG/JPEG/WebP/GIF/HEIC) или видео (MP4/WebM)');
      return;
    }
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

  const onGif = (url: string) => {
    setMedia({ url, type: 'gif' });
  };

  return (
    <div className="border-b border-rip-line bg-rip-bg px-3 py-2">
      {media && (
        <div className="relative mb-2 inline-block">
          {media.type === 'video' ? (
            <video src={media.url} controls playsInline className="h-20 rounded border border-rip-line" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt="" className="h-20 rounded border border-rip-line" />
          )}
          <button
            className="absolute -top-1.5 -right-1.5 bg-rip-blood text-white rounded-full w-5 h-5 text-xs leading-none"
            onClick={() => setMedia(null)}
          >
            ✕
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void post(); } }}
          placeholder="Написать сообщение..."
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none text-[15px] py-1 placeholder:text-rip-dim/50"
          maxLength={500}
        />
        <div className="flex items-center gap-1 shrink-0">
          <button className="px-1.5 py-1 text-rip-dim hover:text-rip-text" title="Картинка" onClick={() => fileRef.current?.click()}>
            🖼
          </button>
          <button className="px-1.5 py-1 text-rip-dim hover:text-rip-text" title="GIF" onClick={() => setShowGif(true)}>
            GIF
          </button>
          <button
            onClick={() => void post()}
            disabled={busy}
            className="px-3 py-1.5 bg-rip-text text-rip-bg rounded text-sm font-bold disabled:opacity-40"
          >
            →
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*,.heic,.heif,video/mp4,video/webm" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {error && <p className="mt-1 text-xs text-rip-blood">⚠️ {error}</p>}
      {showGif && <GifPicker onPick={onGif} onClose={() => setShowGif(false)} />}
    </div>
  );
}
