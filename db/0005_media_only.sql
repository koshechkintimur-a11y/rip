-- =============================================================
-- RIP · миграция 0005 — media-only сообщения (снять CHECK на content)
-- Позволяет отправлять сообщение только с медиа (без текста)
-- =============================================================

alter table messages drop constraint if exists messages_content_check;
alter table messages add constraint messages_content_check check (char_length(content) <= 500);

alter table direct_messages drop constraint if exists direct_messages_content_check;
alter table direct_messages add constraint direct_messages_content_check check (char_length(content) <= 1000);
