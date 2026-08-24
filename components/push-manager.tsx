'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Регистрация Service Worker + Web Push.
 * iOS: требуется установка PWA на Home Screen — объясняем.
 */
export function PushManager() {
  const [status, setStatus] = useState<'idle' | 'unsupported' | 'ios_install' | 'permission' | 'subscribed'>('idle');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      if (!('serviceWorker' in navigator)) { setStatus('unsupported'); return; }
      if (!('PushManager' in window)) { setStatus('unsupported'); return; }

      // регистрация SW
      try {
        await navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/sw.js`);
      } catch { /* тихо */ }

      // iOS: нужна установка на Home Screen
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = (window.matchMedia('(display-mode: standalone)').matches) || (navigator as any).standalone === true;
      if (isIOS && !standalone) { setStatus('ios_install'); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setStatus('subscribed');
      } else if (Notification.permission === 'granted') {
        await subscribe();
      } else {
        setStatus('permission');
      }
    })();
  }, []);

  const subscribe = async () => {
    setBusy(true);
    try {
      const { publicKey } = await apiGet<{ publicKey: string }>('/api/push/vapid');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await apiPost('/api/push/subscribe', {
        subscription: { endpoint: sub.endpoint, keys: sub.toJSON().keys },
      });
      setStatus('subscribed');
    } catch { setStatus('permission'); }
    setBusy(false);
  };

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiDelete('/api/push/subscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    setStatus('permission');
  };

  if (status === 'subscribed') {
    return (
      <div className="px-4 py-2 flex items-center justify-between text-[11px] border-b border-rip-line/40 bg-rip-panel/30">
        <span className="text-rip-green">🔔 уведомления включены</span>
        <button onClick={() => void unsubscribe()} className="text-rip-dim hover:text-rip-text">выключить</button>
      </div>
    );
  }

  if (status === 'ios_install') {
    return (
      <div className="mx-4 mt-2 border border-rip-warn/40 bg-rip-warn/5 rounded-lg p-3 text-[11px] text-rip-warn leading-relaxed">
        📱 Чтобы получать уведомления на iPhone/iPad: открой меню <b>Поделиться</b> и выбери
        <b> «На экран "Домой"»</b>. После установки RIP как приложения вернись сюда и включи push.
      </div>
    );
  }

  if (status === 'permission') {
    return (
      <div className="px-4 py-2 flex items-center justify-between text-[11px] border-b border-rip-line/40 bg-rip-panel/30">
        <span className="text-rip-dim">🔕 уведомления выключены</span>
        <button onClick={() => void subscribe()} disabled={busy} className="text-rip-text hover:text-rip-warn transition-colors">
          {busy ? '...' : 'включить'}
        </button>
      </div>
    );
  }

  return null;
}
