/**
 * Генерация VAPID-ключей для Web Push.
 * Использование: node scripts/gen-vapid.mjs
 * Результат вставить в .env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
 */
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:dev@rip.local');
