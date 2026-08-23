'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { apiGet } from '@/lib/api';

type GifResult = { url: string; preview: string; title: string };

/** Модалка поиска GIF (Tenor) + вставка URL вручную. */
export function GifPicker({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');

  const search = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const d = await apiGet<{ gifs: GifResult[] }>(`/api/gif/search?q=${encodeURIComponent(q.trim())}`);
      setGifs(d.gifs || []);
      if (d.gifs.length === 0) setError('Ничего не нашлось. Попробуй другой запрос или вставь URL.');
    } catch (e: any) {
      setError(e.message || 'Не удалось найти');
    }
    setBusy(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-rip-panel border border-rip-line rounded-t-2xl sm:rounded-2xl p-4 pb-8 max-h-[80dvh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">GIF</h3>
          <button onClick={onClose} className="text-rip-dim hover:text-rip-text">✕</button>
        </div>

        <div className="flex gap-2 mb-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void search(); }}
            placeholder="Поиск гифок..."
            className="flex-1 bg-rip-bg border border-rip-line rounded-lg px-3 py-2 text-sm outline-none focus:border-rip-warn"
          />
          <button
            onClick={() => void search()}
            disabled={busy}
            className="px-4 py-2 bg-rip-text text-rip-bg rounded-lg text-sm font-bold disabled:opacity-40"
          >
            {busy ? '...' : 'Найти'}
          </button>
        </div>

        {error && <p className="text-xs text-rip-warn mb-2">⚠️ {error}</p>}

        {/* сетка гифок */}
        <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-1.5 mb-2">
          {gifs.map((g, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={g.preview}
              alt={g.title || 'gif'}
              className="w-full aspect-video object-cover rounded border border-rip-line cursor-pointer hover:border-rip-warn"
              loading="lazy"
              onClick={() => { onPick(g.url); onClose(); }}
            />
          ))}
          {!busy && gifs.length === 0 && (
            <p className="col-span-3 py-6 text-center text-xs text-rip-dim">
              Вставь URL гифки ниже или найди.
              <br />
              <span className="text-[10px]">Для поиска нужен GIF_PROVIDER_KEY (Tenor, бесплатно)</span>
            </p>
          )}
        </div>

        {/* ручная вставка URL */}
        <div className="flex gap-2">
          <input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="или вставь URL гифки (https://...gif)"
            className="flex-1 bg-rip-bg border border-rip-line rounded-lg px-3 py-2 text-sm outline-none focus:border-rip-text"
          />
          <button
            onClick={() => { if (manualUrl.trim()) { onPick(manualUrl.trim()); onClose(); } }}
            className="px-4 py-2 border border-rip-line rounded-lg text-sm"
          >
            OK
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
