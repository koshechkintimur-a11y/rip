'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPhase, type SeasonPhase } from '@/lib/phases';
import { apiGet, apiPost } from '@/lib/api';

export type Season = {
  id: string;
  number: number;
  status: 'active' | 'ended';
  started_at: string;
  ends_at: string;
  duration_seconds: number;
  last_reset_at: string | null;
  name: string | null;
  created_at: string;
};

type WorldState = {
  season: Season | null;
  phase: SeasonPhase;
  remainingMs: number;
  wallet: { balance: number } | null;
  stats: Record<string, unknown> | null;
  aliveCount: number;
  myAlive: number;
  unreadDm: number;
  notifCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  continueToNextSeason: () => Promise<boolean>;
};

const WorldContext = createContext<WorldState | null>(null);

export function WorldProvider({ children }: { children: React.ReactNode }) {
  const [season, setSeason] = useState<Season | null>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);
  const [aliveCount, setAliveCount] = useState(0);
  const [myAlive, setMyAlive] = useState(0);
  const [unreadDm, setUnreadDm] = useState(0);
  const [notifCount, setNotifCount] = useState(0);
  const [now, setNow] = useState(0); // 0 на сервере → избегаем hydration mismatch
  const [loading, setLoading] = useState(true);
  const refreshing = useRef(false);

  // инициализируем now на клиенте
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const data = await apiGet<{
        season: Season;
        wallet: { balance: number };
        stats: Record<string, unknown> | null;
        aliveCount: number;
        myAlive: number;
        unreadDm: number;
      }>('/api/state');
      setSeason(data.season);
      setWallet(data.wallet);
      setStats(data.stats);
      setAliveCount(data.aliveCount);
      setMyAlive(data.myAlive);
      setUnreadDm(data.unreadDm);
    } catch {
      // тихо
    } finally {
      refreshing.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  // счётчик новых ответов на мои сообщения (бейдж в нижней навигации)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ notifications: Array<{ is_new: boolean }> }>('/api/notifications');
        if (alive) setNotifCount((d.notifications || []).filter((n) => n.is_new).length);
      } catch { /* тихо */ }
    };
    void load();
    const id = setInterval(load, 15000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // локальный тик для countdown (только когда now инициализирован)
  useEffect(() => {
    if (now === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [now]);

  const remainingMs = useMemo(() => {
    if (!season || now === 0) return 0;
    return new Date(season.ends_at).getTime() - now;
  }, [season, now]);

  // phase: DEATH — только если сервер сказал, что сезон завершён
  const phase: SeasonPhase = useMemo(() => {
    if (!season) return 'calm';
    if (season.status === 'ended') return 'death';
    // active сезон с истекшим таймером — финальная стадия (ждём сервер)
    if (remainingMs <= 0) return 'final';
    return getPhase(remainingMs);
  }, [season, remainingMs]);

  const continueToNextSeason = useCallback(async () => {
    try {
      await apiPost('/api/season/continue');
      await refresh();
      return true;
    } catch (e: any) {
      throw new Error(e?.message || 'Не удалось начать новый сезон');
    }
  }, [refresh]);

  return (
    <WorldContext.Provider
      value={{ season, phase, remainingMs, wallet, stats, aliveCount, myAlive, unreadDm, notifCount, loading, refresh, continueToNextSeason }}
    >
      {children}
    </WorldContext.Provider>
  );
}

export function useWorld(): WorldState {
  const ctx = useContext(WorldContext);
  if (!ctx) throw new Error('useWorld вне WorldProvider');
  return ctx;
}