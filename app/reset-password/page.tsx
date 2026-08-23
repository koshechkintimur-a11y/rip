'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ResetPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('code') || '';
    setCode(c);
  }, []);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (password.length < 6) throw new Error('Пароль минимум 6 символов');
      if (password !== confirm) throw new Error('Пароли не совпадают');
      if (!code) throw new Error('Нет кода сброса');
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Ошибка');
      setState('done');
    } catch (e: any) {
      setState('error');
      setError(e.message || 'Ошибка');
    }
    setBusy(false);
  };

  if (state === 'done') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6 bg-rip-bg">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-black mb-3">Пароль изменён ✅</h1>
          <button onClick={() => router.push('/login')} className="mt-4 px-6 py-2.5 bg-rip-text text-rip-bg rounded text-sm font-bold">
            Войти
          </button>
        </div>
      </div>
    );
  }

  const inputCls = 'w-full bg-rip-panel border border-rip-line rounded px-3 py-2.5 text-sm outline-none focus:border-rip-text/50';

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-rip-bg">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black mb-5">Новый пароль</h1>
        <div className="space-y-3">
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Новый пароль (мин. 6)" type="password" className={inputCls} />
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Повторите пароль" type="password" className={inputCls} />
          {confirm && password !== confirm && <p className="text-xs text-rip-blood">Пароли не совпадают</p>}
          {state === 'error' && <p className="text-xs text-rip-blood">⚠️ {error}</p>}
          <button onClick={() => void submit()} disabled={busy} className="w-full py-2.5 bg-rip-text text-rip-bg rounded text-sm font-bold disabled:opacity-40">
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
        <Link href="/login" className="block text-center mt-4 text-xs text-rip-dim hover:text-rip-text">← на вход</Link>
      </div>
    </div>
  );
}
