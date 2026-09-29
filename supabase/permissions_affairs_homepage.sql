-- ============================================================
--  노진교회 — 목회행정 · 홈페이지 설정을 '권한 받은 분'에게 열기 (2026-09-29)
--  Supabase ▸ SQL Editor 에 붙여넣고 Run (1회). 여러 번 실행해도 안전하다.
--
--  왜 필요한가:
--    교적관리 화면에서 목회행정·예배·홈페이지 권한을 체크해 줘도,
--    그 자료가 든 표(심방·상담·설교·주보·홈페이지 설정 등)의 잠금 규칙(RLS)이
--    '관리자만'으로 되어 있어서 권한 받은 분은 화면만 보이고 자료를 읽거나 저장할 수 없었다.
--
--  무엇을 하나:
--    기존 '관리자 전용' 규칙은 하나도 건드리지 않고, 권한 받은 분을 위한 규칙을 '추가'만 한다.
--    (규칙은 '또는'으로 합쳐지므로 담임목사님(관리자)은 지금과 똑같이 전부 된다.)
--      · 목회행정 권한 (can_affairs) : 심방·상담·교육·설교·문서·예화·메모·예배매니저·교육자료 파일
--      · 예배 권한     (can_worship) : 찬양·주보제작·이달의 찬양·봉사위원 (주보에 넣을 설교 제목은 읽기만)
--      · 홈페이지 권한 (can_homepage): 홈페이지 설정(로고·섬기는 사람들·월별 봉사위원)
--    '나의 도서관'과 목회행정 '설정' 탭은 계속 담임목사님 전용이다.
--
--  되돌리기: 맨 아래 '되돌리기' 부분의 주석을 풀어 실행하면 이번에 추가한 규칙만 지워진다.
-- ============================================================

-- ── 0) 영역 권한 칸 · 판정 함수 (permissions_granular.sql 과 같은 내용. 이미 있으면 그대로) ──
alter table public.member_links
  add column if not exists can_gyojeok  boolean not null default false,
  add column if not exists can_homepage boolean not null default false,
  add column if not exists can_worship  boolean not null default false,
  add column if not exists can_affairs  boolean not null default false,
  add column if not exists can_board    boolean not null default false;

create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(select 1 from public.admins a where a.uid = auth.uid())
$$;

create or replace function public.can_affairs()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_affairs)
$$;

create or replace function public.can_worship()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_worship)
$$;

create or replace function public.can_homepage()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m where m.user_id = auth.uid() and m.can_homepage)
$$;

-- ── 1) 목회행정 권한: 표 전체 읽기·쓰기 ──────────────────────
-- (없는 표는 건너뛴다 — 영상 제작 표 등은 아직 안 만들었을 수 있음)
do $$
declare t text;
begin
  foreach t in array array[
    'visitations','counsels','edu_records','edu_materials','sermons','documents',
    'sermon_illustrations','memos','worship_templates','sermon_songs','worship_songs',
    'video_jobs','video_presets'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "perm affairs %1$s" on public.%1$s', t);
      execute format('create policy "perm affairs %1$s" on public.%1$s for all to authenticated using (public.can_affairs()) with check (public.can_affairs())', t);
    end if;
  end loop;
end $$;

-- ── 2) 예배 권한: 찬양·주보 표 읽기·쓰기, 설교는 읽기만 ──────
do $$
declare t text;
begin
  foreach t in array array['worship_songs','sermon_songs','bulletins'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "perm worship %1$s" on public.%1$s', t);
      execute format('create policy "perm worship %1$s" on public.%1$s for all to authenticated using (public.can_worship()) with check (public.can_worship())', t);
    end if;
  end loop;
  if to_regclass('public.sermons') is not null then
    drop policy if exists "perm worship read sermons" on public.sermons;
    create policy "perm worship read sermons" on public.sermons for select to authenticated using (public.can_worship());
  end if;
end $$;

-- ── 3) 교회 설정(church_settings): 항목(key)별로 ──────────────
--   homepage          → 홈페이지 권한
--   committees(봉사위원) → 홈페이지 권한 또는 예배 권한
--   monthly_song(이달의 찬양) → 예배 권한
--   general(설립일 등)  → 계속 관리자 전용
drop policy if exists "perm homepage church_settings" on public.church_settings;
create policy "perm homepage church_settings" on public.church_settings for all to authenticated
  using (public.can_homepage() and key in ('homepage', 'committees'))
  with check (public.can_homepage() and key in ('homepage', 'committees'));

drop policy if exists "perm worship church_settings" on public.church_settings;
create policy "perm worship church_settings" on public.church_settings for all to authenticated
  using (public.can_worship() and key in ('monthly_song', 'committees'))
  with check (public.can_worship() and key in ('monthly_song', 'committees'));

-- ── 4) 교육자료 파일(저장소 edu_materials): 목회행정 권한도 올리고 지울 수 있게 ──
drop policy if exists "perm affairs edu_materials storage" on storage.objects;
create policy "perm affairs edu_materials storage" on storage.objects for all to authenticated
  using (bucket_id = 'edu_materials' and public.can_affairs())
  with check (bucket_id = 'edu_materials' and public.can_affairs());

-- ── 확인: 아래가 실행되면 추가된 규칙 목록이 나온다 ──────────
select tablename, policyname from pg_policies
where policyname like 'perm affairs %' or policyname like 'perm worship %' or policyname like 'perm homepage %'
order by tablename, policyname;

-- ============================================================
--  되돌리기 (필요할 때만 주석을 풀어 실행)
-- ============================================================
-- do $$
-- declare r record;
-- begin
--   for r in select schemaname, tablename, policyname from pg_policies
--            where policyname like 'perm affairs %' or policyname like 'perm worship %' or policyname like 'perm homepage %'
--   loop
--     execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
--   end loop;
-- end $$;
