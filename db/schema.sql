-- =============================================================
-- RIP · PostgreSQL (без Supabase) — единая схема
-- =============================================================

-- ---------- ПОЛЬЗОВАТЕЛИ / AUTH ----------
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  password_hash text not null,           -- scrypt: salt:hex
  created_at   timestamptz not null default now()
);

create table if not exists sessions (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_sessions_user on sessions (user_id);

create table if not exists profiles (
  id           uuid primary key references users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar_url   text,
  bio          text,
  is_test_user boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_profiles_username on profiles (username);

-- ---------- СЕЗОНЫ ----------
create table if not exists seasons (
  id               uuid primary key default gen_random_uuid(),
  number           int  not null unique,
  status           text not null default 'active' check (status in ('active','ended')),
  started_at       timestamptz not null default now(),
  ends_at          timestamptz not null,
  duration_seconds int  not null default 604800,
  last_reset_at    timestamptz,
  created_at       timestamptz not null default now(),
  check (ends_at > started_at)
);

-- ---------- СООБЩЕНИЯ ----------
create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  author_id         uuid not null references profiles(id) on delete cascade,
  season_id         uuid not null references seasons(id),
  content           text not null check (char_length(content) between 1 and 500),
  media_url         text,
  media_type        text check (media_type in ('image','gif')),
  parent_message_id uuid references messages(id) ON DELETE CASCADE,
  branch_id         uuid,
  status            text not null default 'active' check (status in ('active','dead','saved','legendary','archived')),
  survival_count    int  not null default 0,
  reaction_count    int  not null default 0,
  created_at        timestamptz not null default now(),
  died_at           timestamptz,
  last_survived_at  timestamptz
);
create index if not exists idx_messages_season_status_created on messages (season_id, status, created_at desc);
create index if not exists idx_messages_author_created on messages (author_id, created_at desc);
create index if not exists idx_messages_parent on messages (parent_message_id);
create index if not exists idx_messages_branch on messages (branch_id);

-- ---------- ВЕТКИ ----------
create table if not exists branches (
  id              uuid primary key default gen_random_uuid(),
  root_message_id uuid references messages(id) ON DELETE CASCADE,
  season_id       uuid references seasons(id),
  reply_count     int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_branches_root on branches (root_message_id);

alter table messages drop constraint if exists fk_messages_branch;
alter table messages add constraint fk_messages_branch foreign key (branch_id) references branches(id);

-- функция: убедиться, что у корня есть ветка; вернуть её id
create or replace function ensure_branch(p_root uuid)
returns uuid
language plpgsql
as $$
declare
  v_branch uuid;
  v_parent uuid;
begin
  select coalesce(parent_message_id, id) into v_parent from messages where id = p_root;
  while exists (select 1 from messages m where m.id = v_parent and m.parent_message_id is not null) loop
    select parent_message_id into v_parent from messages where id = v_parent;
  end loop;

  select b.id into v_branch from branches b where b.root_message_id = v_parent;
  if v_branch is null then
    insert into branches (root_message_id, season_id)
      select v_parent, season_id from messages where id = v_parent
      returning id into v_branch;
  end if;
  return v_branch;
end;
$$;

-- триггер на сообщение: назначить branch_id и увеличить счётчик ответов ветки
create or replace function on_message_created()
returns trigger
language plpgsql
as $$
begin
  if new.parent_message_id is not null then
    new.branch_id := ensure_branch(new.parent_message_id);
    update branches set reply_count = reply_count + 1 where id = new.branch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_before_insert on messages;
create trigger trg_messages_before_insert
before insert on messages
for each row execute function on_message_created();

-- updated_at триггер
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_touch on profiles;
create trigger trg_profiles_touch before update on profiles
for each row execute function touch_updated_at();

-- ---------- РЕАКЦИИ ----------
create table if not exists reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null default 'skull',
  created_at timestamptz not null default now(),
  unique (message_id, user_id, kind)
);
create index if not exists idx_reactions_message on reactions (message_id);

-- триггер счётчика реакций
create or replace function on_reaction_change()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update messages set reaction_count = reaction_count + 1 where id = new.message_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update messages set reaction_count = greatest(reaction_count - 1, 0) where id = old.message_id;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_reactions on reactions;
create trigger trg_reactions
after insert or delete on reactions
for each row execute function on_reaction_change();

-- ---------- ЛИЧНЫЕ СООБЩЕНИЯ ----------
create table if not exists direct_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references profiles(id) on delete cascade,
  user_b       uuid not null references profiles(id) on delete cascade,
  last_message text,
  created_at   timestamptz not null default now(),
  check (user_a <> user_b),
  unique (user_a, user_b)
);
create index if not exists idx_conv_a on direct_conversations (user_a, created_at desc);
create index if not exists idx_conv_b on direct_conversations (user_b, created_at desc);

create table if not exists direct_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references direct_conversations(id) on delete cascade,
  sender_id        uuid not null references profiles(id) on delete cascade,
  content          text not null check (char_length(content) between 1 and 1000),
  read_by_recipient boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists idx_dm_conversation on direct_messages (conversation_id, created_at);

-- ---------- КОШЕЛЁК ----------
create table if not exists wallets (
  user_id     uuid primary key references profiles(id) on delete cascade,
  balance     int  not null default 0 check (balance >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_wallets_touch on wallets;
create trigger trg_wallets_touch before update on wallets
for each row execute function touch_updated_at();

create table if not exists wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  amount      int  not null,
  kind        text not null check (kind in ('purchase_attention','test_grant','refund','future_purchase','signup_grant')),
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_wtx_user on wallet_transactions (user_id, created_at desc);

-- грант при регистрации профиля
create or replace function grant_signup_coins()
returns trigger
language plpgsql
as $$
begin
  insert into wallets (user_id, balance) values (new.id, 1000) on conflict do nothing;
  insert into wallet_transactions (user_id, amount, kind, description)
    values (new.id, 1000, 'signup_grant', 'Стартовый грант RIP');
  return new;
end;
$$;

drop trigger if exists trg_profiles_coins on profiles;
create trigger trg_profiles_coins
after insert on profiles
for each row execute function grant_signup_coins();

-- ---------- ATTENTION SLOTS ----------
create table if not exists attention_slots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  message_id  uuid references messages(id) on delete set null,
  content     text not null,
  position    int  not null default 0,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  price       int  not null default 20,
  status      text not null default 'scheduled' check (status in ('scheduled','active','expired')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_attention_active on attention_slots (status, ends_at desc);

-- атомарная покупка слотов внимания
create or replace function purchase_attention(
  p_user uuid,
  p_content text,
  p_slots int,
  p_minutes int
)
returns jsonb
language plpgsql
as $$
declare
  v_unit_price int := 20;
  v_balance int;
  v_cost int;
  v_base timestamptz;
  v_ends timestamptz;
  v_per_slot interval;
  v_text text;
  v_pos int;
  i int;
begin
  v_text := trim(coalesce(p_content, ''));
  if v_text = '' then raise exception 'Пустой текст'; end if;
  if char_length(v_text) > 80 then raise exception 'Слишком длинный текст (макс 80)'; end if;
  if p_slots < 1 or p_slots > 5 then raise exception 'Слотов: 1-5'; end if;
  if p_minutes < 10 or p_minutes > 120 or p_minutes % 10 <> 0 then raise exception 'Длительность: 10-120 мин, кратно 10'; end if;

  v_cost := v_unit_price * (p_minutes / 10) * p_slots;

  -- блокируем строку кошелька — защита от double spend
  select balance into v_balance from wallets where user_id = p_user for update;
  if v_balance is null then raise exception 'Кошелёк не найден'; end if;
  if v_balance < v_cost then raise exception 'Недостаточно монет'; end if;

  -- ставим в очередь после последнего активного/запланированного слота
  select max(ends_at) into v_base
    from attention_slots
    where status in ('scheduled','active') and ends_at > now();

  v_base := coalesce(v_base, now());
  v_per_slot := make_interval(mins => (p_minutes::numeric / p_slots)::int);
  v_ends := v_base + make_interval(mins => p_minutes::int);
  v_pos := coalesce((select max(position)+1 from attention_slots where status in ('scheduled','active')), 0);

  for i in 1..p_slots loop
    insert into attention_slots (user_id, message_id, content, position, starts_at, ends_at, price, status)
    values (p_user, null, v_text, v_pos + i - 1, v_base + (i-1)*v_per_slot, v_base + i*v_per_slot,
            v_unit_price * (p_minutes / 10), 'scheduled');
  end loop;

  update wallets set balance = balance - v_cost where user_id = p_user;
  insert into wallet_transactions (user_id, amount, kind, description)
    values (p_user, -v_cost, 'purchase_attention', format('Внимание: %s слот(ов) × %s мин', p_slots, p_minutes));

  return jsonb_build_object('total_cost', v_cost, 'ends_at', v_ends);
end;
$$;

-- перевод слотов в active/expired
create or replace function refresh_attention_statuses()
returns void
language sql
as $$
  update attention_slots set status = 'expired'
    where status in ('scheduled','active') and ends_at <= now();
  update attention_slots set status = 'active'
    where status = 'scheduled' and starts_at <= now() and ends_at > now();
$$;

-- ---------- СИСТЕМНЫЕ СОБЫТИЯ ----------
create table if not exists system_events (
  id         uuid primary key default gen_random_uuid(),
  season_id  uuid references seasons(id) on delete cascade,
  kind       text not null check (kind in ('reset_done','season_warning','season_ended','season_started','custom')),
  content    text not null,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_system_events_season_created on system_events (season_id, created_at desc);

-- ---------- PUSH ----------
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  endpoint   text unique not null,
  keys       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_user on push_subscriptions (user_id);

-- ---------- СОХРАНЁННЫЕ ----------
create table if not exists saved_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  season_id  uuid references seasons(id),
  label      text not null default 'Сохранено из сезона',
  created_at timestamptz not null default now(),
  unique (user_id, message_id)
);
create index if not exists idx_saved_user on saved_messages (user_id, created_at desc);

-- ---------- РЕПОРТЫ (модерация) ----------
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references messages(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_reports_message on reports (message_id);

-- ---------- СТАТИСТИКА СЕЗОНА ----------
create table if not exists season_statistics (
  season_id       uuid primary key references seasons(id) on delete cascade,
  total_messages  int not null default 0,
  alive_messages  int not null default 0,
  dead_messages   int not null default 0,
  survived_total  int not null default 0,
  legendary_count int not null default 0,
  attention_slots int not null default 0,
  active_users    int not null default 0,
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- ДВИЖОК СЕЗОНОВ
-- =============================================================

-- Текущий активный сезон; если нет — создаёт новый.
create or replace function ensure_active_season(p_duration_seconds int default null)
returns seasons
language plpgsql
as $$
declare
  v_season seasons;
  v_dur int;
begin
  select * into v_season from seasons where status = 'active' order by number desc limit 1;
  if found then
    return v_season;
  end if;

  if p_duration_seconds is null or p_duration_seconds < 60 then
    v_dur := 604800;
  else
    v_dur := p_duration_seconds;
  end if;

  insert into seasons (number, status, started_at, ends_at, duration_seconds)
  values (coalesce((select max(number) + 1 from seasons), 1), 'active', now(), now() + make_interval(secs => v_dur), v_dur)
  returning * into v_season;

  insert into system_events (season_id, kind, content, meta)
  values (v_season.id, 'season_started',
          format('СЕЗОН #%s НАЧАЛСЯ. Мир жив. Пока что.', v_season.number),
          jsonb_build_object('season_number', v_season.number));

  insert into season_statistics (season_id) values (v_season.id) on conflict do nothing;

  return v_season;
end;
$$;

-- Ежедневный reset: ~50% активных сообщений погибает.
create or replace function daily_reset()
returns jsonb
language plpgsql
as $$
declare
  v_season seasons;
  v_alive uuid[];
  m uuid;
  v_total int;
  v_died int := 0;
  v_survived int := 0;
begin
  select * into v_season from seasons where status = 'active' order by number desc limit 1;
  if not found then
    raise exception 'Нет активного сезона';
  end if;

  if v_season.last_reset_at is not null and v_season.last_reset_at > now() - interval '60 seconds' then
    raise exception 'Reset уже выполнялся в последнюю минуту';
  end if;

  select array_agg(id) into v_alive
    from messages
    where season_id = v_season.id and status = 'active' and created_at < now() - interval '60 seconds';

  v_total := coalesce(array_length(v_alive, 1), 0);

  if v_total > 0 then
    foreach m in array v_alive loop
      if random() < 0.5 then
        update messages set status = 'dead', died_at = now() where id = m;
        v_died := v_died + 1;
      else
        update messages
          set status = case when survival_count + 1 >= 5 then 'legendary' else status end,
              survival_count = survival_count + 1,
              last_survived_at = now()
          where id = m;
        v_survived := v_survived + 1;
      end if;
    end loop;
  end if;

  update seasons set last_reset_at = now() where id = v_season.id;

  insert into system_events (season_id, kind, content, meta)
  values (v_season.id, 'reset_done',
          format('RESET ЗАВЕРШЁН. %s выжили. %s погибли.', v_survived, v_died),
          jsonb_build_object('survived', v_survived, 'died', v_died, 'candidates', v_total));

  update season_statistics s set
    total_messages = (select count(*) from messages where season_id = s.season_id),
    alive_messages = (select count(*) from messages where season_id = s.season_id and status in ('active','legendary')),
    dead_messages  = (select count(*) from messages where season_id = s.season_id and status = 'dead'),
    legendary_count = (select count(*) from messages where season_id = s.season_id and survival_count >= 5),
    survived_total = survived_total + v_survived,
    updated_at = now()
  where s.season_id = v_season.id;

  return jsonb_build_object('season_id', v_season.id, 'season_number', v_season.number,
                            'candidates', v_total, 'survived', v_survived, 'died', v_died);
end;
$$;

-- Смерть сезона.
create or replace function season_death()
returns jsonb
language plpgsql
as $$
declare
  v_season seasons;
  v_alive int;
  v_dead_total int;
begin
  select * into v_season from seasons where status = 'active' order by number desc limit 1;
  if not found then
    raise exception 'Нет активного сезона';
  end if;

  select count(*) into v_alive from messages
    where season_id = v_season.id and status in ('active','legendary');
  select count(*) into v_dead_total from messages where season_id = v_season.id and status = 'dead';

  update seasons set status = 'ended', ends_at = least(ends_at, now()) where id = v_season.id;

  insert into system_events (season_id, kind, content, meta)
  values (v_season.id, 'season_ended',
          format('СЕЗОН #%s ЗАВЕРШЁН. %s сообщений погибло. %s выжило.', v_season.number, v_dead_total, v_alive),
          jsonb_build_object('died_total', v_dead_total, 'alive_at_end', v_alive));

  update season_statistics s set
    alive_messages = 0,
    dead_messages = (select count(*) from messages where season_id = s.season_id),
    total_messages = (select count(*) from messages where season_id = s.season_id),
    updated_at = now()
  where s.season_id = v_season.id;

  return jsonb_build_object('ended_season', v_season.number,
                            'messages_died_total', v_dead_total,
                            'messages_survived_final', v_alive);
end;
$$;

-- Новый сезон после смерти предыдущего.
create or replace function next_season(p_duration_seconds int default null)
returns seasons
language plpgsql
as $$
declare
  v_prev int;
begin
  select max(number) into v_prev from seasons where status = 'ended';
  if v_prev is null then
    raise exception 'Нет завершённых сезонов';
  end if;
  if exists (select 1 from seasons where status = 'active') then
    raise exception 'Активный сезон уже существует';
  end if;
  return ensure_active_season(p_duration_seconds);
end;
$$;

-- Сохранение своего сообщения (макс 3 за сезон)
create or replace function save_my_message(p_user uuid, p_message uuid)
returns void
language plpgsql
as $$
declare
  v_author uuid;
  v_count int;
  v_season uuid;
begin
  select author_id, season_id into v_author, v_season from messages where id = p_message;
  if v_author is distinct from p_user then
    raise exception 'Можно сохранять только свои сообщения';
  end if;

  select count(*) into v_count from saved_messages where user_id = p_user and season_id = v_season;
  if v_count >= 3 then raise exception 'Максимум 3 сохранения на сезон'; end if;

  insert into saved_messages (user_id, message_id, season_id, label)
  values (p_user, p_message, v_season, 'Saved from Season')
  on conflict do nothing;
end;
$$;
