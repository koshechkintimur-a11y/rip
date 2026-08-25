'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { plural, formatDate } from '@/lib/phases';
import { compressImage } from '@/lib/client-image';
import { MediaRenderer } from '@/components/media-renderer';

type MyProfile = {
  user: { username: string; email: string; display_name: string | null; bio: string | null; avatar_url: string | null; is_test_user: boolean };
  wallet: { balance: number };
  stats: { total: number; alive: number; dead: number; legendary: number; branches: number; in_branches: number; reactions: number };
  messages: Array<{ id: string; content: string; media_url: string | null; media_type: string | null; status: string; survival_count: number; created_at: string; died_at: string | null }>;
  saved: Array<{ message_id: string; content: string; label: string }>;
  season: { first_season: number | null; seasons_count: number };
  topPost: { content: string; survival_count: number } | null;
};

/** Мой профиль: статистика жизни в RIP + архивы + настройки. */
export default function MyProfilePage() {
  const router = useRouter();
  const { season, refresh } = useWorld();
  const [data, setData] = useState<MyProfile | null>(null);
  const [tab, setTab] = useState<'survived' | 'dead' | 'saved'>('survived');
  const [edit, setEdit] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
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
      const uploadFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      form.append('file', uploadFile);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ошибка загрузки');
      // сохраняем сразу в БД, чтобы не сбрасывалось при перезагрузке
      await apiPatch('/api/profile', { avatarUrl: d.url });
      setAvatarUrl(d.url);
      refresh();
    } catch (e: any) {
      // UI-003: без alert — инлайн-ошибка
      setAvatarError(e.message || 'Не удалось загрузить');
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
      {/* ШАПКА — 1-в-1 как в концепте: аватар, имя, tag, статистика, bio, кнопка */}
      <div className="px-4 pt-6 pb-5 border-b border-rip-line flex flex-col items-center text-center">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="relative w-[72px] h-[72px] rounded-full bg-rip-panel border border-rip-line overflow-hidden flex items-center justify-center text-[26px] hover:border-rip-rust transition-colors shrink-0"
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
        {avatarError && <p className="mt-2 text-[11px] text-rip-blood">⚠️ {avatarError}</p>}

        <h1 className="rip-serif text-lg mt-2.5 text-rip-bone leading-tight">{user.display_name || user.username}</h1>
        <p className="text-[10px] text-rip-faint mt-1 tracking-[0.1em]">
          @{user.username} · в мире с сезона #{data.season?.first_season ?? '?'} · {data.season?.seasons_count ?? 1} {plural(data.season?.seasons_count ?? 1, ['сезон', 'сезона', 'сезонов'])}
        </p>

        {/* статистика: ПОСТОВ / ЖИВЫ / ЛЕГЕНДА / ЧЕРЕПКОВ — как в концепте */}
        <div className="flex gap-[26px] mt-[18px] font-mono">
          <div className="text-center"><div className="text-[17px] text-rip-text leading-tight">{stats.total}</div><div className="text-[9px] text-rip-faint mt-[3px] tracking-[0.1em]">ПОСТОВ</div></div>
          <div className="text-center"><div className="text-[17px] text-rip-text leading-tight">{stats.alive}</div><div className="text-[9px] text-rip-faint mt-[3px] tracking-[0.1em]">ЖИВЫ</div></div>
          <div className="text-center"><div className="text-[17px] text-rip-gold leading-tight">{stats.legendary}</div><div className="text-[9px] text-rip-faint mt-[3px] tracking-[0.1em]">ЛЕГЕНДА</div></div>
          <div className="text-center"><div className="text-[17px] text-rip-text leading-tight">{stats.reactions.toLocaleString('ru-RU')}</div><div className="text-[9px] text-rip-faint mt-[3px] tracking-[0.1em]">ЧЕРЕПКОВ</div></div>
        </div>

        {user.bio && (
          <p className="text-xs text-rip-dim mt-[14px] leading-[1.5] max-w-[280px]">{user.bio}</p>
        )}

        <button onClick={() => setEdit(!edit)} className="mt-4 px-[26px] py-[10px] border border-rip-line rounded-md text-[10px] text-rip-dim hover:text-rip-rust hover:border-rip-rust/50 transition-colors tracking-wide">
          {edit ? 'закрыть' : 'настроить профиль'}
        </button>

        {edit && (
          <div className="mt-3 space-y-2 border border-rip-line rounded-lg p-3 bg-rip-panel/40 w-full max-w-[280px] text-left">
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

      {/* Легенда сезона — как в концепте (под шапкой) */}
      {data.topPost && (
        <p className="py-3 text-[10px] text-rip-faint italic text-center tracking-[0.06em] border-b border-rip-line">
          ⭐ Легенда сезона: твой пост «{data.topPost.content.slice(0, 40)}{data.topPost.content.length > 40 ? '…' : ''}» пережил {data.topPost.survival_count} {plural(data.topPost.survival_count, ['волну', 'волны', 'волн'])}.
        </p>
      )}

      {/* ТАБЫ */}
      <div className="flex border-b border-rip-line text-[11px]">
        {([['survived', 'ВЫЖИВШИЕ'], ['dead', 'ПОГИБШИЕ'], ['saved', 'АРХИВ']] as const).map(([key, label]) => (
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
                {m.status === 'active' && <span className="text-rip-rust">живое</span>}
              </div>
              <p className={`text-sm mt-0.5 ${m.status === 'dead' ? 'line-through decoration-rip-dim/40 text-rip-dim' : ''}`}>{m.content}</p>
              {/* фото/видео поста (фикс: раньше медиа не показывалось в профиле) */}
              {m.media_url && <MediaRenderer url={m.media_url} type={m.media_type} />}
            </div>
          ))}
      </div>

      {/* БАЛАНС, НАСТРОЙКИ И ВЫХОД */}
      <div className="px-4 py-4 flex items-center justify-between border-t border-rip-line mt-4">
        <span className="text-xs text-rip-dim">💀 {data.wallet.balance} монет</span>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-xs text-rip-dim hover:text-rip-text">настройки</Link>
          <button onClick={() => void logout()} className="text-xs text-rip-blood/80 hover:text-rip-blood">выйти</button>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-xs text-rip-dim">{text}</p>;
}
