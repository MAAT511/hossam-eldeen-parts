-- استعلامات العملاء عن الأسعار: يتنفذ مرة واحدة فى Supabase → SQL Editor (مشروع Hossam-Eldeen)
-- آمن لو اتنفذ أكتر من مرة

create table if not exists public.inquiries (
  id bigint generated always as identity primary key,
  token uuid not null default gen_random_uuid() unique,
  customer_name text not null,
  phone text not null,
  question text not null default '',
  photo_url text not null default '',
  part_id bigint references public.parts (id) on delete set null,
  part_name text not null default '',
  answer text not null default '',
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.inquiries enable row level security;

revoke all on public.inquiries from anon, authenticated;
grant select, update, delete on public.inquiries to authenticated;

drop policy if exists inquiries_read on public.inquiries;
create policy inquiries_read on public.inquiries for select to authenticated using (public.is_admin());
drop policy if exists inquiries_update on public.inquiries;
create policy inquiries_update on public.inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists inquiries_delete on public.inquiries;
create policy inquiries_delete on public.inquiries for delete to authenticated using (public.is_admin());

-- العميل يبعت استعلام: يرجع له رمز سرى يشوف بيه الرد بعدين
create or replace function public.submit_inquiry(
  p_name text, p_phone text, p_question text, p_photo_url text, p_part_id bigint
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_part_name text := '';
  v_photo text := coalesce(p_photo_url, '');
  v_token uuid;
begin
  p_name := btrim(coalesce(p_name, ''));
  p_question := btrim(coalesce(p_question, ''));
  if length(p_name) not between 2 and 100 or length(p_question) > 500 then
    raise exception 'بيانات الاستعلام غير مكتملة';
  end if;
  if coalesce(p_phone, '') !~ '^01[0125][0-9]{8}$' then
    raise exception 'رقم الموبايل غير صحيح';
  end if;
  if (select count(*) from public.inquiries where phone = p_phone and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'استعلامات كتير من نفس الرقم، جرب بعد شوية';
  end if;
  if p_part_id is not null then
    select btrim(name || ' ' || brand || ' ' || model), coalesce(images[1], '')
      into v_part_name, v_photo
      from public.parts where id = p_part_id;
    if not found then
      raise exception 'القطعة غير موجودة';
    end if;
  elsif v_photo !~ '^(images/[A-Za-z0-9._-]+|https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/parts/[A-Za-z0-9._/-]+)$' then
    raise exception 'الصورة غير صحيحة';
  end if;
  insert into public.inquiries (customer_name, phone, question, photo_url, part_id, part_name)
  values (p_name, p_phone, p_question, v_photo, p_part_id, v_part_name)
  returning token into v_token;
  return v_token;
end;
$$;

-- العميل يشوف استعلاماته هو بس بالرموز المحفوظة على موبايله
create or replace function public.my_inquiries(p_tokens uuid[])
returns table (token uuid, question text, photo_url text, part_name text, answer text, answered_at timestamptz, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.token, i.question, i.photo_url, i.part_name, i.answer, i.answered_at, i.created_at
  from public.inquiries i
  where i.token = any (p_tokens) and coalesce(cardinality(p_tokens), 0) <= 50
  order by i.created_at desc;
$$;

revoke all on function public.submit_inquiry(text, text, text, text, bigint) from public;
grant execute on function public.submit_inquiry(text, text, text, text, bigint) to anon, authenticated;
revoke all on function public.my_inquiries(uuid[]) from public;
grant execute on function public.my_inquiries(uuid[]) to anon, authenticated;

notify pgrst, 'reload schema';
