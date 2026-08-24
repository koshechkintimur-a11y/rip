'use client';

import { useEffect } from 'react';
import { MessageThread } from '@/components/message-thread';

/**
 * Модалка сообщения ПОВЕРХ ленты (из ленты внимания).
 * Использует ТОТ ЖЕ MessageThread, что и страница /message/[id] —
 * полный функционал ветки: root, ответы, поллинг, дроп с медиа,
 * reply-to, черепок, репост, продвижение. Никакой урезанной карточки.
 *
 * Закрытие (✕ / клик по фону / Escape) — возврат в ленту, состояние ленты
 * не теряется (модалка поверх, лента остаётся смонтированной).
 */
export function MessageModal({ messageId, onClose }: {
  messageId: string;
  onClose: () => void;
}) {
  // Escape закрывает модалку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/70 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-rip-bg border border-rip-line rounded-t-2xl sm:rounded-2xl h-[85vh] sm:h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <MessageThread messageId={messageId} onClose={onClose} />
      </div>
    </div>
  );
}
