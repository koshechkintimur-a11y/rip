'use client';

import { useEffect, useState } from 'react';
import type { DbAttentionSlot } from '@/lib/types';
import { apiGet } from '@/lib/api';

/**
 * Лента внимания: ⚡ КРИК → 💀 → 🟡 ЭХО.
 * 💀 — голос за жизнь: 1 юзер = 1 черепок, свой крик не черепят.
 * Крик с ≥ порога черепков переживает волну и становится Эхом
 * (золотая карточка, «пережил N волн»). Эхо не бессмертно.
 */

function formatWave(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

export function AttentionFeed({ slots, onOpenMessage, nextWaveAt }: {
  slots: DbAttentionSlot[];
  onOpenMessage: (messageId: string) => void;
  nextWaveAt?: string | null;
}) {
  const [myId, setMyId] = useState<string | null>(null);
  const [localSlots, setLocalSlots] = useState<DbAttentionSlot[]>(slots);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { setLocalSlots(slots); }, [slots]);

  // мой id — чтобы скрывать кнопку черепка на своём крике
  useEffect(() => {
    void (async () => {
      try {
        const me = await apiGet<{ user: { id: string } | null }>('/api/auth/me');
        setMyId(me.user?.id ?? null);
      } catch { /* тихо */ }
    })();
  }, []);

  // тикаем таймер «до волны» раз в минуту
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  if (localSlots.length === 0) return null;

  const canLoop = localSlots.length >= 3;
  const items = canLoop ? [...localSlots, ...localSlots] : localSlots;

  const skull = async (slotId: string) => {
    try {
      const res = await fetch('/api/attention/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
      });
      const d = await res.json();
      if (!res.ok) return;
      // обновляем локально (toggle)
      setLocalSlots((prev) => prev.map((s) =>
        s.id === slotId
          ? { ...s, skull_count: d.skull_count, my_skull: d.active }
          : s
      ));
    } catch { /* тихо */ }
  };

  const waveIn = nextWaveAt ? Math.max(0, new Date(nextWaveAt).getTime() - now) : 0;

  return (
    <div className="relative overflow-hidden">
      <div className={`flex gap-2 w-max py-3 px-1 ${canLoop ? 'animate-marquee' : ''}`}>
        {items.map((s, i) => {
          const isEcho = s.status === 'echo';
          const isMine = myId !== null && s.user_id === myId;
          return (
            <button
              key={`${s.id}-${i}`}
              onClick={() => { if (s.message_id) onOpenMessage(s.message_id); }}
              className={`shrink-0 w-52 bg-rip-panel rounded-xl overflow-hidden flex flex-col text-left
                ${isEcho ? 'border border-rip-gold/50 shadow-[0_0_18px_rgba(217,180,92,0.12)]' : 'border border-rip-warn/30'}
                ${s.message_id ? 'cursor-pointer active:scale-[0.98] transition-transform' : 'cursor-default'}`}
            >
              {s.media_url && (s.media_type === 'video' || /\.(mp4|webm)(\?|$)/i.test(s.media_url)) ? (
                <video
                  src={s.media_url}
                  className="w-full h-24 object-cover border-b border-rip-line"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : s.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.media_url}
                  alt=""
                  className="w-full h-24 object-cover border-b border-rip-line"
                  loading="lazy"
                />
              ) : null}
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs leading-none ${isEcho ? 'text-rip-gold' : 'text-rip-warn'}`}>{isEcho ? '🟡' : '⚡'}</span>
                    <span className="text-[11px] text-rip-dim truncate">@{s.username || '?'}</span>
                  </div>
                  {isEcho && (
                    <span className="text-[9px] text-rip-gold tracking-wider whitespace-nowrap">
                      {s.waves_survived} {s.waves_survived === 1 ? 'ВОЛНА' : s.waves_survived < 5 ? 'ВОЛНЫ' : 'ВОЛН'}
                    </span>
                  )}
                </div>

                <p className={`text-[13px] leading-snug break-words line-clamp-2 ${isEcho ? 'text-rip-bone' : 'text-rip-text'}`}>{s.content}</p>

                <div className="mt-auto flex items-center justify-between pt-1">
                  <span className={`font-mono text-[11px] ${isEcho ? 'text-rip-gold' : 'text-rip-warn'}`}>
                    {isEcho ? '🟡 ЭХО' : '⚡ КРИК'}
                  </span>
                  <div className="flex items-center gap-2">
                    {!isEcho && (
                      <span className="text-[10px] text-rip-faint font-mono">
                        волна {formatWave(waveIn)}
                      </span>
                    )}
                    <span className={`text-[12px] font-mono font-bold ${s.my_skull ? 'text-rip-warn' : 'text-rip-gold'}`}>
                      💀 {s.skull_count}
                    </span>
                    {!isMine && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); void skull(s.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); void skull(s.id); } }}
                        className={`text-[13px] leading-none px-1 rounded transition-colors select-none
                          ${s.my_skull ? 'text-rip-warn' : 'text-rip-dim hover:text-rip-warn'}`}
                        title="💀 = голос за жизнь крика"
                      >
                        💀
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-rip-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-rip-bg to-transparent" />
    </div>
  );
}
