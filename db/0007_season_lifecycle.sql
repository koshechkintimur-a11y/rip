-- =============================================================
-- RIP · миграция 0007 — season lifecycle: death → new season
-- =============================================================

-- 1. Исправляем season_death: active → dead, legendary остаются
create or replace function season_death()
returns jsonb
language plpgsql
as $$
declare
  v_season seasons;
  v_active int;
  v_legendary int;
  v_dead_total int;
begin
  select * into v_season from seasons where status = 'active' order by number desc limit 1;
  if not found then
    raise exception 'Нет активного сезона';
  end if;

  -- финализация сообщений: active → dead, legendary остаются
  update messages set status = 'dead', died_at = coalesce(died_at, now())
  where season_id = v_season.id and status = 'active';

  select count(*) into v_legendary from messages
    where season_id = v_season.id and status = 'legendary';
  select count(*) into v_dead_total from messages where season_id = v_season.id and status = 'dead';

  update seasons set status = 'ended', ends_at = least(ends_at, now()) where id = v_season.id;

  insert into system_events (season_id, kind, content, meta)
  values (v_season.id, 'season_ended',
          format('СЕЗОН #%s ЗАВЕРШЁН. %s сообщений погибло. %s легендарных сохранилось.', v_season.number, v_dead_total, v_legendary),
          jsonb_build_object('died_total', v_dead_total, 'legendary_kept', v_legendary));

  update season_statistics s set
    alive_messages = 0,
    dead_messages = (select count(*) from messages where season_id = s.season_id),
    total_messages = (select count(*) from messages where season_id = s.season_id),
    updated_at = now()
  where s.season_id = v_season.id;

  return jsonb_build_object(
    'ended_season', v_season.number,
    'messages_died_total', v_dead_total,
    'messages_survived_final', v_legendary
  );
end;
$$;

-- 2. Улучшаем ensure_active_season: при смерти сезона новый создаётся автоматически
--    (Функция уже корректно работает, оставляем как есть)

-- 3. Функция для полного цикла смерти + рождения нового сезона
create or replace function death_and_new_season(p_duration_seconds int default null)
returns jsonb
language plpgsql
as $$
declare
  v_death jsonb;
  v_season seasons;
begin
  v_death := season_death();
  v_season := ensure_active_season(p_duration_seconds);
  return jsonb_build_object(
    'ended_season', v_death->>'ended_season',
    'messages_died_total', v_death->>'messages_died_total',
    'new_season_id', v_season.id,
    'new_season_number', v_season.number
  );
end;
$$;