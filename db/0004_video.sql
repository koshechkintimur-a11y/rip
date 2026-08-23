-- =============================================================
-- RIP · миграция 0004 — видео в медиа
-- =============================================================

-- снять старое ограничение и добавить video
alter table messages drop constraint if exists messages_media_type_check;
alter table messages add constraint messages_media_type_check check (media_type in ('image','gif','video'));
