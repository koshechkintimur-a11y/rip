'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AttentionFeed } from '@/components/attention-feed';
import { FeedList } from '@/components/feed';
import { MessageModal } from '@/components/message-modal';
import { useWorld } from '@/components/world-provider';
import { AttentionBuy } from '@/components/attention-buy';
import { PushManager } from '@/components/push-manager';
import { getDeathState } from '@/lib/phases';
import { apiGet } from '@/lib/api';
import type { DbAttentionSlot } from '@/lib/types';

/** Главный экран: бегущее внимание + лента. Пост — через модалку (надгробие в навигации). */
export default function FeedPage() {
  const { wallet, remainingMs } = useWorld();
  const router = useRouter();
  const [slots, setSlots] = useState<DbAttentionSlot[]>([]);
  const [nextWaveAt, setNextWaveAt] = useState<string | null>(null);
  const [showBuy, setShowBuy] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  // модалка ветки из ленты внимания (state-based: лента остаётся смонтированной)
  const [modalMessageId, setModalMessageId] = useState<string | null>(null);

  // единый источник состояния умирания (внимание исчезает за 3 мин до конца)
  const deathState = getDeathState(remainingMs);
  const showAttention = deathState.showAttention && slots.length > 0;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d = await apiGet<{ slots: DbAttentionSlot[]; next_wave_at?: string }>('/api/attention');
        if (alive) { setSlots(d.slots || []); setNextWaveAt(d.next_wave_at ?? null); }
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
          </div>
          <AttentionFeed
            slots={slots}
            onOpenMessage={(messageId) => setModalMessageId(messageId)}
            nextWaveAt={nextWaveAt}
          />
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
          onDiscusChange={() => { /* посты теперь в модалке надгробия; дискус-счётчик не нужен в ленте */ }}
        />
      </div>

      {showBuy && <AttentionBuy onClose={() => setShowBuy(false)} />}

      {/* Модалка ветки из ленты внимания — поверх ленты, с тем же MessageThread */}
      {modalMessageId && (
        <MessageModal
          messageId={modalMessageId}
          onClose={() => setModalMessageId(null)}
        />
      )}
    </div>
  );
}