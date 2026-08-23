-- =============================================================
-- RIP · миграция 0002 — медиа в attention-слотах + карточки ленты
-- =============================================================

alter table attention_slots add column if not exists media_url text;
alter table attention_slots add column if not exists media_type text;

alter table direct_messages add column if not exists media_url text;
alter table direct_messages add column if not exists media_type text;

-- Обновлённая покупка: с опциональным медиа (миниатюра в карточке)
create or replace function purchase_attention(
  p_user uuid,
  p_content text,
  p_slots int,
  p_minutes int,
  p_media_url text default null,
  p_media_type text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_unit_price int := 20;
  v_balance int;
  v_cost int;
  v_base timestamptz;
  v_ends timestamptz;
  v_per_slot interval;
  v_text text;
  v_pos int;
  i int;
begin
  v_text := trim(coalesce(p_content, ''));
  if v_text = '' then raise exception 'Пустой текст'; end if;
  if char_length(v_text) > 80 then raise exception 'Слишком длинный текст (макс 80)'; end if;
  if p_slots < 1 or p_slots > 5 then raise exception 'Слотов: 1-5'; end if;
  if p_minutes < 10 or p_minutes > 120 or p_minutes % 10 <> 0 then raise exception 'Длительность: 10-120 мин, кратно 10'; end if;

  v_cost := v_unit_price * (p_minutes / 10) * p_slots;

  select balance into v_balance from wallets where user_id = p_user for update;
  if v_balance is null then raise exception 'Кошелёк не найден'; end if;
  if v_balance < v_cost then raise exception 'Недостаточно монет'; end if;

  select max(ends_at) into v_base
    from attention_slots
    where status in ('scheduled','active') and ends_at > now();

  v_base := coalesce(v_base, now());
  v_per_slot := make_interval(mins => (p_minutes::numeric / p_slots)::int);
  v_ends := v_base + make_interval(mins => p_minutes::int);
  v_pos := coalesce((select max(position)+1 from attention_slots where status in ('scheduled','active')), 0);

  for i in 1..p_slots loop
    insert into attention_slots (user_id, message_id, content, position, starts_at, ends_at, price, status, media_url, media_type)
    values (p_user, null, v_text, v_pos + i - 1, v_base + (i-1)*v_per_slot, v_base + i*v_per_slot,
            v_unit_price * (p_minutes / 10), 'scheduled', p_media_url, p_media_type);
  end loop;

  update wallets set balance = balance - v_cost where user_id = p_user;
  insert into wallet_transactions (user_id, amount, kind, description)
    values (p_user, -v_cost, 'purchase_attention', format('Внимание: %s слот(ов) × %s мин', p_slots, p_minutes));

  return jsonb_build_object('total_cost', v_cost, 'ends_at', v_ends);
end;
$$;
