-- اختيار كفر الموقع من لوحة الإدارة
-- يتنفذ مرة واحدة فى Supabase > SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

-- ===== علامة الكفر على صور الجولة =====
alter table public.tour_photos add column if not exists is_cover boolean not null default false;
-- صورة واحدة بس تقدر تكون الكفر
create unique index if not exists tour_photos_one_cover on public.tour_photos (is_cover) where is_cover;

create or replace function public.admin_set_cover(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'غير مسموح'; end if;
  update public.tour_photos set is_cover = false where is_cover;
  if p_id is not null then
    update public.tour_photos set is_cover = true where id = p_id;
    if not found then raise exception 'الصورة مش موجودة'; end if;
  end if;
end;
$$;
revoke all on function public.admin_set_cover(bigint) from public;
grant execute on function public.admin_set_cover(bigint) to authenticated;

-- الصورة اللى شغالة كفر دلوقتى تتعلم، لو مفيش واحدة متعلمة قبل كده
update public.tour_photos set is_cover = true
 where url = 'https://vcubvevyiiodyfumhcde.supabase.co/storage/v1/object/public/parts/tour/1794856088245-9oxt8r.jpg'
   and not exists (select 1 from public.tour_photos t where t.is_cover);

notify pgrst, 'reload schema';
