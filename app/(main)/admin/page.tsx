'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '@/lib/api';
import { useWorld } from '@/components/world-provider';
import { formatCountdown } from '@/lib/phases';

type AdminState = {
  season: any;
  stats: any;
  users: Array<{ username: string; display_name: string | null; is_test_user: boolean; balance: number; messages_count: number }>;
};

/** Скрытая тестовая панель: reset, смерть сезона, новый сезон, монеты, системные сообщения. */
export default function AdminPage() {
  const router = useRouter();
  const { refresh } = useWorld();
  const [data, setData] = useState<AdminState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [grantUser, setGrantUser] = useState('');
  const [grantAmount, setGrantAmount] = useState(1000);
  const [sysText, setSysText] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await apiGet<AdminState>('/api/admin');
      setData(d);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Нет доступа');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (action: string, body?: Record<string, unknown>) => {
    setBusy(action);
    try {
      const res = await apiPost<{ result?: any }>('/api/admin', { action, ...body });
      setLog((l) => [`✓ ${action}${res.result ? ' → ' + JSON.stringify(res.result) : ''}`, ...l].slice(0, 8));
      await load();
      void refresh();
    } catch (e: any) {
      setLog((l) => [`✗ ${action}: ${e.message}`, ...l].slice(0, 8));
    }
    setBusy(null);
  };

  if (error) return (
    <div className="p-4">
      <p className="text-sm text-rip-warn border border-rip-warn/40 rounded-lg p-3">⚠️ {error}</p>
      <button onClick={() => router.push('/feed')} className="mt-3 text-xs text-rip-dim">← главная</button>
    </div>
  );
  if (!data) return <div className="p-4 text-sm text-rip-dim animate-pulse">загружаем…</div>;

  const { season, stats, users } = data;
  const remaining = new Date(season?.ends_at).getTime() - Date.now();

  return (
    <div className="px-4 py-3 space-y-4 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-widest">☠ TEST PANEL</h1>
        <button onClick={() => router.push('/feed')} className="text-xs text-rip-dim">← закрыть</button>
      </div>

      {/* СЕЗОН */}
      <div className="border border-rip-line rounded-lg p-3">
        <p className="text-[10px] tracking-widest text-rip-dim">СЕЗОН</p>
        <p className="text-sm mt-1">
          #{season?.number} · {season?.status}
          {season?.status === 'active' && (
            <span className="text-rip-warn ml-2">⏳ {formatCountdown(Math.max(remaining, 0))}</span>
          )}
        </p>
        {stats && (
          <div className="grid grid-cols-4 gap-2 mt-2 text-center text-[11px]">
            <div className="bg-rip-panel rounded p-1.5">всего<br /><b>{stats.total_messages}</b></div>
            <div className="bg-rip-panel rounded p-1.5 text-rip-green">живых<br /><b>{stats.alive_messages}</b></div>
            <div className="bg-rip-panel rounded p-1.5 text-rip-dim">мёртвых<br /><b>{stats.dead_messages}</b></div>
            <div className="bg-rip-panel rounded p-1.5 text-rip-gold">легенд<br /><b>{stats.legendary_count}</b></div>
          </div>
        )}
      </div>

      {/* КНОПКИ ДВИЖКА */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => void act('reset')}
          disabled={busy !== null}
          className="border border-rip-line rounded-lg py-2.5 text-sm hover:border-rip-green hover:text-rip-green disabled:opacity-40 transition-colors"
        >🟢 DAILY RESET</button>
        <button
          onClick={() => void act('death')}
          disabled={busy !== null}
          className="border border-rip-blood/50 text-rip-blood rounded-lg py-2.5 text-sm hover:bg-rip-blood hover:text-black disabled:opacity-40 transition-colors"
        >☠ SEASON DEATH</button>
        <button
          onClick={() => void act('next')}
          disabled={busy !== null}
          className="border border-rip-line rounded-lg py-2.5 text-sm hover:border-rip-text disabled:opacity-40 transition-colors"
        >🌱 NEW SEASON</button>
        <button
          onClick={() => void act('refresh_attention')}
          disabled={busy !== null}
          className="border border-rip-line rounded-lg py-2.5 text-sm hover:border-rip-warn hover:text-rip-warn disabled:opacity-40 transition-colors"
        >⚡ REFRESH ATTENTION</button>
      </div>

      {/* МОНЕТЫ */}
      <div className="border border-rip-line rounded-lg p-3">
        <p className="text-[10px] tracking-widest text-rip-dim">ГРАНТ МОНЕТ</p>
        <div className="flex gap-2 mt-2">
          <input
            value={grantUser}
            onChange={(e) => setGrantUser(e.target.value)}
            placeholder="username"
            className="flex-1 bg-rip-bg border border-rip-line rounded px-3 py-1.5 text-sm outline-none"
          />
          <input
            value={grantAmount}
            onChange={(e) => setGrantAmount(Number(e.target.value) || 0)}
            type="number"
            className="w-20 bg-rip-bg border border-rip-line rounded px-2 py-1.5 text-sm outline-none"
          />
          <button
            onClick={() => void act('grant', { username: grantUser, amount: grantAmount })}
            className="bg-rip-text text-rip-bg rounded px-4 text-sm font-bold"
          >+</button>
        </div>
      </div>

      {/* СИСТЕМНОЕ СООБЩЕНИЕ */}
      <div className="border border-rip-line rounded-lg p-3">
        <p className="text-[10px] tracking-widest text-rip-dim">СИСТЕМНОЕ СООБЩЕНИЕ</p>
        <div className="flex gap-2 mt-2">
          <input
            value={sysText}
            onChange={(e) => setSysText(e.target.value)}
            placeholder="⚠️ текст в ленту..."
            className="flex-1 bg-rip-bg border border-rip-line rounded px-3 py-1.5 text-sm outline-none"
          />
          <button
            onClick={() => { void act('system', { content: sysText }); setSysText(''); }}
            className="border border-rip-line rounded px-3 text-sm"
          >→</button>
        </div>
      </div>

      {/* ЛОГ */}
      {log.length > 0 && (
        <div className="border border-rip-line rounded-lg p-3">
          <p className="text-[10px] tracking-widest text-rip-dim">ЛОГ</p>
          {log.map((l, i) => (
            <p key={i} className="text-[11px] font-mono mt-1 break-all text-rip-text/80">{l}</p>
          ))}
        </div>
      )}

      {/* ПОЛЬЗОВАТЕЛИ */}
      <div className="border border-rip-line rounded-lg p-3">
        <p className="text-[10px] tracking-widest text-rip-dim">ПОЛЬЗОВАТЕЛИ ({users.length})</p>
        <div className="mt-1 max-h-64 overflow-y-auto">
          {users.map((u) => (
            <div key={u.username} className="flex items-center justify-between py-1 border-b border-rip-line/30 text-xs">
              <span className="truncate">@{u.username} <span className="text-rip-dim">({u.messages_count} msg)</span></span>
              <span className="text-rip-warn">💀 {u.balance}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
