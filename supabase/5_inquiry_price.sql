-- السعر المتفق عليه فى الاستعلام وإتمام الشراء بيه: يتنفذ مرة واحدة فى Supabase → SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

alter table public.inquiries add column if not exists price numeric(12, 2) check (price is null or price >= 0);
alter table public.inquiries add column if not exists order_id bigint references public.orders (id) on delete set null;

-- العميل يشوف استعلاماته بالسعر المتفق عليه
drop function if exists public.my_inquiries(uuid[]);
create function public.my_inquiries(p_tokens uuid[])
returns table (token uuid, question text, photo_url text, part_name text, part_id bigint, answer text, price numeric, ordered boolean, answered_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.token, i.question, i.photo_url, i.part_name, i.part_id, i.answer, i.price, i.order_id is not null, i.answered_at, i.created_at
  from public.inquiries i
  where i.token = any (p_tokens) and coalesce(cardinality(p_tokens), 0) <= 50
  order by i.created_at desc;
$$;
revoke all on function public.my_inquiries(uuid[]) from public;
grant execute on function public.my_inquiries(uuid[]) to anon, authenticated;

-- تسجيل الطلب: قطع بسعرها المعروض + استعلامات بالسعر المتفق عليه (السعر دايما من قاعدة البيانات)
drop function if exists public.place_order(text, text, text, text, text, text, bigint[]);
create or replace function public.place_order(
  p_name text, p_phone text, p_city text, p_address text, p_notes text, p_pay text,
  p_part_ids bigint[], p_inquiry_tokens uuid[] default '{}'
) returns bigint
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
begin
  p_name := btrim(coalesce(p_name, ''));
  p_city := btrim(coalesce(p_city, ''));
  p_address := btrim(coalesce(p_address, ''));
  p_notes := btrim(coalesce(p_notes, ''));
  if length(p_name) not between 2 and 100 or length(p_city) not between 2 and 60
     or length(p_address) not between 3 and 300 or length(p_notes) > 500 then
    raise exception 'بيانات الطلب غير مكتملة';
  end if;
  if coalesce(p_phone, '') !~ '^01[0125][0-9]{8}$' then
    raise exception 'رقم الموبايل غير صحيح';
  end if;
  if p_pay is null or p_pay not in ('cod', 'transfer', 'pickup') then
    raise exception 'طريقة الدفع غير صحيحة';
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
  returning id into v_id;
  update public.inquiries set order_id = v_id where token = any (v_tokens);
  return v_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, bigint[], uuid[]) from public;
grant execute on function public.place_order(text, text, text, text, text, text, bigint[], uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
