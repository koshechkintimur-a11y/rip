-- =============================================================
-- RIP · миграция 0006 — репосты, шанс выживания от черепков
-- =============================================================

-- 1. Репосты: сообщение может быть репостом другого сообщения
alter table messages add column if not exists repost_of_id uuid references messages(id) on delete set null;
create index if not exists idx_messages_repost_of on messages(repost_of_id);

-- 1b. Отметка «просмотрено» для уведомлений о реакциях
alter table messages add column if not exists last_seen_at timestamptz;

-- 2. Обновляем daily_reset — шанс выживания зависит от черепков
--    Вместо random() < 0.5 → random() < 0.3 + reaction_count * 0.07, но не менее 0.05 и не более 0.95
create or replace function daily_reset() returns jsonb as $$
declare
  v_season record;
  v_survived int := 0;
  v_died int := 0;
  v_prob float;
  v_msg record;
begin
  -- находим активный сезон
  select * into v_season from seasons where status = 'active' limit 1;
  if not found then return jsonb_build_object('error', 'no active season'); end if;

  -- системное событие о начале reset
  insert into system_events (season_id, kind, content)
  values (v_season.id, 'reset_done', '🟢 RESET...');

  -- проходим по всем активным сообщениям сезона
  for v_msg in
    select id, reaction_count from messages
    where season_id = v_season.id and status = 'active'
    loop
      -- шанс выживания: базовый 0.3 + 0.07 за каждый черепок, не менее 0.05 и не более 0.95
      v_prob := least(0.95, greatest(0.05, 0.3 + v_msg.reaction_count * 0.07));
      if random() < v_prob then
        update messages set survival_count = survival_count + 1, last_survived_at = now()
        where id = v_msg.id;
        v_survived := v_survived + 1;
      else
        update messages set status = 'dead', died_at = now()
        where id = v_msg.id;
        v_died := v_died + 1;
      end if;
    end loop;

  -- обновляем статистику сезона
  update seasons set last_reset_at = now() where id = v_season.id;

  -- системное событие с результатом
  insert into system_events (season_id, kind, content)
  values (v_season.id, 'reset_done',
    format('🟢 RESET ЗАВЕРШЁН. %s сообщений выжили, %s погибли.', v_survived, v_died));

  return jsonb_build_object('survived', v_survived, 'died', v_died);
end;
$$ language plpgsql;