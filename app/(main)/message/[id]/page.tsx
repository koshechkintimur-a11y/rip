'use client';

import { useParams, useRouter } from 'next/navigation';
import { MessageThread } from '@/components/message-thread';

/**
 * Страница ветки сообщения (полноэкранно).
 * Открывается ИЗ ЧАТА (клик по посту в ленте) и по deep link /message/[id].
 * Вся логика ветки — в общем компоненте MessageThread (тот же, что в модалке
 * ленты внимания). Возврат — «← Чат» с fallback на /feed при отсутствии истории.
 */
export default function BranchPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 2) {
      router.back();
    } else {
      router.push('/feed');
    }
  };

  return (
    <div className="h-dvh flex flex-col">
      <div className="flex-1 flex flex-col min-h-0">
        <MessageThread
          messageId={id}
          backLabel="← Чат"
          onBack={goBack}
        />
      </div>
    </div>
  );
}
