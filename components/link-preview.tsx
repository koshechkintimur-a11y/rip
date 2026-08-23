'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';

type LinkData = { url: string; title: string | null; description: string | null; image: string | null; hostname: string };

const URL_RE = /https?:\/\/[^\s<>"']+/i;

/** Извлекает первую ссылку из текста сообщения. */
export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  return m ? m[0].replace(/[),.!?;:]+$/, '') : null;
}

/** Карточка-превью ссылки (OpenGraph), рендерится под текстом сообщения. */
export function LinkPreview({ text }: { text: string }) {
  const url = extractUrl(text);
  const [data, setData] = useState<LinkData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setFailed(false);
    setData(null);
    apiGet<LinkData>(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((d) => { if (alive && d.title) setData(d); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [url]);

  if (!url || failed) return null;
  if (!data) {
    return <div className="mt-1.5 h-20 rounded-md border border-rip-line bg-rip-panel/40 animate-pulse" />;
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="mt-1.5 flex rounded-md border border-rip-line bg-rip-panel/50 overflow-hidden hover:border-rip-warn/60 transition-colors max-w-full"
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="w-20 h-20 object-cover shrink-0" loading="lazy" />
      )}
      <div className="py-1.5 px-2.5 min-w-0">
        <p className="text-[11px] text-rip-dim truncate">{data.hostname}</p>
        {data.title && <p className="text-[13px] font-semibold leading-tight line-clamp-2 break-words">{data.title}</p>}
        {data.description && <p className="text-[11px] text-rip-dim leading-snug line-clamp-2 mt-0.5">{data.description}</p>}
      </div>
    </a>
  );
}
