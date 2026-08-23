'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiPost } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'login') {
        await apiPost('/api/auth/login', { email, password });
      } else {
        if (!username.trim()) throw new Error('Нужен ник');
        await apiPost('/api/auth/signup', { email, password, username: username.trim() });
      }
      router.push('/feed');
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    }
    setBusy(false);
  };

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
        {tab === 'signup' && (
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Никнейм (a-z, 0-9, _)"
            className="w-full bg-rip-panel border border-rip-line rounded-lg px-4 py-3 text-sm outline-none focus:border-rip-text transition-colors"
            maxLength={20}
          />
        )}
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full bg-rip-panel border border-rip-line rounded-lg px-4 py-3 text-sm outline-none focus:border-rip-text transition-colors"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль (мин. 6 символов)"
          type="password"
          className="w-full bg-rip-panel border border-rip-line rounded-lg px-4 py-3 text-sm outline-none focus:border-rip-text transition-colors"
        />
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="w-full bg-rip-text text-rip-bg rounded-lg py-3 text-sm font-bold disabled:opacity-40"
        >
          {busy ? '...' : tab === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
        {error && <p className="text-rip-blood text-xs text-center">⚠️ {error}</p>}
      </div>
    </div>
  );
}