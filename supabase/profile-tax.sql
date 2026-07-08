-- ============================================================
-- ○○교회 — 직책·주소·생년월일 + 연말정산 신청
-- Supabase ▸ SQL Editor 에 붙여넣고 Run 하세요. (한 번만)
-- ============================================================

-- 1) profiles 추가 컬럼
alter table public.profiles add column if not exists role text;     -- 직책(관리자가 지정)
alter table public.profiles add column if not exists address text;  -- 주소
alter table public.profiles add column if not exists birth text;    -- 생년월일

-- 2) 관리자는 모든 프로필 수정 가능(직책 지정용), 일반 회원은 본인만
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles for update
  using (auth.uid() = id or auth.uid() in (select uid from public.admins));

-- 3) 연말정산 신청 테이블
create table if not exists public.tax_requests (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  phone      text not null,
  address    text not null,
  birth      text not null,
  rrn_front  text not null,                 -- 주민번호 앞자리(민감정보)
  status     text not null default '접수',
  created_at timestamptz not null default now()
);
alter table public.tax_requests enable row level security;

-- 본인 신청 등록, 본인·관리자만 조회
drop policy if exists "tax_insert_own" on public.tax_requests;
drop policy if exists "tax_select_self_or_admin" on public.tax_requests;
drop policy if exists "tax_delete_self_or_admin" on public.tax_requests;
create policy "tax_insert_own" on public.tax_requests for insert with check (auth.uid() = user_id);
create policy "tax_select_self_or_admin" on public.tax_requests for select
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));
create policy "tax_delete_self_or_admin" on public.tax_requests for delete
  using (auth.uid() = user_id or auth.uid() in (select uid from public.admins));
