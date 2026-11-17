-- إيصال التحويل: العميل يرفع صورة الإيصال وتوصل للمحل
-- يتنفذ مرة واحدة فى Supabase > SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

-- ===== مخزن مستقل لصور الإيصالات =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', true, 3145728, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg'];

-- العميل يرفع بس، وما يقدرش يعدل أو يمسح حاجة اترفعت
drop policy if exists receipts_insert on storage.objects;
create policy receipts_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'receipts');
drop policy if exists receipts_admin_select on storage.objects;
create policy receipts_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_admin());
drop policy if exists receipts_admin_delete on storage.objects;
create policy receipts_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and public.is_admin());

-- ===== الإيصال متربط بالطلب =====
alter table public.orders add column if not exists receipt_url text;

-- العميل يربط الإيصال بطلبه هو بالرمز المحفوظ على موبايله
create or replace function public.attach_receipt(p_token uuid, p_url text) returns void
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if coalesce(p_url, '') !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/receipts/[A-Za-z0-9._/-]+$' then
    raise exception 'رابط الإيصال غير صحيح';
  end if;
  select id into v_id from public.orders
   where token = p_token
     and status in ('new', 'ready')
     and pay_method in ('transfer_pickup', 'transfer_ship');
  if not found then raise exception 'الطلب مش موجود أو مش محتاج إيصال'; end if;
  update public.orders set receipt_url = p_url where id = v_id;
end;
$$;
revoke all on function public.attach_receipt(uuid, text) from public;
grant execute on function public.attach_receipt(uuid, text) to anon, authenticated;

-- ===== صفحة «طلباتى» تعرض الإيصال كمان =====
drop function if exists public.my_orders(uuid[]);
create function public.my_orders(p_tokens uuid[])
returns table (token uuid, id bigint, items jsonb, total numeric, pay_method text, status text,
               pickup_code text, receipt_url text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.token, o.id, o.items, o.total, o.pay_method, o.status,
         case when o.status = 'ready' then o.pickup_code else null end,
         o.receipt_url,
         o.created_at
  from public.orders o
  where o.token = any (p_tokens) and coalesce(cardinality(p_tokens), 0) <= 50
  order by o.created_at desc;
$$;
revoke all on function public.my_orders(uuid[]) from public;
grant execute on function public.my_orders(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
