'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet } from '@/lib/api';
import { plural } from '@/lib/phases';

type Season = {
  id: string;
  number: number;
  status: 'active' | 'ended';
  started_at: string;
  ends_at: string | null;
  last_reset_at: string | null;
  total_messages: number;
  alive_messages: number;
  dead_messages: number;
  legendary_messages: number;
  reacted_messages: number;
};

/** История сезонов: статистика каждого (выжившие/погибшие/легендарные). */
export default function SeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const d = await apiGet<{ seasons: Season[] }>('/api/seasons');
        setSeasons(d.seasons || []);
      } catch { /* тихо */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <button onClick={() => router.push('/feed')} className="px-4 pt-3 pb-1 text-xs text-rip-dim hover:text-rip-text">
        ← чат
      </button>
      <h1 className="px-4 pt-1 pb-2 text-sm font-bold tracking-wider">🗓 ИСТОРИЯ СЕЗОНОВ</h1>

      {loading && <p className="px-4 text-sm text-rip-dim animate-pulse">загружаем…</p>}

      {!loading && seasons.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-rip-dim">Сезонов пока не было.</p>
      )}

      <div>
        {seasons.map((s) => {
          const isActive = s.status === 'active';
          const died = s.total_messages - s.alive_messages;
          return (
            <div key={s.id} className="px-4 py-3 border-b border-rip-line/50">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">СЕЗОН #{s.number}</span>
                {isActive ? (
                  <span className="text-[10px] text-rip-green border border-rip-green/40 rounded px-1.5 py-0.5">ЖИВОЙ</span>
                ) : (
                  <span className="text-[10px] text-rip-dim border border-rip-line rounded px-1.5 py-0.5">☠ ЗАВЕРШЁН</span>
                )}
              </div>
              <div className="mt-1.5 text-[11px] text-rip-dim">
                {new Date(s.started_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                {s.ends_at && ` → ${new Date(s.ends_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div className="bg-rip-panel/40 rounded-md py-2">
                  <div className="text-sm font-bold text-rip-green">{s.alive_messages}</div>
                  <div className="text-[9px] text-rip-dim">выжило</div>
                </div>
                <div className="bg-rip-panel/40 rounded-md py-2">
                  <div className="text-sm font-bold text-rip-blood">{Math.max(died, 0)}</div>
                  <div className="text-[9px] text-rip-dim">погибло</div>
                </div>
                <div className="bg-rip-panel/40 rounded-md py-2">
                  <div className="text-sm font-bold text-rip-gold">⭐ {s.legendary_messages}</div>
                  <div className="text-[9px] text-rip-dim">легендарных</div>
                </div>
              </div>
              {s.reacted_messages > 0 && (
                <div className="mt-1.5 text-[10px] text-rip-dim">
                  💀 {s.reacted_messages} {plural(s.reacted_messages, ['сообщение', 'сообщения', 'сообщений'])} с реакциями · {s.total_messages} всего
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
