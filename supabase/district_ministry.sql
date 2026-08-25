-- ============================================================
--  노진교회 — 교구사역 (구역장 사역보고 · 말씀 나눔지) · 1회 실행
-- ------------------------------------------------------------
--  권한 두 단계
--    can_district      : 구역장·인도자 — 자기가 쓴 보고만 본다
--    can_district_all  : 교구장 — 모든 구역의 보고를 본다
--    관리자(admins)    : 전부 (기존과 동일)
-- ============================================================

-- ── 1) 권한 컬럼 ────────────────────────────────────────────
alter table public.member_links
  add column if not exists can_district     boolean not null default false,
  add column if not exists can_district_all boolean not null default false;

comment on column public.member_links.can_district     is '교구사역(구역장·인도자) 권한 — 자기 보고만';
comment on column public.member_links.can_district_all is '교구사역(교구장) 권한 — 전 구역 열람';

-- ── 2) 판정 함수 ────────────────────────────────────────────
create or replace function public.can_district_all()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.is_admin()
      or exists(select 1 from public.member_links m
                 where m.user_id = auth.uid() and m.can_district_all)
$$;

create or replace function public.can_district()
returns boolean language sql security definer stable
set search_path = public as $$
  select public.can_district_all()
      or exists(select 1 from public.member_links m
                 where m.user_id = auth.uid() and m.can_district)
$$;

-- ── 3) 사역보고 ─────────────────────────────────────────────
create table if not exists public.district_reports (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  met_on       date not null,                       -- 모임일자
  district     text not null,                       -- 1교구 ~ 5교구
  place        text,                                -- 예배장소
  reporter     text,                                -- 보고자
  attendees    text,                                -- 참석자(한 줄에 한 명)
  attend_count integer not null default 0,          -- 출석인원(참석자에서 자동 계산)
  offering     integer not null default 0,          -- 헌금
  next_place   text,                                -- 다음 모임장소
  prayer       text,                                -- 구역원 기도제목
  suggestion   text,                                -- 구역장 건의사항
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists district_reports_user_idx on public.district_reports (user_id, met_on desc);
create index if not exists district_reports_month_idx on public.district_reports (met_on desc, district);

alter table public.district_reports enable row level security;

-- 읽기: 교구장·관리자는 전부, 구역장은 자기가 쓴 것만
drop policy if exists "district_reports_read" on public.district_reports;
create policy "district_reports_read" on public.district_reports
  for select to authenticated
  using (public.can_district_all() or (public.can_district() and user_id = auth.uid()));

-- 쓰기: 권한이 있는 사람이 자기 이름으로만
drop policy if exists "district_reports_insert" on public.district_reports;
create policy "district_reports_insert" on public.district_reports
  for insert to authenticated
  with check (public.can_district() and user_id = auth.uid());

-- 고치기·지우기: 자기 것만 (교구장·관리자는 전부)
drop policy if exists "district_reports_update" on public.district_reports;
create policy "district_reports_update" on public.district_reports
  for update to authenticated
  using (public.can_district_all() or (public.can_district() and user_id = auth.uid()))
  with check (public.can_district_all() or (public.can_district() and user_id = auth.uid()));

drop policy if exists "district_reports_delete" on public.district_reports;
create policy "district_reports_delete" on public.district_reports
  for delete to authenticated
  using (public.can_district_all() or (public.can_district() and user_id = auth.uid()));

-- 수정 시각 자동 갱신
create or replace function public.district_reports_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists trg_district_reports_touch on public.district_reports;
create trigger trg_district_reports_touch
  before update on public.district_reports
  for each row execute function public.district_reports_touch();

-- ── 4) 말씀 나눔지 ──────────────────────────────────────────
create table if not exists public.district_sheets (
  id         bigint generated always as identity primary key,
  title      text not null,
  sheet_date date not null default current_date,
  path       text not null,                          -- storage 안의 경로
  size       bigint,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.district_sheets enable row level security;

-- 읽기: 교구사역 권한이 있는 사람
drop policy if exists "district_sheets_read" on public.district_sheets;
create policy "district_sheets_read" on public.district_sheets
  for select to authenticated using (public.can_district());

-- 올리기·지우기: 교구장·관리자
drop policy if exists "district_sheets_write" on public.district_sheets;
create policy "district_sheets_write" on public.district_sheets
  for all to authenticated
  using (public.can_district_all())
  with check (public.can_district_all());

-- ── 5) 파일 보관함(비공개 버킷) ─────────────────────────────
insert into storage.buckets (id, name, public)
values ('district_sheets', 'district_sheets', false)
on conflict (id) do nothing;

drop policy if exists "district_sheets_storage_read" on storage.objects;
create policy "district_sheets_storage_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'district_sheets' and public.can_district());

drop policy if exists "district_sheets_storage_write" on storage.objects;
create policy "district_sheets_storage_write" on storage.objects
  for all to authenticated
  using (bucket_id = 'district_sheets' and public.can_district_all())
  with check (bucket_id = 'district_sheets' and public.can_district_all());
