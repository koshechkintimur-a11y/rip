-- =============================================================
-- RIP · миграция 0013 — механика выживания (Слой 2)
--
-- 1) Формула шанса: 0.3 + черепки×0.04 + ответы×0.04 + бонус, clamp [0.05, 0.95]
--    (раньше было чистое random()<0.5 — черепки НЕ влияли, UI врал)
-- 2) Новичковый буст ×2 — первые 3 поста автора в сезоне
-- 3) Гарантия «мир помнит» — если у автора >3 постов, минимум один
--    переживёт каждую волну (защита от фрустрации «умерло всё»)
-- 4) Черепки переживают смерть мира — в конце сезона реакции конвертируются
--    в survival_bonus на следующий сезон (антитупик мотивации)
-- =============================================================

alter table profiles add column if not exists survival_bonus numeric not null default 0;

-- ------------------------------------------------------------------
-- daily_reset: волна с честной формулой шанса
-- ------------------------------------------------------------------
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
  v_post_no int;        -- порядковый номер поста автора в сезоне (для новичкового буста)
  v_author_posts int;   -- сколько всего постов у автора в сезоне (для гарантии)
  v_survived_any int;   -- выжил ли хоть один пост автора в эту волну
  v_rescue uuid;        -- пост для гарантии «мир помнит»
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

      -- формула: 0.3 + черепки×0.04 + ответы×0.04 + бонус прошлых сезонов
      v_chance := 0.3 + v_reactions * 0.04 + v_replies * 0.04 + coalesce(v_bonus, 0);
      -- новичковый буст: первые 3 поста автора в сезоне — шанс ×2
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

    -- ГАРАНТИЯ «мир помнит»: автор с >3 постами, у которого ВСЕ погибли,
    -- получает один воскресший пост (самый свежий)
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

-- ------------------------------------------------------------------
-- season_death: черепки переживают смерть мира → survival_bonus
-- ------------------------------------------------------------------
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
