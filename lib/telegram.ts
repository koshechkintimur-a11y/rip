import { createHmac } from 'crypto';

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

export type TelegramInitData = {
  user: TelegramUser | null;
  auth_date: number;
  query_id?: string;
  hash: string;
  start_param?: string;
};

/**
 * Валидация initData от Telegram Mini App.
 * Схема: data-check-string = все поля кроме hash, отсортированные по ключу,
 * в формате key=value, склеенные через \n. HMAC-SHA256 с секретным ключом
 * (HMAC-SHA256("WebAppData", bot_token)), сравнение с hash.
 * Возвращает распарсенные данные или null при невалидной подписи/просрочке.
 */
export function validateTelegramInitData(initData: string, botToken: string, maxAgeSec = 3600): TelegramInitData | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  // data-check-string: все пары кроме hash, отсортированные по ключу
  const pairs: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hash') pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  // секретный ключ: HMAC-SHA256(key="WebAppData", data=bot_token)
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // сравнение без тайминговой утечки
  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !a.equals(b)) return null;

  const authDate = Number(params.get('auth_date') || 0);
  // initData старше maxAge — не принимаем (защита от replay)
  if (Date.now() / 1000 - authDate > maxAgeSec) return null;

  let user: TelegramUser | null = null;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch { user = null; }
  }
  if (!user) return null;

  return {
    user,
    auth_date: authDate,
    query_id: params.get('query_id') || undefined,
    hash,
    start_param: params.get('start_param') || undefined,
  };
}

/** Генерация уникального username: из Telegram-ника, с суффиксом если занят. */
export function suggestUsername(base: string | undefined, isTaken: (u: string) => Promise<boolean>): Promise<string> {
  return (async () => {
    const clean = (base || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
    const candidate = clean || `user${Math.floor(Math.random() * 1000)}`;
    if (!(await isTaken(candidate))) return candidate;
    for (let i = 0; i < 20; i++) {
      const next = `${candidate.slice(0, 15)}_${Math.floor(Math.random() * 100000)}`;
      if (!(await isTaken(next))) return next;
    }
    return `${candidate.slice(0, 15)}_${Date.now() % 1000000}`;
  })();
}
