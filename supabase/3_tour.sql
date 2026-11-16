-- صور «جولة داخل المحل»: يتنفذ مرة واحدة فى Supabase → SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

create table if not exists public.tour_photos (
  id bigint generated always as identity primary key,
  url text not null unique,
  created_at timestamptz not null default now()
);

alter table public.tour_photos enable row level security;

revoke all on public.tour_photos from anon, authenticated;
grant select on public.tour_photos to anon, authenticated;
grant insert, delete on public.tour_photos to authenticated;

drop policy if exists tour_read on public.tour_photos;
create policy tour_read on public.tour_photos for select to anon, authenticated using (true);
drop policy if exists tour_insert on public.tour_photos;
create policy tour_insert on public.tour_photos for insert to authenticated with check (public.is_admin());
drop policy if exists tour_delete on public.tour_photos;
create policy tour_delete on public.tour_photos for delete to authenticated using (public.is_admin());

-- الصور الأربعة الموجودة حاليا فى الموقع
insert into public.tour_photos (url) values
  ('images/shop-2.jpg'), ('images/shop-3.jpg'), ('images/shop-4.jpg'), ('images/shop-5.jpg')
on conflict (url) do nothing;

notify pgrst, 'reload schema';
