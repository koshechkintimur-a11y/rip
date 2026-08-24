-- =============================================================
-- RIP · миграция 0011 — сообщения из ленты внимания скрыты из чата
-- =============================================================

-- Крики внимания (покупка без messageId) создают сообщение, чтобы карточка
-- открывала ветку по тапу. Но оно не должно попадать в обычную ленту чата.
alter table messages add column if not exists feed_hidden boolean not null default false;
create index if not exists idx_messages_feed on messages (season_id, feed_hidden, created_at desc);
