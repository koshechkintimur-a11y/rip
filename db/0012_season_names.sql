-- =============================================================
-- RIP · миграция 0012 — имена сезонов («Пепел», «Тишина», «Сквозняк»…)
-- =============================================================

alter table seasons add column if not exists name text;

-- генератор имени: выбирает из пула, избегая повтора с последним сезоном
create or replace function pick_season_name()
returns text
language plpgsql
as $$
declare
  v_names text[] := array[
    'Пепел', 'Тишина', 'Сквозняк', 'Иней', 'Пыль', 'Сумерки',
    'Забвение', 'Полустанок', 'Тлен', 'Эхо', 'Мимолётность',
    'Ржавчина', 'Пауза', 'Истома', 'Недолгая память', 'Дым',
    'Пустота', 'Седой', 'Мёртвый час', 'Выцветший', 'Поздний свет'
  ];
  v_last text;
  v_name text;
begin
  select name into v_last from seasons where name is not null order by number desc limit 1;
  loop
    v_name := v_names[1 + floor(random() * array_length(v_names, 1))::int];
    exit when v_name <> v_last or v_last is null;
  end loop;
  return v_name;
end;
$$;

-- ensure_active_season: имя при создании нового сезона
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

  insert into seasons (number, status, started_at, ends_at, duration_seconds, name)
  values (
    coalesce((select max(number) + 1 from seasons), 1),
    'active', now(), now() + make_interval(secs => v_dur), v_dur,
    pick_season_name()
  )
  returning * into v_season;

  insert into system_events (season_id, kind, content, meta)
  values (v_season.id, 'season_started',
          format('СЕЗОН #%s «%s» НАЧАЛСЯ. Мир жив. Пока что.', v_season.number, v_season.name),
          jsonb_build_object('season_number', v_season.number, 'season_name', v_season.name));

  insert into season_statistics (season_id) values (v_season.id) on conflict do nothing;

  return v_season;
end;
$$;

-- next_season: тоже даёт имя
create or replace function next_season(p_duration_seconds int default null)
returns seasons
language plpgsql
as $$
declare
  v_prev int;
  v_season seasons;
  v_dur int;
begin
  select number into v_prev from seasons order by number desc limit 1;
  v_prev := coalesce(v_prev, 0);

  if p_duration_seconds is null or p_duration_seconds < 60 then
    v_dur := 604800;
  else
    v_dur := p_duration_seconds;
  end if;

  insert into seasons (number, status, started_at, ends_at, duration_seconds, name)
  values (v_prev + 1, 'active', now(), now() + make_interval(secs => v_dur), v_dur, pick_season_name())
  returning * into v_season;

  insert into season_statistics (season_id) values (v_season.id) on conflict do nothing;
  return v_season;
end;
$$;

-- ретрофилл: старые сезоны без имени
update seasons set name = pick_season_name()
where name is null
  and not exists (select 1 from seasons s2 where s2.number < seasons.number and s2.name = seasons.name);
