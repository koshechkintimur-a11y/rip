-- =============================================================
-- RIP · миграция 0021 — SEC-005: запрет повторного репоста
-- unique (author_id, repost_of_id): один юзер = один репост сообщения.
-- Повторный репост → нарушение constraint → route вернёт 409.
-- =============================================================

-- чистим существующие дубли (оставляем самый ранний)
delete from messages a using messages b
where a.repost_of_id = b.repost_of_id
  and a.author_id = b.author_id
  and a.repost_of_id is not null
  and a.created_at > b.created_at;

create unique index if not exists uq_messages_repost
  on messages (author_id, repost_of_id)
  where repost_of_id is not null;
