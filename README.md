# RIP

> Социальная сеть, где всё умирает.

Экспериментальная соцсеть: контент конечен. Сообщения живут в общем потоке, проходят через ежедневные reset (≈50% погибает), могут стать легендарными (5+ выживаний), а каждый сезон заканчивается полной смертью мира — с экраном **YOU RIP** и новым сезоном.

MVP-гипотеза: *возвращаются ли люди в мир, который постоянно умирает.*

## Стек

- **Frontend**: Next.js 15 (App Router) + TypeScript (strict) + Tailwind + Framer Motion
- **Backend**: чистый PostgreSQL. Без Supabase/Firebase.
  - Локальная разработка: **PGlite** (Postgres в WASM, без установки, данные в `./.ripdata`)
  - Прод: PGlite-файл на VPS (или любой `DATABASE_URL` — Neon, RDS)
- **Auth**: свои сессии — scrypt + HttpOnly cookie `rip_session`; вход через **Telegram** (HMAC initData, авто-создание юзера)
- **Realtime**: поллинг (3.5 сек), сервер авторитативный
- **PWA**: manifest + service worker (`public/sw.js`) + Web Push (VAPID, `web-push`)
- **Медиа**: загрузка на диск (`data/uploads`), раздача через `/api/media/*`
- **Telegram Mini App**: self-hosted SDK (`public/telegram-web-app.js`, telegram.org заблокирован в РФ), продакшн на `https://golubot.ru/rip/` (nginx + PM2)

## Архитектура

```
Сервер авторитативный — клиент НЕ решает:
- выживет ли сообщение (daily_reset в SQL-функции)
- когда кончится сезон (ends_at + cron tick)
- сколько монет у пользователя (wallets, баланс только через транзакции)
- активна ли платная лента (purchase_attention — атомарная, с блокировкой кошелька)
```

### Ключевые модули

| Путь | Что это |
|---|---|
| `db/schema.sql` | Вся схема: 16 таблиц + SQL-функции движка (`daily_reset()`, `season_death()`, `next_season()`, `ensure_active_season()`, `purchase_attention()`, `save_my_message()`) |
| `lib/db.ts` | Драйвер: PGlite или pg (по `DATABASE_URL`), нормализация `process.cwd()` |
| `lib/auth.ts` | scrypt, сессии, cookie |
| `lib/season/engine.ts` | Рождение мира, reset, смерть, новый сезон (вызовы SQL-функций) |
| `lib/push/send.ts` | Web Push с автопрунингом протухших подписок |
| `lib/phases.ts` | Фазы сезона A–F + русская плюрализация countdown |
| `app/api/*` | 20 REST-роутов |
| `app/(main)/*` | Страницы: feed, message, dm, profile, notifications, seasons, admin |
| `components/telegram/*` | TelegramProvider (ожидание SDK, fullscreen, expand), TelegramBootstrap (авторизация initData) |
| `components/message-thread.tsx` | Общая ветка сообщения: root, ответы, поллинг, дроп с медиа, черепок, репост, продвижение. Используется и страницей `/message/[id]`, и модалкой из ленты внимания |
| `components/message-modal.tsx` | Модалка ветки поверх ленты (из ленты внимания) — тот же MessageThread |
| `db/0009_telegram_auth.sql` | Вход через Telegram: auth_identities, связка tg_id ↔ user |
| `db/0010_attention_message.sql` | purchase_attention с message_id — карточка внимания открывает ветку |
| `db/0011_feed_hidden.sql` | Крики внимания скрыты из чата (feed_hidden) |

### Фазы сезона (Dying UI)

```
A CALM      > 3 дней        — обычный UI
B WARNING   < 3 дней        — countdown заметнее
C CRITICAL  < 24 часов      — countdown крупный
D EMERGENCY < 6 часов       — начинается деградация
E FINAL     < 10 минут      — пульс, контраст, элементы исчезают
F DEATH     = 0             — ☠ SEASON HAS ENDED → YOU RIP → [CONTINUE]
```

Технические ошибки **не** маскируются под смерть: у них отдельный жёлтый стиль «⚠️ Техническая ошибка».

## Запуск

```bash
# 1. Установка
npm install

# 2. Миграции (без DATABASE_URL — локальный PGlite в ./.ripdata)
node scripts/migrate.mjs

# 3. (опционально) Демо-данные: 12 юзеров (пароль ripdemo123), ~90 сообщений, attention
node scripts/seed.mjs

# 4. Конфиг
cp .env.example .env.local
# TEST_SEASON_DURATION=1800 — сезон 30 минут для тестов (0 = 7 дней)

# 5. Dev
npm run dev            # http://localhost:3000
```

### Проверка движка

```bash
node scripts/smoke.mjs   # смоук: сезон, кошелёк, покупка, reset, смерть, новый сезон
```

## Переменные окружения (`.env.local`)

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | Пусто = PGlite локально. Иначе `postgres://user:pass@host:5432/db` |
| `TEST_SEASON_DURATION` | Секунд в сезоне для тестов. `1800` = 30 мин, `0` = 7 дней |
| `CRON_SECRET` | Защита `/api/cron/tick` |
| `ADMIN_EMAILS` | Доступ к админке (или `is_test_user=true` в БД) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Push. Генерация: `node scripts/gen-vapid.mjs` |
| `GIF_PROVIDER_KEY` | (опционально) внешний GIF-провайдер (klipy) |
| `TELEGRAM_BOT_TOKEN` | Токен бота для Telegram Mini App (проверка initData) |
| `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH` | Прод: `/rip` (nginx проксирует по префиксу). Локально — пусто |
| `NEXT_PUBLIC_BOT_URL` | (опционально) ссылка на бота для Menu Button |

## Деплой

### Vercel
1. Импорт репозитория → framework Next.js
2. Env: `DATABASE_URL` (Neon/RDS), `TEST_SEASON_DURATION=0`, `CRON_SECRET`, VAPID-ключи
3. Cron: `vercel.json` → `/api/cron/tick?secret=...` каждую минуту
4. **Важно**: PGlite не для прода — `DATABASE_URL` обязателен

### Свой VPS
```bash
npm ci && npm run build
DATABASE_URL=postgres://... node scripts/migrate.mjs
node_modules/.bin/next start -p 3000
# + nginx reverse proxy + cron: curl "https://host/api/cron/tick?secret=..." каждую минуту
```

## Telegram Mini App

Продакшн: бот **@rip_social_network_bot** → Menu Button `https://golubot.ru/rip/` (nginx + PM2, VPS).

Особенности (важные уроки из боевой эксплуатации):

- **Self-hosted SDK**: `public/telegram-web-app.js` — telegram.org заблокирован в РФ, SDK грузится с собственного домена **синхронно** в `app/layout.tsx`
- **Ожидание SDK**: `TelegramProvider` опрашивает `window.Telegram.WebApp` каждые 50 мс до 4 с (`resolved`), корневая страница не уводит на логин до решения провайдера
- **Fullscreen**: `ready()`, `expand()`, `requestFullscreen()`, `disableVerticalSwipes()` — апка открывается на весь экран
- **Хеддер**: в Telegram отступ `safe-area + 40px` — кнопки X/⋯ Telegram не перекрывают countdown
- **nginx (обязательно)**: `location = /api/webhook` → tm-bridge **ДО** `location /api/` (иначе умирает бот); `/api/` → rewrite в `/rip/api/`; `/rip/` + `/rip` → 3002 без среза префикса (basePath `/rip`); `client_max_body_size 35m` (фото с iPhone 2-5 МБ); no-cache для `/rip/` (WebView Telegram кэширует агрессивно)
- **Авторизация**: `POST /api/auth/telegram` — HMAC-SHA256 от initData, авто-создание юзера (users → profile → wallet 1000), cookie `rip_session`
- **Очистка кэша при обновлениях**: WebView держит старый HTML/чанки — после деплоя надо полностью закрыть Mini App (смахнуть) или очистить кэш Telegram

## Админ-панель (test controls)

Скрыта: `/admin` (в профиле — ссылка `[ test panel ]`). Доступ: `is_test_user` или email в `ADMIN_EMAILS`.

Кнопки:
- **🟢 DAILY RESET** — убить/сохранить ~50% сообщений
- **☠ SEASON DEATH** — убить сезон, финальная статистика
- **🌱 NEW SEASON** — следующий сезон
- **⚡ REFRESH ATTENTION** — обновить статусы слотов
- **Грант монет** — любому пользователю
- **Системное сообщение** — событие в ленту

## PWA / Push

- **Установка**: Chrome/Android — баннер установки; iOS — «Поделиться → На экран "Домой"» (приложение объясняет)
- **Push**: вкладка «🔕 уведомления» на главной → разрешение → подписка сохраняется в БД
- Уведомления: reset (выжили/погибли), смерть сезона, новый сезон, личные сообщения
- iOS: Web Push работает только после установки на Home Screen

## Известные ограничения MVP

- Realtime — поллинг (3.5 с), не WebSocket/SSE; для MVP достаточно
- GIF — вставка URL, без поиска (нужен ключ провайдера)
- Реакции — только 💀 (одна), без эмодзи-палитры
- Rate limit — in-memory (сбрасывается при рестарте)
- Модерация — мат-фильтр + репорты, без ручного модератора
- Демо-монеты не конвертируются в реальные деньги
- Один процесс (нет микросервисов, как задумано)

## Структура

```
app/
  (main)/feed|dm|profile|admin|message/    — страницы
  api/                                    — 20 REST-роутов
  login/                                  — вход/регистрация
  layout.tsx, globals.css, manifest.ts
components/                               — feed, composer, attention, dying-ui, death-screen...
lib/                                      — db, auth, season, push, phases, validation
db/schema.sql                             — схема + SQL-движок
scripts/                                  — migrate, seed, smoke, gen-vapid, gen-icons
public/sw.js, icons/                      — PWA
```
