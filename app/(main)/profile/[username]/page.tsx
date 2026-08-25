'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { formatDate, plural } from '@/lib/phases';

type OtherProfile = {
  profile: { id: string; username: string; display_name: string | null; avatar_url: string | null; bio: string | null; created_at: string };
  stats: { total: number; alive: number; dead: number; legendary: number; branches: number; in_branches: number };
  survived: Array<{ id: string; content: string; media_url?: string | null; status: string; survival_count: number; created_at: string }>;
  dead: Array<{ id: string; content: string; media_url?: string | null; status: string; survival_count: number; created_at: string }>;
  myBranches: Array<{ id: string; content: string; created_at: string; reply_count: number }>;
};

/** Чужой профиль: история пользователя + кнопка «написать». */
export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const router = useRouter();
  const [data, setData] = useState<OtherProfile | null>(null);
  const [tab, setTab] = useState<'alive' | 'dead'>('alive');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = await apiGet<OtherProfile>(`/api/profile/${encodeURIComponent(username)}`);
        setData(d);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [username]);

  const dm = async () => {
    try {
      // только создаём/находим диалог — НЕ отправляем сообщение автоматически
      const res = await apiPost<{ conversationId: string }>('/api/dm', {
        recipientId: data!.profile.id,
      });
      router.push(`/dm/${res.conversationId}`);
    } catch { /* тихо */ }
  };

  if (error) return <div className="p-4 text-sm text-rip-warn">⚠️ {error}</div>;
  if (!data) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем…</div>;

  const { profile, stats } = data;

  return (
    <div>
      <button onClick={() => router.back()} className="px-4 pt-3 pb-1 text-xs text-rip-dim hover:text-rip-text">← назад</button>

      <div className="px-4 pt-2 pb-3 border-b border-rip-line">
        <div className="flex items-center gap-3">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt="" className="w-12 h-12 rounded-full border border-rip-line object-cover" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-rip-panel border border-rip-line flex items-center justify-center text-xl">
              {profile.username[0]?.toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{profile.display_name || profile.username}</h1>
            <p className="text-xs text-rip-dim">@{profile.username} · с {formatDate(profile.created_at)}</p>
          </div>
          <button onClick={() => void dm()} className="border border-rip-text/40 text-rip-text rounded px-3 py-1.5 text-xs hover:bg-rip-text hover:text-black transition-colors">
            ✉ написать
          </button>
        </div>
        {profile.bio && <p className="mt-2 text-sm text-rip-text/90">{profile.bio}</p>}
      </div>

      {/* статистика */}
      <div className="grid grid-cols-4 divide-x divide-rip-line/50 border-b border-rip-line py-3 text-center">
        <div className="px-2"><div className="text-lg font-bold">{stats.total}</div><div className="text-[10px] text-rip-dim">всего</div></div>
        <div className="px-2"><div className="text-lg font-bold text-rip-rust">{stats.alive}</div><div className="text-[10px] text-rip-dim">выжило</div></div>
        <div className="px-2"><div className="text-lg font-bold text-rip-dim">{stats.dead}</div><div className="text-[10px] text-rip-dim">погибло</div></div>
        <div className="px-2"><div className="text-lg font-bold text-rip-gold">{stats.legendary}</div><div className="text-[10px] text-rip-dim">легенд</div></div>
      </div>

      {/* ветки */}
      {data.myBranches.length > 0 && (
        <div className="border-b border-rip-line/50 px-4 py-2">
          <p className="text-[10px] tracking-wider text-rip-dim mb-1">↳ ВЕТКИ {stats.branches}</p>
          {data.myBranches.slice(0, 5).map((b) => (
            <div key={b.id} className="py-1 cursor-pointer hover:text-rip-text" onClick={() => router.push(`/message/${b.id}`)}>
              <p className="text-sm truncate">{b.content}</p>
              <p className="text-[10px] text-rip-dim">↳ {b.reply_count} {plural(b.reply_count, ['ответ', 'ответа', 'ответов'])}</p>
            </div>
          ))}
        </div>
      )}

      {/* архив */}
      <div className="flex border-b border-rip-line text-[11px]">
        {([['alive', '🟢 Выжившие'], ['dead', '💀 Погибшие']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex-1 py-2.5 tracking-wider ${tab === k ? 'text-rip-text border-b-2 border-rip-text' : 'text-rip-dim'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="px-4 py-2">
        {(tab === 'alive' ? data.survived : data.dead).map((m) => (
          <div key={m.id} className="border-b border-rip-line/40 py-2.5 cursor-pointer hover:bg-rip-panel/30" onClick={() => router.push(`/message/${m.id}`)}>
            <div className="text-[11px] text-rip-dim">
              {formatDate(m.created_at)}
              {m.status === 'legendary' && <span className="text-rip-gold ml-2">⭐ {m.survival_count}</span>}
            </div>
            {m.content && <p className={`text-sm mt-0.5 ${m.status === 'dead' ? 'line-through decoration-rip-dim/40 text-rip-dim' : ''}`}>{m.content}</p>}
            {m.media_url && (
              <div className="mt-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.media_url} alt="" className="max-h-32 rounded-md border border-rip-line" loading="lazy" />
              </div>
            )}
          </div>
        ))}
        {tab === 'alive' && data.survived.length === 0 && <p className="py-8 text-center text-xs text-rip-dim">Ничего не выжило… пока.</p>}
        {tab === 'dead' && data.dead.length === 0 && <p className="py-8 text-center text-xs text-rip-dim">Пока ничего не умерло.</p>}
      </div>
    </div>
  );
}
