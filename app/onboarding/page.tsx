'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { apiGet } from '@/lib/api';
import { formatCountdown } from '@/lib/phases';

/**
 * Onboarding — вход в уже живой мир RIP. 4 экрана, ~30 секунд.
 * Не объясняет все механики — оставляет пространство для discovery.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [seasonNum, setSeasonNum] = useState<number | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ season: { number: number; ends_at: string; name?: string | null } }>('/api/state');
        if (!alive || !d.season) return;
        setSeasonNum(d.season.number);
        setSeasonName(d.season.name || null);
        setRemaining(Math.max(0, new Date(d.season.ends_at).getTime() - Date.now()));
      } catch { /* мир может быть мёртв — onboarding всё равно покажем */ }
    };
    void load();
    const id = setInterval(() => {
      setRemaining((r) => (r === null ? null : Math.max(0, r - 1000)));
    }, 1000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const enter = () => router.push('/login');

  const steps = [
    // Экран 1: концепция
    <div key="1" className="text-center px-6">
      <h1 className="rip-serif text-6xl font-black tracking-tighter mb-6">RIP</h1>
      <p className="text-lg text-rip-text/90 leading-relaxed">
        Социальная сеть, где <span className="text-rip-rust font-semibold">посты не вечны</span>.
      </p>
      <p className="mt-4 text-sm text-rip-dim">
        Каждый сезон длится 7 дней. Дальше — волна.
      </p>
    </div>,
    // Экран 2: волна и шанс выжить
    <div key="2" className="text-center px-6">
      <h2 className="rip-serif text-2xl font-black tracking-widest mb-6">
        ВОЛНА КАЖДЫЕ <span className="text-rip-rust">24 ЧАСА</span>
      </h2>
      <div className="bg-rip-panel border border-rip-line rounded-lg p-3 text-left mb-4">
        <p className="text-xs text-rip-dim">@timur <span className="float-right text-[10px]">19:22</span></p>
        <p className="text-sm mt-0.5">куда сходить в Перми?</p>
        <div className="mt-1.5 flex gap-3 text-xs text-rip-dim">
          <span>↳ 4</span><span>💀 8</span>
          <span className="ml-auto inline-flex items-center rounded px-1.5 py-px border border-rip-rust/40 text-rip-rust">шанс 62%</span>
        </div>
      </div>
      <p className="text-sm text-rip-text/85 leading-relaxed">
        Раз в сутки ~50% сообщений погибает.
        <br />
        Шанс выжить: <span className="text-rip-rust font-semibold">30% + черепки и ответы</span>.
        <br />
        <span className="text-rip-dim text-xs">Собирай 💀 — продлевай жизнь.</span>
      </p>
    </div>,
    // Экран 3: сезон = мир
    <div key="3" className="text-center px-6">
      <h2 className="rip-serif text-2xl font-black tracking-widest mb-6">
        СЕЗОН <span className="text-rip-rust">= МИР</span>
      </h2>
      <div className="bg-rip-panel border border-rip-line rounded-lg p-3 mb-4 overflow-hidden">
        <p className="text-[10px] tracking-widest text-rip-warn mb-1">⚡ КРИКИ</p>
        <div className="flex gap-2 animate-marquee whitespace-nowrap">
          <span className="text-sm shrink-0">@max: КТО НЕ СПИТ?</span>
          <span className="text-sm shrink-0 text-rip-warn">@anna: ЭХО — ЭТО КОГДА ТЕБЯ ПОМНЯТ</span>
          <span className="text-sm shrink-0">@oleg: кто из Перми?</span>
        </div>
      </div>
      <p className="text-sm text-rip-text/85 leading-relaxed">
        У каждого сезона есть имя и судьба.
        В конце умирает почти всё.
        <br />
        <span className="text-rip-rust">Выжившие становятся легендами.</span>
      </p>
    </div>,
    // Экран 4: countdown + вход
    <div key="4" className="text-center px-6">
      <h2 className="rip-serif text-xl font-black tracking-widest mb-2">СЕЗОН {seasonNum ?? 1}{seasonName ? ` «${seasonName}»` : ''}</h2>
      <p className="text-[11px] text-rip-dim tracking-widest mb-3">ОСТАЛОСЬ</p>
      <div className="font-mono text-3xl font-bold text-rip-rust mb-6 leading-tight">
        {remaining !== null ? formatCountdown(remaining) : '— ДНЕЙ —'}
      </div>
      <p className="text-sm text-rip-text/85 leading-relaxed mb-8">
        Когда сезон заканчивается, <span className="text-rip-blood">RIP начинает исчезать</span>.
        <br />
        Если интерфейс начнёт умирать — не пугайся.
        <br />
        <span className="text-rip-dim text-xs">Всё работает правильно.</span>
      </p>
      <button
        onClick={enter}
        className="px-10 py-3 bg-rip-text text-rip-bg rounded-lg text-sm font-bold tracking-widest hover:opacity-90 transition-opacity"
      >
        ВОЙТИ В RIP
      </button>
    </div>,
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-rip-bg">
      <div className="flex-1 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-md"
          >
            {steps[step]}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-8 px-6 flex items-center justify-between">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <span key={i} className={`h-1 rounded-full transition-all ${i === step ? 'w-6 bg-rip-text' : 'w-3 bg-rip-line'}`} />
          ))}
        </div>
        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            className="px-6 py-2 border border-rip-text/40 rounded text-sm hover:bg-rip-panel transition-colors"
          >
            {step === 2 ? 'ПОСЛЕДНИЙ ШАГ' : 'ДАЛЬШЕ'}
          </button>
        ) : (
          <button
            onClick={enter}
            className="px-6 py-2 bg-rip-text text-rip-bg rounded text-sm font-bold"
          >
            ВОЙТИ В RIP
          </button>
        )}
      </div>
    </div>
  );
}
