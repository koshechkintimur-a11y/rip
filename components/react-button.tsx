'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api';

/**
 * Кнопка черепка-реакции.
 * onChange(updatedCount) — опционально, для синхронизации счётчиков снаружи.
 */
export function ReactButton({ messageId, initialCount, onChange }: {
  messageId: string;
  initialCount: number;
  onChange?: (c: number) => void;
}) {
  const [count, setCount] = useState(initialCount);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await apiPost<{ reaction_count: number; active: boolean }>('/api/messages/react', { messageId });
      setCount(res.reaction_count);
      onChange?.(res.reaction_count);
      setActive(res.active);
    } catch { /* молча */ }
    setBusy(false);
  };

  return (
    <button className={`hover:text-rip-blood transition-colors ${active ? 'text-rip-blood' : ''}`} onClick={() => void toggle()}>
      💀 {count}
    </button>
  );
}