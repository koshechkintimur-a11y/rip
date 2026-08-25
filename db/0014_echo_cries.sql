-- =============================================================
-- RIP · миграция 0014 — Эхо криков (фундамент)
--
-- 💀 = голос за жизнь. Черепок на крике помогает ему пережить волну.
-- Крик может стать Эхом: ≥ echo_threshold черепков на момент волны.
-- Эхо НЕ бессмертно: каждая следующая волна — новый тест.
-- Волна (daily_reset) — authoritative event lifecycle, не expires_at.
-- =============================================================

-- 1. Слоты: черепки, статусы echo/dead, счётчик волн, порог (конфиг)
alter table attention_slots
  add column if not exists skull_count     int  not null default 0,
  add column if not exists waves_survived  int  not null default 0,
  add column if not exists echo_threshold  int  not null default 1000;

-- статусы: scheduled → active → (expired | echo | dead)
do $$
begin
  alter table attention_slots drop constraint if exists attention_slots_status_check;
exception when others then null;
end $$;

alter table attention_slots
  add constraint attention_slots_status_check
  check (status in ('scheduled','active','expired','echo','dead'));

-- 2. Черепки на слоты: один юзер = один черепок; свой крик не черепим
create table if not exists attention_reactions (
  id         uuid primary key default gen_random_uuid(),
  slot_id    uuid not null references attention_slots(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (slot_id, user_id)
);
create index if not exists idx_attention_reactions_slot on attention_reactions (slot_id);

-- 3. refresh_attention_statuses: эхо не умирает от expires_at,
--    только активные крики истекают по времени
create or replace function refresh_attention_statuses()
returns void
language plpgsql
as $$
begin
  -- scheduled → active (наступило время показа)
  update attention_slots set status = 'active'
    where status = 'scheduled' and starts_at <= now();

  -- active → expired (время показа закончилось; эхо не трогаем)
  update attention_slots set status = 'expired'
    where status = 'active' and ends_at <= now();
end;
$$;

-- 4. Волна решает судьбу криков: ≥ порога → ECHO (+волна), иначе → DEAD
--    Первое эхо сезона → системное событие
create or replace function resolve_attention_wave(p_season_id uuid)
returns int  -- сколько криков стало эхом
language plpgsql
as $$
declare
  v_echo_count int := 0;
  v_had_echo_before int;
  v_slot uuid;
  v_skulls int;
  v_threshold int;
  v_max_skulls int := 0;
begin
  -- сначала добиваем истёкшие (чтобы они не лезли в судьбу волны)
  perform refresh_attention_statuses();

  -- кандидаты волны: активные крики этого сезона (через сообщение или по времени)
  for v_slot in
    select asl.id
    from attention_slots asl
    where asl.status = 'active'
      and (
        exists (select 1 from messages m where m.id = asl.message_id and m.season_id = p_season_id)
        or (asl.message_id is null and asl.created_at >= (select started_at from seasons where id = p_season_id))
      )
  loop
    select skull_count, echo_threshold into v_skulls, v_threshold
      from attention_slots where id = v_slot;

    if v_skulls >= v_threshold then
      update attention_slots
        set status = 'echo', waves_survived = waves_survived + 1
        where id = v_slot;
      v_echo_count := v_echo_count + 1;
      if v_skulls > v_max_skulls then v_max_skulls := v_skulls; end if;
    else
      update attention_slots set status = 'dead' where id = v_slot;
    end if;
  end loop;

  -- «первое эхо сезона» — событие в мир
  if v_echo_count > 0 then
    select count(*) into v_had_echo_before from system_events
      where season_id = p_season_id and kind = 'first_echo';
    if v_had_echo_before = 0 then
      insert into system_events (season_id, kind, content, meta)
      values (p_season_id, 'first_echo',
              format('🟡 РОДИЛОСЬ ПЕРВОЕ ЭХО. Крик пережил волну, собрав %s черепков.', v_max_skulls),
              jsonb_build_object('echo_count', v_echo_count));
    end if;
  end if;

  return v_echo_count;
end;
$$;

-- 5. Смерть сезона: все крики умирают вместе с миром (эхо — тоже)
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

  -- черепки конвертируются в буст шанса на следующий сезон (макс +0.3)
  update profiles p set survival_bonus = least(
    coalesce(p.survival_bonus, 0) + coalesce((
      select sum(reaction_count) from messages
      where author_id = p.id and season_id = v_season.id
    ), 0) / 100.0,
    0.3
  );

  -- крики умирают вместе с миром
  update attention_slots set status = 'dead'
    where status in ('active','scheduled','echo');

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

-- 6. Обновление daily_reset: добавить судьбу криков (resolve_attention_wave)
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
  v_chance numeric;
  v_author uuid;
  v_reactions int;
  v_replies int;
  v_bonus numeric;
  v_post_no int;
  v_author_posts int;
  v_survived_any int;
  v_rescue uuid;
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
      select author_id, reaction_count into v_author, v_reactions from messages where id = m;
      select count(*) into v_replies from messages where parent_message_id = m;
      select survival_bonus into v_bonus from profiles where id = v_author;
      select count(*) into v_post_no from messages
        where author_id = v_author and season_id = v_season.id and created_at <= (select created_at from messages where id = m);

      v_chance := 0.3 + v_reactions * 0.04 + v_replies * 0.04 + coalesce(v_bonus, 0);
      if v_post_no <= 3 then
        v_chance := v_chance * 2;
      end if;
      v_chance := greatest(least(v_chance, 0.95), 0.05);

      if random() < v_chance then
        update messages
          set status = case when survival_count + 1 >= 5 then 'legendary' else status end,
              survival_count = survival_count + 1,
              last_survived_at = now()
          where id = m;
        v_survived := v_survived + 1;
      else
        update messages set status = 'dead', died_at = now() where id = m;
        v_died := v_died + 1;
      end if;
    end loop;

    for v_author in
      select distinct author_id from messages
      where id = any(v_alive) and status = 'dead'
    loop
      select count(*) into v_author_posts from messages
        where author_id = v_author and season_id = v_season.id;
      if v_author_posts > 3 then
        select count(*) into v_survived_any from messages
          where author_id = v_author and season_id = v_season.id
            and last_survived_at = now();
        if v_survived_any = 0 then
          select id into v_rescue from messages
            where author_id = v_author and season_id = v_season.id and status = 'dead'
            order by created_at desc limit 1;
          if v_rescue is not null then
            update messages
              set status = case when survival_count + 1 >= 5 then 'legendary' else 'active' end,
                  survival_count = survival_count + 1,
                  last_survived_at = now(),
                  died_at = null
              where id = v_rescue;
            v_survived := v_survived + 1;
            v_died := v_died - 1;
          end if;
        end if;
      end if;
    end loop;
  end if;

  update seasons set last_reset_at = now() where id = v_season.id;

  -- судьба криков: активные слоты → эхо или смерть
  perform resolve_attention_wave(v_season.id);

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
