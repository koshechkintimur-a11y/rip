'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // live-проверка занятости ника (регистрация)
  useEffect(() => {
    if (tab !== 'signup' || !username || username.length < 3) { setUsernameTaken(null); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { setUsernameTaken(null); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username.toLowerCase())}`).then((r) => r.json());
        setUsernameTaken(r.taken);
      } catch { setUsernameTaken(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [username, tab]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'login') {
        await apiPost('/api/auth/login', { email, password });
      } else {
        if (!username.trim()) throw new Error('Нужен ник');
        if (usernameTaken) throw new Error('Этот ник уже занят');
        if (password !== confirmPassword) throw new Error('Пароли не совпадают');
        await apiPost('/api/auth/signup', { email, password, confirmPassword, username: username.trim().toLowerCase() });
      }
      router.push('/feed');
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
    setBusy(false);
  };

  const inputCls = 'w-full bg-rip-panel border border-rip-line rounded-lg px-4 py-3 text-sm outline-none focus:border-rip-text transition-colors';

  return (
    <div className="min-h-dvh flex flex-col justify-center px-6 bg-rip-bg">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold tracking-tight text-rip-text">RIP</h1>
        <p className="text-rip-dim text-sm mt-2">социальная сеть, где всё умирает</p>
      </div>

      <div className="flex mb-6 bg-rip-panel rounded-lg p-1">
        <button
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${tab === 'login' ? 'bg-rip-text text-rip-bg' : 'text-rip-dim'}`}
          onClick={() => setTab('login')}
        >Войти</button>
        <button
          className={`flex-1 py-2 text-sm rounded-md transition-colors ${tab === 'signup' ? 'bg-rip-text text-rip-bg' : 'text-rip-dim'}`}
          onClick={() => setTab('signup')}
        >Регистрация</button>
      </div>

      <div className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className={inputCls}
        />
        {tab === 'signup' && (
          <>
            <div>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="Никнейм (a-z, 0-9, _)"
                className={inputCls}
                maxLength={20}
              />
              {usernameTaken === true && <p className="text-xs text-rip-blood mt-1">Этот ник уже занят</p>}
              {usernameTaken === false && username.length >= 3 && <p className="text-xs text-rip-green mt-1">Ник свободен ✓</p>}
            </div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль (мин. 6 символов)"
              type="password"
              className={inputCls}
            />
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              type="password"
              className={inputCls}
            />
            {confirmPassword && password !== confirmPassword && <p className="text-xs text-rip-blood">Пароли не совпадают</p>}
          </>
        )}
        {tab === 'login' && (
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль"
            type="password"
            className={inputCls}
          />
        )}
        {error && <p className="text-sm text-rip-blood">⚠️ {error}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="w-full py-3 bg-rip-text text-rip-bg rounded-lg text-sm font-bold disabled:opacity-40 transition-opacity"
        >
          {busy ? '…' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
      </div>

      {tab === 'login' && (
        <Link href="/forgot-password" className="block text-center mt-4 text-xs text-rip-dim hover:text-rip-text">
          Забыли пароль?
        </Link>
      )}
    </div>
  );
}
