-- =============================================================
-- RIP · миграция 0017 — system_events.kind: добавляем first_echo
-- =============================================================

alter table system_events drop constraint if exists system_events_kind_check;

alter table system_events
  add constraint system_events_kind_check
  check (kind in ('reset_done','season_warning','season_ended','season_started','custom','first_echo'));
