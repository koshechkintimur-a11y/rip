-- =============================================================
-- RIP · миграция 0018 — эхо участвует в следующих волнах
-- (не бессмертно: каждая волна — новый тест на выживание)
-- =============================================================

create or replace function resolve_attention_wave(p_season_id uuid)
returns int  -- сколько криков стало эхом (включая удержавших статус)
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

  -- кандидаты волны: активные, запланированные И эхо этого сезона.
  -- Эхо не бессмертно: каждая следующая волна — новый тест на выживание.
  for v_slot in
    select asl.id
    from attention_slots asl
    where asl.status in ('active','scheduled','echo')
      and (
        exists (select 1 from messages m where m.id = asl.message_id and m.season_id = p_season_id)
        or (asl.message_id is null and asl.created_at >= (select started_at from seasons where id = p_season_id))
      )
  loop
    select skull_count, echo_threshold into v_skulls, v_threshold
      from attention_slots where id = v_slot;

    if v_skulls >= v_threshold then
      -- эхо удерживает статус и копит волны; active/scheduled — становятся эхом
      update attention_slots
        set status = 'echo',
            waves_survived = waves_survived + 1,
            echo_threshold = echo_threshold
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
