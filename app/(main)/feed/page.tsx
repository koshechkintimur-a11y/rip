'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AttentionFeed } from '@/components/attention-feed';
import { Composer } from '@/components/composer';
import { FeedList } from '@/components/feed';
import { useWorld } from '@/components/world-provider';
import { AttentionBuy } from '@/components/attention-buy';
import { PushManager } from '@/components/push-manager';
import { getDeathState } from '@/lib/phases';
import { apiGet } from '@/lib/api';
import type { DbAttentionSlot } from '@/lib/types';

/** Главный экран: бегущее внимание + лента + композер закреплён внизу. */
export default function FeedPage() {
  const { wallet, remainingMs } = useWorld();
  const router = useRouter();
  const [slots, setSlots] = useState<DbAttentionSlot[]>([]);
  const [showBuy, setShowBuy] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [discusCount, setDiscusCount] = useState(0);
  const [discusFirstId, setDiscusFirstId] = useState<string | null>(null);

  // единый источник состояния умирания (внимание исчезает за 3 мин, композер — за 5)
  const deathState = getDeathState(remainingMs);
  const showAttention = deathState.showAttention && slots.length > 0;
  const showComposer = deathState.showComposer;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ slots: DbAttentionSlot[] }>('/api/attention');
        if (alive) setSlots(d.slots || []);
      } catch { /* тихо */ }
    };
    void load();
    const id = setInterval(load, 12000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <div>
      <PushManager />

      {/* ATTENTION FEED — рынок внимания; sticky под шапкой, виден при скролле */}
      {showAttention && slots.length > 0 && (
        <div className="sticky z-20 border-b border-rip-line bg-rip-bg/95 backdrop-blur"
          style={{ top: 'var(--rip-header-h, 48px)' }}>
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="text-[10px] tracking-widest text-rip-warn">⚡ ВНИМАНИЕ</span>
            <button
              onClick={() => setShowBuy(true)}
              className="text-[10px] text-rip-dim hover:text-rip-warn transition-colors"
            >
              купить место (20 монет) →
            </button>
          </div>
          <AttentionFeed slots={slots} />
        </div>
      )}

      {/* БАЛАНС */}
      <div className="px-4 py-1.5 flex items-center justify-between text-[11px] text-rip-dim border-b border-rip-line/40">
        <span>💀 {wallet?.balance ?? 0} монет</span>
        <button onClick={() => setShowBuy(true)} className="hover:text-rip-warn transition-colors">
          ⚡ продвинуть сообщение
        </button>
      </div>

      {/* ЛЕНТА — отступ снизу, чтобы не пряталась за композером */}
      <div className="pb-40">
        <FeedList
          key={feedKey}
          onDiscusChange={(count, firstId) => { setDiscusCount(count); setDiscusFirstId(firstId); }}
        />
      </div>

      {/* КОМПОЗЕР — закреплён над нижней навигацией; исчезает за 5 мин до конца */}
      {showComposer && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom,0px)+3.5rem)] left-1/2 -translate-x-1/2 w-full max-w-xl z-30 border-t border-rip-line bg-rip-bg" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <Composer
            onPosted={() => setFeedKey((k) => k + 1)}
            discusCount={discusCount}
            onDiscusClick={() => { if (discusFirstId) router.push(`/message/${discusFirstId}`); }}
          />
        </div>
      )}

      {showBuy && <AttentionBuy onClose={() => setShowBuy(false)} />}
    </div>
  );
}