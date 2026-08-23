-- =============================================================
-- RIP · миграция 0003 — медиа в ЛС (дополнение, применяется после 0002)
-- =============================================================

alter table direct_messages add column if not exists media_url text;
alter table direct_messages add column if not exists media_type text;
