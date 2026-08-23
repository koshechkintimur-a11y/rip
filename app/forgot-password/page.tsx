'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPost } from '@/lib/api';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await apiPost('/api/auth/forgot', { email });
      setState('sent');
    } catch (e: any) {
      setState('error');
      setError(e.message || 'Ошибка');
    }
    setBusy(false);
  };

  if (state === 'sent') {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6 bg-rip-bg">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-black mb-3">Проверь почту</h1>
          <p className="text-sm text-rip-dim leading-relaxed">
            Если аккаунт с <span className="text-rip-text">{email}</span> существует,
            мы отправили ссылку для сброса пароля. Она действует 1 час.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm text-rip-accent underline">← на вход</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-rip-bg">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black mb-1">Забыли пароль?</h1>
        <p className="text-sm text-rip-dim mb-5">Введи email — пришлём ссылку для сброса.</p>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          type="email"
          className="w-full bg-rip-panel border border-rip-line rounded px-3 py-2.5 text-sm outline-none focus:border-rip-text/50"
        />
        {state === 'error' && <p className="mt-2 text-xs text-rip-blood">⚠️ {error}</p>}
        <button
          onClick={() => void submit()}
          disabled={busy || !email}
          className="mt-4 w-full py-2.5 bg-rip-text text-rip-bg rounded text-sm font-bold disabled:opacity-40"
        >
          {busy ? 'Отправляем…' : 'Отправить ссылку'}
        </button>
        <Link href="/login" className="block text-center mt-4 text-xs text-rip-dim hover:text-rip-text">← на вход</Link>
      </div>
    </div>
  );
}
