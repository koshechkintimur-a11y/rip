'use client';

import { useRouter } from 'next/navigation';
import type { DbAttentionSlot } from '@/lib/types';

/** Лента внимания: карточки-крики, плавно движущиеся справа налево. Клик по карточке → ветка сообщения. */
export function AttentionFeed({ slots }: { slots: DbAttentionSlot[] }) {
  const router = useRouter();
  if (slots.length === 0) return null;

  // дублируем для бесшовного цикла (translateX -50%)
  const doubled = [...slots, ...slots];

  const open = (s: DbAttentionSlot) => {
    if (s.message_id) router.push(`/message/${s.message_id}`);
  };

  return (
    <div className="relative overflow-hidden">
      <div className="flex gap-2 w-max animate-marquee py-3 px-1">
        {doubled.map((s, i) => (
          <button
            key={`${s.id}-${i}`}
            onClick={() => open(s)}
            className={`shrink-0 w-52 bg-rip-panel border border-rip-warn/30 rounded-xl overflow-hidden flex flex-col text-left ${s.message_id ? 'cursor-pointer active:scale-[0.98] transition-transform' : 'cursor-default'}`}
          >
            {s.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.media_url}
                alt=""
                className="w-full h-24 object-cover border-b border-rip-line"
                loading="lazy"
              />
            )}
            <div className="p-2.5 flex flex-col gap-1 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-rip-warn text-xs leading-none">⚡</span>
                <span className="text-[11px] text-rip-dim truncate">@{s.username || '?'}</span>
              </div>
              <p className="text-[13px] leading-snug text-rip-text break-words line-clamp-3">{s.content}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-rip-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-rip-bg to-transparent" />
    </div>
  );
}
