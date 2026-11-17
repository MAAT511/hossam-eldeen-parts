-- كود الاستلام يفضل عند العميل بس: المحل ما بيشوفوش لا فى اللوحة ولا فى البيانات
-- يتنفذ مرة واحدة فى Supabase > SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

-- ===== التأكيد ما يرجّعش الكود =====
drop function if exists public.admin_confirm_order(bigint);
create function public.admin_confirm_order(p_id bigint) returns void
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
  update public.parts set sold = true
   where id in (select (x->>'id')::bigint from jsonb_array_elements(v_items) x where (x->>'id') is not null);
end;
$$;
revoke all on function public.admin_confirm_order(bigint) from public;
grant execute on function public.admin_confirm_order(bigint) to authenticated;

-- ===== عمودى الكود والرمز السرى مش متقريين من اللوحة =====
-- الصلاحية بقت على أعمدة محددة، فلازم أى استعلام يسمى الأعمدة ولا يستخدم النجمة
revoke select on public.orders from authenticated;
grant select (id, customer_name, phone, city, address, notes, pay_method,
              items, total, status, receipt_url, confirmed_at, created_at)
  on public.orders to authenticated;

notify pgrst, 'reload schema';
