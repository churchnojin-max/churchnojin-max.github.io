-- ============================================================
--  노진교회 — 비공개 보관함 'private_files' (2026-10-03, 목사님 승인 "남은 파일 옮기기도 해줘")
--  Supabase ▸ SQL Editor 에서 실행. 여러 번 실행해도 안전하다.
--
--  왜: 공개 보관함 'uploads' 는 주소만 알면 누구나 열린다. 사진·주보처럼 원래 공개하는 것만 거기 두고,
--      성도 문서·심방/상담 첨부·교적 사진·직인/고유번호증·설교 원고·자료실 파일은 여기(비공개)에 둔다.
--  어떻게 여나: 화면(js/upload.js)이 로그인한 사람의 권한으로 '1시간짜리 주소'를 받아서 연다.
--      DB 에는 <주소>/storage/v1/object/authenticated/private_files/<경로> 로 적힌다(그대로 열면 안 열림).
--  폴더별 권한
--      archive/   성도 문서        : 목회행정 담당 + 그 문서의 교인 본인(정회원)
--      affairs/   심방·상담 첨부   : 목회행정 담당
--      sermons/   설교 원고        : 목회행정·예배 담당      (sermons/img 는 설교 글 속 그림이라 공개 보관함에 둔다)
--      gyojeok/   교적 사진        : 교적 담당(읽기는 재정 담당도)
--      finance/   직인·고유번호증  : 재정 담당
--      resources/ 자료실           : 올리기는 목회행정·예배 담당, 받기는 정회원
--
--  2026-10-03 실제 DB 에 실행함. 같은 날 공개 보관함에 있던 설교 원고 81개·자료실 1개를 이 보관함의
--  같은 경로로 옮기고(Storage API move), sermons.file_url 80건의 주소를 아래처럼 바꿨다:
--    update public.sermons set file_url = replace(file_url,
--      '/storage/v1/object/public/uploads/sermons/', '/storage/v1/object/authenticated/private_files/sermons/')
--     where file_url like '%/storage/v1/object/public/uploads/sermons/%' and file_url not like '%/uploads/sermons/img/%';
--  같은 날 쓸모없던 DB 예약 일 tts-prewarm 도 지웠다: select cron.unschedule('tts-prewarm');
-- ============================================================
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('private_files', 'private_files', false, 52428800)
on conflict (id) do update set public = false;

-- 폴더별 담당자인가(관리자는 전부)
create or replace function public.private_file_staff(p_name text)
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or (p_name like 'archive/%'   and public.can_affairs())
      or (p_name like 'affairs/%'   and public.can_affairs())
      or (p_name like 'sermons/%'   and (public.can_affairs() or public.can_worship()))
      or (p_name like 'gyojeok/%'   and public.can_gyojeok())
      or (p_name like 'finance/%'   and public.is_finance())
      or (p_name like 'resources/%' and (public.can_affairs() or public.can_worship()))
$$;
revoke all on function public.private_file_staff(text) from public, anon;
grant execute on function public.private_file_staff(text) to authenticated;

drop policy if exists "private_files read"   on storage.objects;
drop policy if exists "private_files insert" on storage.objects;
drop policy if exists "private_files update" on storage.objects;
drop policy if exists "private_files delete" on storage.objects;

create policy "private_files read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private_files' and (
      public.private_file_staff(name)
      or (name like 'gyojeok/%'   and public.is_finance())
      or (name like 'resources/%' and public.is_full_member())
      or (name like 'archive/%'   and exists (
            select 1 from public.member_files f
             where f.file_key = storage.objects.name
               and f.member_key in (select public.my_member_keys())))
    )
  );

create policy "private_files insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'private_files' and public.private_file_staff(name));

create policy "private_files update" on storage.objects
  for update to authenticated
  using (bucket_id = 'private_files' and public.private_file_staff(name))
  with check (bucket_id = 'private_files' and public.private_file_staff(name));

create policy "private_files delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'private_files' and public.private_file_staff(name));

-- 공개 보관함에는 이제 위 폴더 이름으로 올릴 수 없다(옛 화면 코드가 민감 파일을 공개 쪽에 올리는 일을 막는다).
drop policy if exists "uploads auth insert" on storage.objects;
create policy "uploads auth insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'uploads'
    and (name like 'sermons/img/%'
         or split_part(name, '/', 1) not in ('archive', 'affairs', 'gyojeok', 'finance', 'sermons', 'resources'))
  );

commit;
