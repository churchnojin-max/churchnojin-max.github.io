-- 수요기도회 말씀 자료 — 목사님 고침(2026-10-05 밤)
--   "내 설교를 밖으로 공개하지 않으려는 거야. 오는 사람들에게만 특권을 주는 거지.
--    아주 짧게 본문, 제목, 핵심 3가지와 인용 구절만. 콘티를 올리면 악보도 — 오후 10시 30분에는 사라지게."
--   목사님 결정: 예배 뒤에는 말씀 자료도 악보처럼 밤 10시 30분에 함께 닫는다('지난 수요 말씀' 모아 보기 없음).
-- 앞의 supabase/sermon_notes_20261005.sql 다음에 1회 실행. 여러 번 실행해도 안전하다.

-- ① 말씀 자료: 그날 저녁 8시에 열리고 밤 10시 30분에 닫힌다(close_at, 트리거가 정함)
alter table public.sermon_notes add column if not exists close_at timestamptz;

create or replace function public.sermon_notes_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.publish_at := (new.note_date + time '20:00') at time zone 'Asia/Seoul';
  new.close_at   := (new.note_date + time '22:30') at time zone 'Asia/Seoul';
  if new.status = 'approved' then
    if tg_op = 'INSERT' or old.status is distinct from 'approved' then
      new.approved_at := now();
      new.approved_by := auth.uid();
    end if;
  else
    new.approved_at := null;
    new.approved_by := null;
  end if;
  return new;
end $$;

update public.sermon_notes set note_date = note_date where close_at is null;   -- 이미 있는 자료에 닫히는 때 채우기

drop policy if exists "sermon notes members read" on public.sermon_notes;
create policy "sermon notes members read" on public.sermon_notes for select to authenticated
  using (status = 'approved' and publish_at <= now() and now() < close_at);

-- 첫 화면 띠도 예배 시간(저녁 8시 ~ 밤 10시 30분)에만
create or replace function public.wed_note_now() returns json
language sql stable security definer set search_path = public as $$
  select coalesce((
    select json_build_object(
      'open', true,
      'date', n.note_date,
      'title', case when auth.uid() is not null then n.title end,
      'scripture', case when auth.uid() is not null then n.scripture end)
    from public.sermon_notes n
    where n.status = 'approved' and n.publish_at <= now() and now() < n.close_at
    order by n.note_date desc
    limit 1), json_build_object('open', false));
$$;
revoke all on function public.wed_note_now() from public;
grant execute on function public.wed_note_now() to anon, authenticated;

-- ② 콘티·악보: 목사님(관리자)이 올린다. 그날(0시부터) 로그인한 분께 보이고 밤 10시 30분에 사라진다.
--    파일은 비공개 보관함 private_files 의 conti/<날짜>/ 에 둔다(지우지 않고 숨김 — 목사님은 늘 볼 수 있다).
create table if not exists public.sermon_conti (
  id         uuid primary key default gen_random_uuid(),
  service    text not null default '수요기도회',
  note_date  date not null,
  files      jsonb not null default '[]'::jsonb,   -- [{"path":"conti/2026-10-07/…jpg","name":"…","type":"image/jpeg"}]
  open_at    timestamptz,
  close_at   timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service, note_date)
);

create or replace function public.sermon_conti_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  new.open_at  := (new.note_date + time '00:00') at time zone 'Asia/Seoul';
  new.close_at := (new.note_date + time '22:30') at time zone 'Asia/Seoul';
  return new;
end $$;

drop trigger if exists trg_sermon_conti_touch on public.sermon_conti;
create trigger trg_sermon_conti_touch before insert or update on public.sermon_conti
  for each row execute function public.sermon_conti_touch();

alter table public.sermon_conti enable row level security;

drop policy if exists "sermon conti members read" on public.sermon_conti;
create policy "sermon conti members read" on public.sermon_conti for select to authenticated
  using (now() >= open_at and now() < close_at);
drop policy if exists "sermon conti admin all" on public.sermon_conti;
create policy "sermon conti admin all" on public.sermon_conti for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.sermon_conti from anon;
revoke all on public.sermon_conti from authenticated;
grant select, insert, update, delete on public.sermon_conti to authenticated;

-- ③ 보관함: 악보 파일은 그 콘티가 열려 있는 동안만 로그인한 분이 받을 수 있다.
--    (목사님·관리자는 'private_files read' 의 private_file_staff 로 늘 볼 수 있고, 올리기·지우기도 관리자만)
drop policy if exists "private_files conti read" on storage.objects;
create policy "private_files conti read" on storage.objects for select to authenticated
  using (
    bucket_id = 'private_files' and name like 'conti/%' and exists (
      select 1 from public.sermon_conti c
       where now() >= c.open_at and now() < c.close_at
         and c.files @> jsonb_build_array(jsonb_build_object('path', storage.objects.name)))
  );

-- ④ 공개 보관함 'uploads' 에는 conti 폴더로 올릴 수 없다(옛 화면 코드가 악보를 공개 쪽에 올리는 일을 막는다)
drop policy if exists "uploads auth insert" on storage.objects;
create policy "uploads auth insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (name like 'sermons/img/%'
         or split_part(name, '/', 1) not in ('archive', 'affairs', 'gyojeok', 'finance', 'sermons', 'resources', 'conti'))
  );
