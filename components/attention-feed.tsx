'use client';

import type { DbAttentionSlot } from '@/lib/types';

/**
 * Лента внимания: карточки-крики, движущиеся справа налево.
 * Клик по карточке с message_id → onOpenMessage(id) — родитель открывает
 * MessageModal с полной веткой (тот же MessageThread, что у /message/[id]).
 *
 * Дублирование: массив дублируется [...slots, ...slots] ТОЛЬКО для бесшовного
 * цикла marquee (translateX -50%). При 1-2 слотах дубль виден как «два
 * одинаковых поста» — поэтому цикл включается только от 3 слотов, иначе
 * карточки рендерятся один раз (без анимации-петли).
 */
export function AttentionFeed({ slots, onOpenMessage }: {
  slots: DbAttentionSlot[];
  onOpenMessage: (messageId: string) => void;
}) {
  if (slots.length === 0) return null;

  // бесшовный цикл требует 2 копии; при <3 слотах дубль выглядит как баг — не циклируем
  const canLoop = slots.length >= 3;
  const items = canLoop ? [...slots, ...slots] : slots;

  return (
    <div className="relative overflow-hidden">
      <div className={`flex gap-2 w-max py-3 px-1 ${canLoop ? 'animate-marquee' : ''}`}>
        {items.map((s, i) => (
          <button
            key={`${s.id}-${i}`}
            onClick={() => { if (s.message_id) onOpenMessage(s.message_id); }}
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
