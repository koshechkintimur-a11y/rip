'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { plural, formatDate } from '@/lib/phases';

type MyProfile = {
  user: { username: string; email: string; display_name: string | null; bio: string | null; avatar_url: string | null; is_test_user: boolean };
  wallet: { balance: number };
  stats: { total: number; alive: number; dead: number; legendary: number; branches: number; in_branches: number };
  messages: Array<{ id: string; content: string; status: string; survival_count: number; created_at: string; died_at: string | null }>;
  saved: Array<{ message_id: string; content: string; label: string }>;
};

/** Мой профиль: статистика жизни в RIP + архивы + настройки. */
export default function MyProfilePage() {
  const router = useRouter();
  const { refresh } = useWorld();
  const [data, setData] = useState<MyProfile | null>(null);
  const [tab, setTab] = useState<'survived' | 'dead' | 'saved'>('survived');
  const [edit, setEdit] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const d = await apiGet<MyProfile>('/api/me');
      setData(d);
      setDisplayName(d.user.display_name || '');
      setBio(d.user.bio || '');
      setAvatarUrl(d.user.avatar_url || null);
    })();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await apiPatch('/api/profile', { displayName: displayName || null, bio: bio || null, avatarUrl });
      setEdit(false);
      refresh();
    } catch { /* тихо */ }
    setSaving(false);
  };

  const onAvatarFile = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ошибка загрузки');
      setAvatarUrl(d.url);
    } catch (e: any) {
      alert(e.message || 'Не удалось загрузить аватар');
    }
    setUploading(false);
  };

  const logout = async () => {
    await apiPost('/api/auth/logout');
    router.push('/login');
    router.refresh();
  };

  if (!data) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем…</div>;

  const { user, stats } = data;

  return (
    <div>
      {/* ШАПКА */}
      <div className="px-4 pt-4 pb-3 border-b border-rip-line">
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative w-14 h-14 rounded-full bg-rip-panel border border-rip-line overflow-hidden flex items-center justify-center text-xl hover:border-rip-warn transition-colors shrink-0"
            title={avatarUrl ? 'Сменить аватар' : 'Загрузить аватар'}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              user.username[0]?.toUpperCase()
            )}
            {uploading && <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-[10px]">…</span>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void onAvatarFile(e.target.files?.[0])} />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{user.display_name || user.username}</h1>
            <p className="text-xs text-rip-dim">@{user.username}</p>
          </div>
          <button onClick={() => setEdit(!edit)} className="text-xs text-rip-dim border border-rip-line rounded px-2 py-1 hover:text-rip-text">
            ⚙
          </button>
        </div>
        {user.bio && <p className="mt-2 text-sm text-rip-text/90">{user.bio}</p>}

        {edit && (
          <div className="mt-3 space-y-2 border border-rip-line rounded-lg p-3 bg-rip-panel/40">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Имя"
              maxLength={40}
              className="w-full bg-rip-bg border border-rip-line rounded px-3 py-2 text-sm outline-none"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="О себе"
              maxLength={200}
              rows={2}
              className="w-full bg-rip-bg border border-rip-line rounded px-3 py-2 text-sm outline-none resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => void saveProfile()} disabled={saving} className="px-3 py-1.5 bg-rip-text text-rip-bg rounded text-xs font-bold">
                Сохранить
              </button>
              <button onClick={() => setEdit(false)} className="px-3 py-1.5 border border-rip-line rounded text-xs text-rip-dim">Отмена</button>
            </div>
          </div>
        )}

        {user.is_test_user && (
          <button onClick={() => router.push('/admin')} className="mt-2 text-[10px] text-rip-dim/60 hover:text-rip-warn">
            [ test panel ]
          </button>
        )}
      </div>

      {/* СТАТИСТИКА */}
      <div className="grid grid-cols-4 divide-x divide-rip-line/50 border-b border-rip-line py-3 text-center">
        <Stat label="всего" value={stats.total} />
        <Stat label="выжило" value={stats.alive} tone="text-rip-green" />
        <Stat label="погибло" value={stats.dead} tone="text-rip-dim" />
        <Stat label="легенд" value={stats.legendary} tone="text-rip-gold" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-rip-line/50 border-b border-rip-line py-2 text-center text-[11px] text-rip-dim">
        <div>↳ веток: <b className="text-rip-text">{stats.branches}</b></div>
        <div>💬 в обсуждениях: <b className="text-rip-text">{stats.in_branches}</b></div>
      </div>

      {/* ТАБЫ */}
      <div className="flex border-b border-rip-line text-[11px]">
        {([
          ['survived', '🟢 Выжившие'],
          ['dead', '💀 Погибшие'],
          ['saved', '⭐ Архив'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 tracking-wider ${tab === key ? 'text-rip-text border-b-2 border-rip-text' : 'text-rip-dim'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* СПИСОК */}
      <div className="px-4 py-2">
        {tab === 'saved' && data.saved.length === 0 && <Empty text="Ничего не сохранено. В конце сезона можно забрать до 3 сообщений." />}
        {tab === 'survived' && data.messages.filter((m) => m.status !== 'dead').length === 0 && <Empty text="Пока нет живых сообщений. Напиши что-нибудь в ленту." />}
        {tab === 'dead' && data.messages.filter((m) => m.status === 'dead').length === 0 && <Empty text="Пока ничего не умерло. Всё впереди." />}

        {tab === 'saved' && data.saved.map((s) => (
          <div key={s.message_id} className="border-b border-rip-line/40 py-2.5">
            <p className="text-[10px] text-rip-gold">{s.label}</p>
            <p className="text-sm mt-0.5">{s.content}</p>
          </div>
        ))}

        {tab !== 'saved' && data.messages
          .filter((m) => (tab === 'dead' ? m.status === 'dead' : m.status !== 'dead'))
          .map((m) => (
            <div key={m.id} className="border-b border-rip-line/40 py-2.5 cursor-pointer hover:bg-rip-panel/30" onClick={() => router.push(`/message/${m.id}`)}>
              <div className="flex items-baseline gap-2 text-[11px] text-rip-dim">
                <span>{formatDate(m.created_at)}</span>
                {m.status === 'legendary' && <span className="text-rip-gold">⭐ {m.survival_count} выживаний</span>}
                {m.status === 'dead' && <span className="text-rip-dim/70">умерло {m.died_at ? formatDate(m.died_at) : ''}</span>}
                {m.status === 'active' && <span className="text-rip-green">живое</span>}
              </div>
              <p className={`text-sm mt-0.5 ${m.status === 'dead' ? 'line-through decoration-rip-dim/40 text-rip-dim' : ''}`}>{m.content}</p>
            </div>
          ))}
      </div>

      {/* БАЛАНС И ВЫХОД */}
      <div className="px-4 py-4 flex items-center justify-between border-t border-rip-line mt-4">
        <span className="text-xs text-rip-dim">💀 {data.wallet.balance} монет</span>
        <button onClick={() => void logout()} className="text-xs text-rip-blood/80 hover:text-rip-blood">выйти</button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="px-2">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[10px] text-rip-dim tracking-wider">{label}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-rip-dim">{text}</p>;
}
