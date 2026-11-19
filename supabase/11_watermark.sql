-- اللوحة تقدر تستبدل صورة الجولة بنسخة عليها العلامة المائية
-- يتنفذ مرة واحدة فى Supabase > SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

grant update on public.tour_photos to authenticated;

drop policy if exists tour_update on public.tour_photos;
create policy tour_update on public.tour_photos for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

notify pgrst, 'reload schema';
