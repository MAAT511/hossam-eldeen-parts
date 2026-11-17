-- دورة الدفع والاستلام بكود: يتنفذ مرة واحدة فى Supabase → SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

-- ===== أعمدة جديدة فى الطلبات =====
alter table public.orders add column if not exists token uuid not null default gen_random_uuid();
create unique index if not exists orders_token_key on public.orders (token);
alter table public.orders add column if not exists pickup_code text;
alter table public.orders add column if not exists confirmed_at timestamptz;

-- ===== طرق الدفع الجديدة =====
alter table public.orders drop constraint if exists orders_pay_method_check;
update public.orders set pay_method = 'shop_cash' where pay_method in ('cod', 'pickup');
update public.orders set pay_method = 'transfer_ship' where pay_method = 'transfer';
alter table public.orders add constraint orders_pay_method_check
  check (pay_method in ('shop_cash', 'transfer_pickup', 'transfer_ship'));

-- ===== حالات الطلب الجديدة =====
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status = 'ready' where status = 'confirmed';
update public.orders set status = 'done' where status = 'delivered';
alter table public.orders add constraint orders_status_check
  check (status in ('new', 'ready', 'done', 'cancelled'));

-- ===== تسجيل الطلب: يرجع رقم الطلب ورمز سرى يشوف بيه العميل طلبه بعدين =====
drop function if exists public.place_order(text, text, text, text, text, text, bigint[]);
drop function if exists public.place_order(text, text, text, text, text, text, bigint[], uuid[]);
create function public.place_order(
  p_name text, p_phone text, p_city text, p_address text, p_notes text, p_pay text,
  p_part_ids bigint[], p_inquiry_tokens uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_tokens uuid[];
  v_ids bigint[];
  v_items jsonb;
  v_total numeric;
  v_count int;
  v_qitems jsonb;
  v_qtotal numeric;
  v_qcount int;
  v_id bigint;
  v_token uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  p_city := btrim(coalesce(p_city, ''));
  p_address := btrim(coalesce(p_address, ''));
  p_notes := btrim(coalesce(p_notes, ''));
  if p_pay is null or p_pay not in ('shop_cash', 'transfer_pickup', 'transfer_ship') then
    raise exception 'طريقة الدفع غير صحيحة';
  end if;
  if length(p_name) > 100 or length(p_notes) > 500 then
    raise exception 'بيانات الطلب غير مكتملة';
  end if;
  if coalesce(p_phone, '') !~ '^01[0125][0-9]{8}$' then
    raise exception 'رقم الموبايل غير صحيح';
  end if;
  -- العنوان مطلوب فى الشحن بس، والاستلام من المحل مالوش عنوان
  if p_pay = 'transfer_ship' then
    if length(p_city) not between 2 and 60 or length(p_address) not between 3 and 300 then
      raise exception 'اكتب المحافظة والعنوان بالتفصيل';
    end if;
  else
    p_city := 'استلام من المحل';
    p_address := 'استلام من المحل';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_tokens from unnest(coalesce(p_inquiry_tokens, '{}')) as x;
  -- القطعة اللى ليها استعلام بسعر متفق عليه تتحسب مرة واحدة بسعر الاستعلام
  select coalesce(array_agg(distinct x), '{}') into v_ids
    from unnest(coalesce(p_part_ids, '{}')) as x
    where x not in (select i.part_id from public.inquiries i where i.token = any (v_tokens) and i.part_id is not null);
  if cardinality(v_ids) + cardinality(v_tokens) = 0 or cardinality(v_ids) + cardinality(v_tokens) > 30 then
    raise exception 'السلة فاضية أو فيها قطع كتير';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'model', model, 'price', price) order by id), '[]'::jsonb),
         coalesce(sum(price), 0), count(*)
    into v_items, v_total, v_count
    from public.parts where id = any (v_ids) and not sold;
  if v_count <> cardinality(v_ids) then
    raise exception 'بعض القطع اتباعت أو مش موجودة';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.part_id, 'inquiry_id', i.id,
           'name', case when i.part_name <> '' then i.part_name else 'قطعة من صور المحل' end,
           'brand', '', 'model', '', 'question', i.question, 'photo_url', i.photo_url, 'price', i.price) order by i.id), '[]'::jsonb),
         coalesce(sum(i.price), 0), count(*)
    into v_qitems, v_qtotal, v_qcount
    from public.inquiries i
    left join public.parts p on p.id = i.part_id
    where i.token = any (v_tokens) and i.price is not null and i.price > 0 and i.order_id is null
      and (i.part_id is null or (p.id is not null and not p.sold));
  if v_qcount <> cardinality(v_tokens) then
    raise exception 'بعض القطع المتفق على سعرها مش متاحة أو اتطلبت قبل كده';
  end if;

  insert into public.orders (customer_name, phone, city, address, notes, pay_method, items, total)
  values (p_name, p_phone, p_city, p_address, p_notes, p_pay, v_items || v_qitems, v_total + v_qtotal)
  returning id, token into v_id, v_token;
  update public.inquiries set order_id = v_id where token = any (v_tokens);
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;
revoke all on function public.place_order(text, text, text, text, text, text, bigint[], uuid[]) from public;
grant execute on function public.place_order(text, text, text, text, text, text, bigint[], uuid[]) to anon, authenticated;

-- ===== العميل يشوف طلباته هو بس بالرموز المحفوظة على موبايله =====
create or replace function public.my_orders(p_tokens uuid[])
returns table (token uuid, id bigint, items jsonb, total numeric, pay_method text, status text, pickup_code text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.token, o.id, o.items, o.total, o.pay_method, o.status,
         case when o.status = 'ready' then o.pickup_code else null end,
         o.created_at
  from public.orders o
  where o.token = any (p_tokens) and coalesce(cardinality(p_tokens), 0) <= 50
  order by o.created_at desc;
$$;
revoke all on function public.my_orders(uuid[]) from public;
grant execute on function public.my_orders(uuid[]) to anon, authenticated;

-- ===== المحل يأكد الطلب: يتولد كود استلام والقطع تتحجز =====
create or replace function public.admin_confirm_order(p_id bigint) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb;
  v_code text;
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  select items into v_items from public.orders where id = p_id and status = 'new';
  if not found then raise exception 'الطلب مش موجود أو متأكد قبل كده'; end if;
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  update public.orders set status = 'ready', pickup_code = v_code, confirmed_at = now() where id = p_id;
  -- القطع تتعلم «تم البيع» عشان ماتتباعش لعميل تانى وهى محجوزة
  update public.parts set sold = true
   where id in (select (x->>'id')::bigint from jsonb_array_elements(v_items) x where (x->>'id') is not null);
  return v_code;
end;
$$;

-- ===== المحل يسلم الطلب: الكود اللى العميل بيوريه لازم يطابق =====
create or replace function public.admin_complete_order(p_id bigint, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  select pickup_code into v_code from public.orders where id = p_id and status = 'ready';
  if not found then raise exception 'الطلب مش جاهز للتسليم'; end if;
  if p_code is not null and btrim(p_code) <> v_code then raise exception 'كود الاستلام غلط'; end if;
  update public.orders set status = 'done' where id = p_id;
end;
$$;

-- ===== إلغاء الطلب: القطع ترجع متاحة والاستعلام يرجع مفتوح =====
create or replace function public.admin_cancel_order(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare v_items jsonb;
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  select items into v_items from public.orders where id = p_id and status <> 'cancelled';
  if not found then raise exception 'الطلب مش موجود أو ملغى قبل كده'; end if;
  update public.orders set status = 'cancelled', pickup_code = null where id = p_id;
  update public.inquiries set order_id = null where order_id = p_id;
  update public.parts p set sold = false
   where p.id in (select (x->>'id')::bigint from jsonb_array_elements(v_items) x where (x->>'id') is not null)
     and not exists (
       select 1 from public.orders o2, jsonb_array_elements(o2.items) y
        where o2.id <> p_id and o2.status <> 'cancelled' and (y->>'id') is not null and (y->>'id')::bigint = p.id
     );
end;
$$;

revoke all on function public.admin_confirm_order(bigint) from public;
grant execute on function public.admin_confirm_order(bigint) to authenticated;
revoke all on function public.admin_complete_order(bigint, text) from public;
grant execute on function public.admin_complete_order(bigint, text) to authenticated;
revoke all on function public.admin_cancel_order(bigint) from public;
grant execute on function public.admin_cancel_order(bigint) to authenticated;

notify pgrst, 'reload schema';
