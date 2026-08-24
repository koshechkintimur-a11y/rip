-- =============================================================
-- RIP · миграция 0009 — Telegram auth (Mini App)
-- =============================================================

-- 1. Мульти-провайдер идентичности (Telegram, позже Google/Apple)
create table if not exists auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null check (provider in ('telegram')),
  provider_user_id text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (provider, provider_user_id)
);
create index if not exists idx_auth_identities_user on auth_identities (user_id);

-- 2. Email/password становятся необязательными (Telegram-only аккаунты)
alter table users alter column email drop not null;
alter table users alter column password_hash drop not null;

-- 3. Реферальные ссылки (deep link startapp=ref_...)
create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references users(id) on delete cascade,
  referred_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (referrer_id, referred_id)
);

-- 4. Аналитические события Mini App
create table if not exists telegram_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_telegram_events_user_time on telegram_events (user_id, created_at desc);