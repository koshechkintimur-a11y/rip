import webpush from 'web-push';
import { q } from '@/lib/db';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('VAPID ключи не настроены');
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:dev@rip.local', pub, priv);
  configured = true;
}

type PushPayload = { title: string; body: string; url?: string };

export async function pushToUser(userId: string, payload: PushPayload) {
  try {
    ensureConfigured();
  } catch {
    return; // пуш не настроен — не критично для MVP
  }
  const subs = await q<{ id: string; endpoint: string; keys: any }>(
    `select id, endpoint, keys from push_subscriptions where user_id = $1`, [userId]
  );
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q(`delete from push_subscriptions where id = $1`, [s.id]);
        }
      }
    })
  );
}

export async function pushToAll(payload: PushPayload) {
  try {
    ensureConfigured();
  } catch {
    return;
  }
  const subs = await q<{ id: string; endpoint: string; keys: any }>(
    `select id, endpoint, keys from push_subscriptions`
  );
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          await q(`delete from push_subscriptions where id = $1`, [s.id]);
        }
      }
    })
  );
}
