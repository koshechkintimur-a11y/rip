-- =============================================================
-- RIP · миграция 0019 — Survival Engine v1 (фундамент)
--
-- Единый язык RIP: 💀 = голос за жизнь.
-- Каждое действие пользователя — сигнал, который строит
-- Survival Profile: чему пользователь помогает жить.
--
-- 1) interaction_events — единый event layer
--    (content_type: message | shout; action: impression|open|reply|skull|repost)
-- 2) author_affinities — авторская аффинити с затуханием
-- 3) записи событий из существующих действий (черепок, ответ, репост)
-- =============================================================

-- 1. Единый event layer
create table if not exists interaction_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  content_id   uuid not null,
  content_type text not null check (content_type in ('message','shout')),
  action       text not null check (action in ('impression','open','reply','skull','repost','thread_open')),
  created_at   timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb
);
create index if not exists idx_interaction_events_user on interaction_events (user_id, created_at desc);
create index if not exists idx_interaction_events_content on interaction_events (content_id, action);

-- 2. Авторская аффинити (score 0..1, затухает со временем)
create table if not exists author_affinities (
  user_id    uuid not null references profiles(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  score      numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, author_id)
);

-- 3. Усиление аффинити при действии (с затуханием старого)
--    weight: черепок 0.5, ответ 0.4, репост 0.7 (стартовые, конфигурируемые)
create or replace function bump_author_affinity(
  p_user uuid,
  p_author uuid,
  p_weight numeric,
  p_max numeric default 1.0
)
returns void
language plpgsql
as $$
begin
  if p_user = p_author then return; end if;  -- себя не считаем
  insert into author_affinities (user_id, author_id, score, updated_at)
  values (p_user, p_author, least(p_weight, p_max), now())
  on conflict (user_id, author_id) do update set
    score = least(
      (author_affinities.score * 0.9) + p_weight,  -- затухание старого
      p_max
    ),
    updated_at = now();
end;
$$;

-- 4. Триггер: черепок на сообщении усиливает аффинити к автору
create or replace function trg_reaction_affinity()
returns trigger
language plpgsql
as $$
declare
  v_author uuid;
begin
  select author_id into v_author from messages where id = NEW.message_id;
  if v_author is not null then
    perform bump_author_affinity(NEW.user_id, v_author, 0.5);
    insert into interaction_events (user_id, content_id, content_type, action)
    values (NEW.user_id, NEW.message_id, 'message', 'skull')
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_reaction_affinity on reactions;
create trigger trg_reaction_affinity after insert on reactions
  for each row execute function trg_reaction_affinity();

-- 5. Черепок на крике: тот же сигнал, но на слот внимания
create or replace function trg_attention_skull_affinity()
returns trigger
language plpgsql
as $$
declare
  v_author uuid;
begin
  select user_id into v_author from attention_slots where id = NEW.slot_id;
  if v_author is not null then
    perform bump_author_affinity(NEW.user_id, v_author, 0.5);
    insert into interaction_events (user_id, content_id, content_type, action)
    values (NEW.user_id, NEW.slot_id, 'shout', 'skull')
    on conflict do nothing;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_attention_skull_affinity on attention_reactions;
create trigger trg_attention_skull_affinity after insert on attention_reactions
  for each row execute function trg_attention_skull_affinity();

-- 6. Ответ/репост на сообщении = сигнал аффинити + событие
--    (репост = messages.repost_of_id, ответ = messages.parent_message_id)
create or replace function trg_reply_affinity()
returns trigger
language plpgsql
as $$
declare
  v_target_author uuid;
  v_action text;
begin
  if NEW.repost_of_id is not null then
    -- репост: самый сильный сигнал (0.7)
    select author_id into v_target_author from messages where id = NEW.repost_of_id;
    v_action := 'repost';
    if v_target_author is not null then
      perform bump_author_affinity(NEW.author_id, v_target_author, 0.7);
    end if;
  elsif NEW.parent_message_id is not null then
    -- ответ: 0.4
    select author_id into v_target_author from messages where id = NEW.parent_message_id;
    v_action := 'reply';
    if v_target_author is not null then
      perform bump_author_affinity(NEW.author_id, v_target_author, 0.4);
    end if;
  end if;

  if v_action is not null and v_target_author is not null then
    insert into interaction_events (user_id, content_id, content_type, action, meta)
    values (NEW.author_id, NEW.id, 'message', v_action,
            jsonb_build_object('target_id', coalesce(NEW.repost_of_id, NEW.parent_message_id)));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_reply_affinity on messages;
create trigger trg_reply_affinity after insert on messages
  for each row execute function trg_reply_affinity();

-- 7. Черепок = событие skull (уже есть в trg_reaction_affinity), репостов
--    отдельной таблицы нет — логика в trg_reply_affinity выше.
