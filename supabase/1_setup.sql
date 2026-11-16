-- إعداد قاعدة بيانات المتجر: يتنفذ مرة واحدة فى Supabase → SQL Editor
-- آمن لو اتنفذ أكتر من مرة

-- ===== الأدمن =====
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ===== القطع =====
create table if not exists public.parts (
  id bigint generated always as identity primary key,
  name text not null,
  brand text not null default '',
  model text not null default '',
  year_from int,
  year_to int,
  category text not null default '',
  condition text not null default 'جيدة',
  price numeric(12, 2) not null default 0 check (price >= 0),
  sold boolean not null default false,
  description text not null default '',
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ===== الطلبات =====
create table if not exists public.orders (
  id bigint generated always as identity primary key,
  customer_name text not null,
  phone text not null,
  city text not null,
  address text not null,
  notes text not null default '',
  pay_method text not null check (pay_method in ('cod', 'transfer', 'pickup')),
  items jsonb not null,
  total numeric(12, 2) not null,
  status text not null default 'new' check (status in ('new', 'confirmed', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ===== الصلاحيات =====
alter table public.admins enable row level security;
alter table public.parts enable row level security;
alter table public.orders enable row level security;

revoke all on public.admins, public.parts, public.orders from anon, authenticated;
grant select on public.parts to anon, authenticated;
grant insert, update, delete on public.parts to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.admins to authenticated;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select to authenticated using (user_id = auth.uid());

drop policy if exists parts_read on public.parts;
create policy parts_read on public.parts for select to anon, authenticated using (true);
drop policy if exists parts_insert on public.parts;
create policy parts_insert on public.parts for insert to authenticated with check (public.is_admin());
drop policy if exists parts_update on public.parts;
create policy parts_update on public.parts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists parts_delete on public.parts;
create policy parts_delete on public.parts for delete to authenticated using (public.is_admin());

drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select to authenticated using (public.is_admin());
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ===== تسجيل طلب من العميل (السعر يتحسب من قاعدة البيانات، مش من المتصفح) =====
create or replace function public.place_order(
  p_name text, p_phone text, p_city text, p_address text, p_notes text, p_pay text, p_part_ids bigint[]
) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_ids bigint[];
  v_items jsonb;
  v_total numeric;
  v_count int;
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
  select array_agg(distinct x) into v_ids from unnest(p_part_ids) as x;
  if v_ids is null or cardinality(v_ids) > 30 then
    raise exception 'السلة فاضية أو فيها قطع كتير';
  end if;
  select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'brand', brand, 'model', model, 'price', price) order by id),
         sum(price), count(*)
    into v_items, v_total, v_count
    from public.parts where id = any (v_ids) and not sold;
  if v_count <> cardinality(v_ids) then
    raise exception 'بعض القطع اتباعت أو مش موجودة';
  end if;
  insert into public.orders (customer_name, phone, city, address, notes, pay_method, items, total)
  values (p_name, p_phone, p_city, p_address, p_notes, p_pay, v_items, v_total)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.place_order(text, text, text, text, text, text, bigint[]) from public;
grant execute on function public.place_order(text, text, text, text, text, text, bigint[]) to anon, authenticated;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ===== صور القطع =====
insert into storage.buckets (id, name, public) values ('parts', 'parts', true)
on conflict (id) do nothing;

drop policy if exists parts_img_select on storage.objects;
create policy parts_img_select on storage.objects for select to authenticated using (bucket_id = 'parts' and public.is_admin());
drop policy if exists parts_img_insert on storage.objects;
create policy parts_img_insert on storage.objects for insert to authenticated with check (bucket_id = 'parts' and public.is_admin());
drop policy if exists parts_img_delete on storage.objects;
create policy parts_img_delete on storage.objects for delete to authenticated using (bucket_id = 'parts' and public.is_admin());

notify pgrst, 'reload schema';
