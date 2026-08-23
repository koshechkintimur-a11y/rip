'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';

type Me = { user: { id: string; email: string; username: string; display_name?: string } };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-rip-dim">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-rip-dim/70 mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = 'mt-1 w-full bg-rip-panel border border-rip-line rounded px-3 py-2 text-sm outline-none focus:border-rip-text/50';

export default function SettingsPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me['user'] | null>(null);
  const [username, setUsername] = useState('');
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
  const [curPassword, setCurPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const d = await apiGet<Me>('/api/auth/me');
        setMe(d.user);
        setUsername(d.user.username);
        setEmail(d.user.email);
      } catch { router.push('/login'); }
    })();
  }, [router]);

  // live-проверка занятости username
  useEffect(() => {
    if (!username || username === me?.username) { setUsernameTaken(null); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setUsernameTaken(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`).then((r) => r.json());
        setUsernameTaken(r.taken);
      } catch { setUsernameTaken(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [username, me]);

  // live-проверка занятости email
  useEffect(() => {
    if (!email || email === me?.email) { setEmailTaken(null); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setEmailTaken(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`).then((r) => r.json());
        setEmailTaken(r.taken);
      } catch { setEmailTaken(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [email, me]);

  const saveProfile = async () => {
    setBusy(true); setMsg(null);
    try {
      if (usernameTaken || emailTaken) throw new Error('Ник или email уже занят');
      const res = await fetch('/api/auth/update-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ошибка');
      setMsg({ ok: true, text: 'Сохранено' });
      setMe((m) => (m ? { ...m, username, email } : m));
      setUsernameTaken(null); setEmailTaken(null);
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Ошибка' });
    }
    setBusy(false);
  };

  const changePassword = async () => {
    setBusy(true); setMsg(null);
    try {
      if (newPassword.length < 6) throw new Error('Пароль минимум 6 символов');
      if (newPassword !== confirmPassword) throw new Error('Пароли не совпадают');
      const res = await fetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: curPassword, newPassword }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ошибка');
      setMsg({ ok: true, text: 'Пароль изменён' });
      setCurPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || 'Ошибка' });
    }
    setBusy(false);
  };

  if (!me) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем…</div>;

  return (
    <div className="max-w-md mx-auto px-4 py-4">
      <button onClick={() => router.back()} className="text-xs text-rip-dim hover:text-rip-text">← назад</button>
      <h1 className="text-xl font-bold mt-2 mb-5">Настройки</h1>

      {msg && <p className={`mb-3 text-sm ${msg.ok ? 'text-rip-green' : 'text-rip-blood'}`}>{msg.text}</p>}

      <div className="space-y-5">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-rip-dim">Профиль</h2>
          <Field label="Никнейм (@username)" hint={usernameTaken ? <span className="text-rip-blood">Этот ник занят</span> : username && username !== me.username && /^[a-z0-9_]+$/.test(username) && usernameTaken === false ? <span className="text-rip-green">Ник свободен</span> : 'Только a-z, 0-9, _ · минимум 3 символа'}>
            <input className={inputCls} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={20} />
          </Field>
          <Field label="Email" hint={emailTaken ? <span className="text-rip-blood">Этот email занят</span> : email && email !== me.email && emailTaken === false ? <span className="text-rip-green">Email свободен</span> : 'На него приходят уведомления и сброс пароля'}>
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </Field>
          <button
            onClick={() => void saveProfile()}
            disabled={busy || usernameTaken === true || emailTaken === true}
            className="px-4 py-2 bg-rip-text text-rip-bg rounded text-sm font-semibold disabled:opacity-40"
          >
            Сохранить
          </button>
        </section>

        <section className="space-y-3 border-t border-rip-line pt-4">
          <h2 className="text-sm font-semibold text-rip-dim">Пароль</h2>
          <Field label="Текущий пароль">
            <input className={inputCls} value={curPassword} onChange={(e) => setCurPassword(e.target.value)} type="password" autoComplete="current-password" />
          </Field>
          <Field label="Новый пароль">
            <input className={inputCls} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" autoComplete="new-password" />
          </Field>
          <Field label="Повторите новый пароль" hint={newPassword && confirmPassword && newPassword !== confirmPassword ? <span className="text-rip-blood">Пароли не совпадают</span> : undefined}>
            <input className={inputCls} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" autoComplete="new-password" />
          </Field>
          <button
            onClick={() => void changePassword()}
            disabled={busy}
            className="px-4 py-2 bg-rip-text text-rip-bg rounded text-sm font-semibold disabled:opacity-40"
          >
            Сменить пароль
          </button>
        </section>

        <section className="border-t border-rip-line pt-4">
          <p className="text-xs text-rip-dim mb-2">Забыл пароль? Выйди и нажми «Забыли пароль?» на экране входа — пришлём ссылку на почту.</p>
        </section>
      </div>
    </div>
  );
}
