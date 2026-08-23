export type SeasonPhase = 'calm' | 'warning' | 'critical' | 'emergency' | 'final' | 'death';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Фаза сезона по оставшемуся времени (сервер — источник ends_at, здесь только рендер). */
export function getPhase(remainingMs: number): SeasonPhase {
  if (remainingMs <= 0) return 'death';
  if (remainingMs <= 10 * 60 * 1000) return 'final';
  if (remainingMs <= 6 * HOUR) return 'emergency';
  if (remainingMs <= 24 * HOUR) return 'critical';
  if (remainingMs <= 3 * DAY) return 'warning';
  return 'calm';
}

/**
 * ЕДИНЫЙ источник состояния «умирания» интерфейса.
 * Все компоненты (DyingUI, feed, навигация) берут отсюда — без дублирования логики.
 * Прогрессивная деградация по таймеру (intentional RIP-механика, не поломка):
 *   6ч    — предупреждение
 *   3ч    — лёгкая нестабильность (glitch)
 *   1ч    — исчезают второстепенные элементы
 *   30м   — заметная нестабильность
 *   10м   — исчезает DM
 *   5м    — исчезает композер
 *   3м    — исчезает attention feed
 *   1м    — лента начинает разрушаться
 *   30с   — почти всё исчезает
 *   10с   — остаётся только countdown
 *   0     — YOU RIP
 */
export type DeathState = {
  showNav: boolean;
  showDm: boolean;
  showAttention: boolean;
  showComposer: boolean;
  showSecondary: boolean;
  showFeed: boolean;
  showCountdown: boolean;
  glitchLevel: 0 | 1 | 2 | 3;
  intensity: number; // 0..1 — насколько близко к смерти
};

export function getDeathState(remainingMs: number): DeathState {
  const ms = Math.max(0, remainingMs);
  const MIN = 60_000;
  const isDead = remainingMs <= 0;

  // интенсивность: 0 при 6ч+, 1 при 0
  const intensity = Math.min(1, Math.max(0, 1 - ms / (6 * HOUR)));

  let glitchLevel: 0 | 1 | 2 | 3 = 0;
  if (ms <= 3 * HOUR) glitchLevel = 1;
  if (ms <= 30 * MIN) glitchLevel = 2;
  if (ms <= MIN) glitchLevel = 3;

  return {
    showNav: !isDead && ms > 10 * MIN,
    showDm: !isDead && ms > 10 * MIN,
    showAttention: !isDead && ms > 3 * MIN,
    showComposer: !isDead && ms > 5 * MIN,
    showSecondary: !isDead && ms > HOUR,
    showFeed: !isDead && ms > 30 * 1000,
    showCountdown: !isDead,
    glitchLevel,
    intensity,
  };
}

/** Русская плюрализация: plural(5, ['сообщение','сообщения','сообщений']) */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const d = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (d > 1 && d < 5) return forms[1];
  if (d === 1) return forms[0];
  return forms[2];
}

/** «ОСТАЛОСЬ 2 ДНЯ 12 ЧАСОВ 32 МИНУТЫ» */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '0 СЕКУНД';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ${plural(d, ['ДЕНЬ', 'ДНЯ', 'ДНЕЙ'])}`);
  if (h > 0 || d > 0) parts.push(`${h} ${plural(h, ['ЧАС', 'ЧАСА', 'ЧАСОВ'])}`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m} ${plural(m, ['МИНУТА', 'МИНУТЫ', 'МИНУТ'])}`);
  if (parts.length === 0) parts.push(`${s} ${plural(s, ['СЕКУНДА', 'СЕКУНДЫ', 'СЕКУНД'])}`);
  return parts.join(' ');
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  return `${d} дн назад`;
}
